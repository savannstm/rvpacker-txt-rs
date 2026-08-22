#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::needless_doctest_main)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::cast_possible_wrap)]
#![allow(clippy::cast_sign_loss)]
#![allow(clippy::deref_addrof)]

use anyhow::{Context, Result, bail};
use clap::{
    ArgAction, Args, Parser, Subcommand, ValueEnum,
    builder::{PossibleValuesParser, TypedValueParser},
    crate_version, value_parser,
};
use clap_verbosity_flag::{InfoLevel, Verbosity};
use encoding_rs::{Encoding, GB18030, SHIFT_JIS, UTF_8, WINDOWS_1252};
use gxhash::HashMap;
use rpgmad_lib::Decrypter;
use rvpacker_lib::{
    BaseFlags, Mode, Processor, RPGMFileType, RVPACKER_IGNORE_FILE,
    RVPACKER_METADATA_FILE, get_ini_title, json,
    types::{DuplicateMode, EngineType, FileFlags},
};
use serde::{Deserialize, Serialize};
use serde_json::{from_str, to_string};
use std::{
    fs::{create_dir_all, read, read_to_string, write},
    io::stdin,
    mem::take,
    path::{Path, PathBuf},
    process::exit,
    str::FromStr,
    time::Instant,
};
use strum::VariantNames;

#[derive(Clone, Debug)]
pub struct SkipMaps(pub Vec<u16>);

impl FromStr for SkipMaps {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut indices = Vec::new();

        for part in s.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            if let Some((a, b)) = part.split_once('-') {
                let start = a.parse::<u16>().map_err(|e| {
                    format!("Invalid start of range `{a}`: {e}")
                })?;
                let end = b
                    .parse::<u16>()
                    .map_err(|e| format!("Invalid end of range `{b}`: {e}"))?;

                if start > end {
                    return Err(format!(
                        "Range `{part}` is reversed (start > end)"
                    ));
                }

                for v in start..=end {
                    indices.push(v);
                }
            } else {
                let v = part
                    .parse::<u16>()
                    .map_err(|e| format!("Invalid integer `{part}`: {e}"))?;
                indices.push(v);
            }
        }

        Ok(SkipMaps(indices))
    }
}

#[derive(Clone, Debug)]
pub struct SkipEvents(pub Vec<(RPGMFileType, Vec<u16>)>);

impl FromStr for SkipEvents {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut result = Vec::new();

        for section in s.split(';').map(str::trim).filter(|s| !s.is_empty()) {
            let mut indices = Vec::new();

            let Some((file, parts)) = section.split_once(':') else {
                return Err(String::new());
            };

            for part in parts.split(',') {
                if let Some((a, b)) = part.split_once('-') {
                    let start = a.parse::<u16>().map_err(|e| {
                        format!("Invalid start of range `{a}`: {e}")
                    })?;
                    let end = b.parse::<u16>().map_err(|e| {
                        format!("Invalid end of range `{b}`: {e}")
                    })?;

                    if start > end {
                        return Err(format!(
                            "Range `{part}` is reversed (start > end)"
                        ));
                    }

                    for v in start..=end {
                        indices.push(v);
                    }
                } else {
                    let v = part.parse::<u16>().map_err(|e| {
                        format!("Invalid integer `{part}`: {e}")
                    })?;
                    indices.push(v);
                }
            }

            result.push((RPGMFileType::from_filename(file), indices));
        }

        Ok(SkipEvents(result))
    }
}

#[derive(Clone, Copy, Debug)]
pub struct FFlags(pub FileFlags);

impl FromStr for FFlags {
    type Err = <FileFlags as FromStr>::Err;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut flags = FileFlags::empty();

        for flag_str in s.split(',').filter(|s| !s.is_empty()) {
            let flag = FileFlags::from_str(flag_str)?;
            flags.insert(flag);
        }

        Ok(FFlags(flags))
    }
}

/// Encodings `Game.ini` is plausibly saved in.
///
/// The file predates UTF-8 becoming the default on Windows, so its title is
/// not necessarily - and for a Japanese or Chinese game, probably isn't -
/// valid UTF-8. There is no way to detect the encoding from the bytes alone,
/// so the user has to say which one it is.
#[derive(Clone, Copy, Debug, ValueEnum)]
enum IniEncoding {
    #[value(name = "utf-8")]
    Utf8,
    #[value(name = "shift-jis")]
    ShiftJis,
    #[value(name = "gb18030")]
    Gb18030,
    #[value(name = "windows-1252")]
    Windows1252,
}

impl IniEncoding {
    fn as_encoding(self) -> &'static Encoding {
        match self {
            Self::Utf8 => UTF_8,
            Self::ShiftJis => SHIFT_JIS,
            Self::Gb18030 => GB18030,
            Self::Windows1252 => WINDOWS_1252,
        }
    }
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    trim: bool,
    duplicate_mode: DuplicateMode,
    hashes: Option<HashMap<String, u64>>,
}

#[derive(Args, Debug)]
#[allow(clippy::struct_excessive_bools)]
struct SharedArgs {
    /// Defines how to read files.
    /// `default` - If encounters existing translation files, aborts read.
    /// `append` - Appends any new text from the game to the translation files, if the text is not already present. Unused lines are removed from translation files, and the lines order is sorted.
    /// `force` - Force rewrites existing translation files
    #[arg(
        short,
        long,
        alias = "mode",
        default_value = "default",
        value_name = "MODE",
        display_order = 3,
        value_parser = PossibleValuesParser::new(["default", "append", "force", "force-append"]).map(|s| Mode::from_str(&s).unwrap())
    )]
    read_mode: Mode,

    /// Removes the leading and trailing whitespace from extracted strings. Don't use this option unless you know that trimming the text won't cause any incorrect behavior
    #[arg(short, long, action = ArgAction::SetTrue, display_order = 6)]
    trim: bool,

    /// Skips processing specified files, separated by comma. `plugins` can be used interchangeably with `scripts`
    #[arg(
        short,
        long,
        alias = "skip",
        value_name = "FILES",
        display_order = 94,
        default_value = "",
        value_parser = value_parser!(FFlags)
    )]
    skip_files: FFlags,

    /// Skips processing specified maps, separated by comma.
    #[arg(
        long,
        alias = "sm",
        value_name = "MAP_INDICES",
        value_parser = value_parser!(SkipMaps),
        default_value = ""
    )]
    skip_maps: SkipMaps,

    /// Skips processing specified events. Has no effect on maps.
    /// Follows the following syntax: `file:0,1,..;file:0,1,..`
    #[arg(
        long,
        alias = "se",
        value_name = "EVENT_INDICES",
        value_parser = value_parser!(SkipEvents),
        default_value = ""
    )]
    skip_events: SkipEvents,

    #[arg(short, long, alias = "me", action = ArgAction::SetTrue)]
    map_events: bool,

    /// Controls how to handle duplicates in text
    #[arg(
        short,
        long,
        alias = "dup-mode",
        default_value = "remove",
        display_order = 93,
        value_parser = PossibleValuesParser::new(DuplicateMode::VARIANTS).map(|s| DuplicateMode::from_str(&s).unwrap())
    )]
    duplicate_mode: DuplicateMode,
}

#[derive(Args, Debug)]
struct ReadArgs {
    #[arg(short = 'S', long, hide = true, action = ArgAction::SetTrue)]
    silent: bool,

    /// Ignore entries from `.rvpacker-ignore` file.
    #[arg(short = 'I', long, action = ArgAction::SetTrue, requires_if("append", "read_mode"), requires_if("force-append", "read_mode"))]
    ignore: bool,

    #[arg(long, alias = "so", action = ArgAction::SetTrue, requires_if("append", "read_mode"), requires_if("force-append", "read_mode"))]
    skip_obsolete: bool,

    /// Decodes `Game.ini`'s title with the given encoding and prints it,
    /// without reading anything else. XP/VX/VX Ace only. Use this to find
    /// the right encoding before passing it to `--game-ini-encoding`.
    #[arg(long, value_name = "ENCODING")]
    parse_game_ini: Option<IniEncoding>,

    /// Encoding to decode `Game.ini`'s title with, for XP/VX/VX Ace. This
    /// overrides whatever the system file's own title field carries.
    /// Left unset, the title is not touched at all - guessing wrong would
    /// silently corrupt it.
    #[arg(long, value_name = "ENCODING")]
    game_ini_encoding: Option<IniEncoding>,

    #[command(flatten)]
    shared: SharedArgs,
}

#[derive(Args, Debug)]
struct PurgeArgs {
    /// Creates an ignore file from purged lines, to prevent their further appearance when reading with `--mode append`
    #[arg(short, long, action = ArgAction::SetTrue, display_order = 23)]
    create_ignore: bool,

    #[command(flatten)]
    shared: SharedArgs,
}

#[derive(Debug, Subcommand)]
enum JsonSubcommand {
    /// Generates JSON representations of older engines' files in `json` directory
    Generate {
        #[arg(
            short,
            long,
            alias = "mode",
            default_value = "default",
            value_name = "MODE",
            value_parser = PossibleValuesParser::new(["default", "append", "force", "force-append"]).map(|s| Mode::from_str(&s).unwrap())
        )]
        read_mode: Mode,
    },

    /// Writes JSON representations of older engines' files from `json` directory back to original files
    Write,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Parses game files to `.txt` format, and decrypts any `.rgss` archive if it's present
    Read(ReadArgs),

    /// Writes translated game files to the output directory
    Write(SharedArgs),

    /// Purges lines without translation from translation files
    Purge(PurgeArgs),

    /// Provides the commands for JSON generation and writing
    Json {
        #[command(subcommand)]
        subcommand: JsonSubcommand,
    },
}

/// This tool allows to parse RPG Maker XP/VX/VXAce/MV/MZ games text to `.txt` files and write them back to their initial form. The program uses `data` or `Data` directories for source files, and `translation` directory to operate with translation files. It will also decrypt any `.rgss` archive if it's present.
#[derive(Debug, Parser)]
#[command(version = crate_version!(), next_line_help = true, term_width = 120)]
struct Cli {
    /// Input directory, containing game files
    #[arg(short, long, global = true, default_value = "./", value_name = "INPUT_PATH", value_parser = value_parser!(PathBuf), display_order = 1)]
    input_dir: PathBuf,

    /// Output directory to output files to
    #[arg(short, long, global = true, value_name = "OUTPUT_PATH", value_parser = value_parser!(PathBuf), display_order = 2)]
    output_dir: Option<PathBuf>,

    #[command(subcommand)]
    command: Command,

    #[command(flatten)]
    verbosity: Verbosity<InfoLevel>,
}

fn parse_metadata(metadata_file_path: &Path) -> Result<Option<Metadata>> {
    if !metadata_file_path.exists() {
        return Ok(None);
    }

    let metadata_file_content = read_to_string(metadata_file_path)?;
    let metadata = from_str(&metadata_file_content)?;
    Ok(Some(metadata))
}

struct Session<'a> {
    engine_type: EngineType,

    input_dir: PathBuf,
    system_file_path: PathBuf,
    ini_file_path: PathBuf,
    metadata_file_path: PathBuf,

    source_path: PathBuf,
    translation_path: PathBuf,
    ignore_file_path: PathBuf,

    archive_path: Option<PathBuf>,
    output_dir: PathBuf,

    start_time: &'a mut Instant,
}

impl<'a> Session<'a> {
    pub fn new(
        cli: &mut Cli,
        start_time: &'a mut Instant,
    ) -> Result<Self, anyhow::Error> {
        let input_dir = take(&mut cli.input_dir);

        if !input_dir.exists() {
            bail!("Input directory does not exist.");
        }

        let output_dir =
            take(&mut cli.output_dir).unwrap_or_else(|| input_dir.clone());

        if !output_dir.exists() {
            bail!("Output directory does not exist.");
        }

        let source_path = ["data", "Data"]
            .into_iter()
            .map(|dir| input_dir.join(dir))
            .find(|path| path.exists())
            .context("Could not find `data`/`Data` directory.")?;

        let translation_path = output_dir.join("translation");
        let metadata_file_path = translation_path.join(RVPACKER_METADATA_FILE);
        let ignore_file_path = translation_path.join(RVPACKER_IGNORE_FILE);

        let type_paths = [
            (EngineType::New, source_path.join("System.json"), None),
            (
                EngineType::VXAce,
                source_path.join("System.rvdata2"),
                Some(input_dir.join("Game.rgss3a")),
            ),
            (
                EngineType::VX,
                source_path.join("System.rvdata"),
                Some(input_dir.join("Game.rgss2a")),
            ),
            (
                EngineType::XP,
                source_path.join("System.rxdata"),
                Some(input_dir.join("Game.rgssad")),
            ),
        ];

        let Some((engine_type, system_file_path, archive_path)) = type_paths
            .into_iter()
            .find_map(|(engine_type, system_file_path, archive_path)| {
                if !system_file_path.exists()
                    && archive_path.as_ref().is_none_or(|path| !path.exists())
                {
                    return None;
                }

                Some((engine_type, system_file_path, archive_path))
            })
        else {
            bail!(
                "Couldn't determine game engine. Check the existence of \
                 `System` file inside `data`/`Data` directory, or `.rgss` \
                 archive."
            );
        };

        let ini_file_path = input_dir.join("Game.ini");

        Ok(Self {
            engine_type,
            input_dir,
            system_file_path,
            ini_file_path,
            metadata_file_path,
            source_path,
            translation_path,
            ignore_file_path,
            archive_path,
            output_dir,
            start_time,
        })
    }

    /// The title from `Game.ini`, decoded with `encoding`, or the empty
    /// string if `encoding` is unset.
    ///
    /// `Processor::game_title` overrides whatever the system file itself
    /// carries; XP, VX and VX Ace games often leave that field blank and keep
    /// their real title only in `Game.ini`. But the file predates UTF-8
    /// becoming the platform default, so there is no safe encoding to guess:
    /// decoding a Shift-JIS title as UTF-8 does not error, it just produces
    /// garbage. The caller has to say which encoding to use; without one,
    /// this leaves the title alone rather than risk corrupting it.
    ///
    /// A missing or unreadable `Game.ini`, or an encoding that produces
    /// replacement characters, is not fatal - the system file's own title
    /// field, empty or not, is still a reasonable fallback - so this only
    /// warns.
    fn ini_game_title(&self, encoding: Option<IniEncoding>) -> String {
        let Some(encoding) = encoding else {
            return String::new();
        };

        if self.engine_type.is_new() {
            eprintln!(
                "warning: --game-ini-encoding has no effect on MV/MZ, which \
                 carries its title in `System.json`"
            );
            return String::new();
        }

        let title = read(&self.ini_file_path)
            .map_err(anyhow::Error::from)
            .and_then(|content| Ok(get_ini_title(&content)?));

        match title {
            Ok(title) => {
                let (title, _, had_errors) =
                    encoding.as_encoding().decode(&title);

                if had_errors {
                    eprintln!(
                        "warning: {}: decoding the title as {} produced \
                         replacement characters - this is probably not the \
                         right encoding",
                        self.ini_file_path.display(),
                        encoding.as_encoding().name()
                    );
                }

                title.into_owned()
            }
            Err(err) => {
                eprintln!(
                    "warning: {}: {err}",
                    self.ini_file_path.display()
                );
                String::new()
            }
        }
    }

    /// Decodes `Game.ini`'s title with `encoding` and prints it, for
    /// `--parse-game-ini`. Reads nothing else.
    fn print_ini_title(&self, encoding: IniEncoding) -> Result<(), anyhow::Error> {
        if self.engine_type.is_new() {
            bail!(
                "`--parse-game-ini` only applies to XP/VX/VX Ace; MV/MZ \
                 keep their title in `System.json`."
            );
        }

        let content = read(&self.ini_file_path)
            .with_context(|| self.ini_file_path.display().to_string())?;
        let title_bytes = get_ini_title(&content)?;
        let (title, _, had_errors) = encoding.as_encoding().decode(&title_bytes);

        println!("{title}");

        if had_errors {
            eprintln!(
                "warning: decoding produced replacement characters - this is \
                 probably not the right encoding"
            );
        }

        Ok(())
    }

    pub fn execute_read(
        &mut self,
        args: ReadArgs,
    ) -> Result<(), anyhow::Error> {
        if let Some(encoding) = args.parse_game_ini {
            return self.print_ini_title(encoding);
        }

        let silent = args.silent;
        let ignore = args.ignore;
        let skip_obsolete = args.skip_obsolete;
        let game_ini_encoding = args.game_ini_encoding;

        let SharedArgs {
            skip_files,
            read_mode,
            mut trim,
            mut duplicate_mode,
            skip_maps,
            skip_events,
            map_events,
        } = args.shared;

        let file_flags = FileFlags::all() & !skip_files.0;

        let Mode::Read { append, force } = read_mode else {
            unreachable!("the read-mode parser only accepts `Read` variants")
        };

        let mut hashes = None;

        if append
            && let Some(metadata) = parse_metadata(&self.metadata_file_path)?
        {
            Metadata {
                trim,
                duplicate_mode,
                hashes,
            } = metadata;
        }

        let hashes = hashes.unwrap_or_default();

        if force && !silent {
            let start = Instant::now();
            println!(
                "WARNING! Force mode will forcefully rewrite all your \
                 translation files. Input 'Y' to continue."
            );

            let mut buf = String::with_capacity(4);
            stdin().read_line(&mut buf)?;

            if buf.trim_end() != "Y" {
                exit(0);
            }

            *self.start_time -= start.elapsed();
        }

        if append && ignore && !self.ignore_file_path.exists() {
            bail!(
                "`.rvpacker-ignore` file does not exist. Aborting execution."
            );
        }

        if let Some(archive_path) = &self.archive_path
            && !self.system_file_path.exists()
        {
            let mut archive_data = read(archive_path)?;
            let mut decrypter = Decrypter::new();
            let decrypted_files = decrypter.decrypt(&mut archive_data)?;

            for file in decrypted_files {
                let path = String::from_utf8_lossy(file.path);
                let output_file_path = self.input_dir.join(path.as_ref());

                if let Some(parent) = output_file_path.parent() {
                    create_dir_all(parent)?;
                }

                write(output_file_path, file.data)?;
            }
        }

        let mut flags = BaseFlags::empty();
        flags.set(BaseFlags::Ignore, ignore);
        flags.set(BaseFlags::Trim, trim);
        flags.set(BaseFlags::SkipObsolete, skip_obsolete);

        let mut processor = Processor {
            mode: read_mode,
            file_flags,
            flags,
            duplicate_mode,
            game_title: self.ini_game_title(game_ini_encoding),
            hashes,
            skip_maps: skip_maps.0,
            skip_events: skip_events.0,
            map_events,
        };

        processor.process(
            self.engine_type,
            &self.source_path,
            &self.translation_path,
            None,
        )?;

        let metadata = Metadata {
            trim,
            duplicate_mode,
            hashes: Some(processor.hashes),
        };

        create_dir_all(&self.translation_path)?;
        write(&self.metadata_file_path, to_string(&metadata)?)?;

        Ok(())
    }

    pub fn execute_write(&self, args: SharedArgs) -> Result<(), anyhow::Error> {
        if !self.translation_path.exists() {
            bail!(
                "`translation` directory in the input directory does not \
                 exist."
            );
        }

        let SharedArgs {
            skip_files,
            mut trim,
            mut duplicate_mode,
            skip_maps,
            skip_events,
            ..
        } = args;

        let file_flags = FileFlags::all() & !skip_files.0;

        if let Some(metadata) = parse_metadata(&self.metadata_file_path)? {
            Metadata {
                trim,
                duplicate_mode,
                hashes: _,
            } = metadata;
        }

        let mut flags = BaseFlags::empty();
        flags.set(BaseFlags::Trim, trim);

        let mut processor = Processor {
            mode: Mode::Write,
            file_flags,
            flags,
            duplicate_mode,
            skip_maps: skip_maps.0,
            skip_events: skip_events.0,
            ..Default::default()
        };

        processor.process(
            self.engine_type,
            &self.source_path,
            &self.translation_path,
            Some(&self.output_dir.join("output")),
        )?;

        Ok(())
    }

    pub fn execute_purge(&self, args: PurgeArgs) -> Result<(), anyhow::Error> {
        let SharedArgs {
            skip_files,
            mut trim,
            mut duplicate_mode,
            skip_maps,
            skip_events,
            ..
        } = args.shared;

        let file_flags = FileFlags::all() & !skip_files.0;
        let create_ignore = args.create_ignore;

        if let Some(metadata) = parse_metadata(&self.metadata_file_path)? {
            Metadata {
                trim,
                duplicate_mode,
                hashes: _,
            } = metadata;
        }

        let mut flags = BaseFlags::empty();
        flags.set(BaseFlags::Trim, trim);
        flags.set(BaseFlags::CreateIgnore, create_ignore);

        let mut processor = Processor {
            mode: Mode::Purge,
            file_flags,
            flags,
            duplicate_mode,
            skip_maps: skip_maps.0,
            skip_events: skip_events.0,
            ..Default::default()
        };

        processor.process(
            self.engine_type,
            &self.source_path,
            &self.translation_path,
            None,
        )?;

        Ok(())
    }

    pub fn execute_json(
        &self,
        subcommand: &JsonSubcommand,
    ) -> Result<(), anyhow::Error> {
        use json::{generate, write};

        let json_path = self.input_dir.join("json");
        let json_output_path = self.input_dir.join("json-output");

        match subcommand {
            JsonSubcommand::Generate { read_mode } => {
                let force =
                    matches!(read_mode, Mode::Read { force: true, .. });
                generate(&self.source_path, &json_path, force)?;
            }
            JsonSubcommand::Write => {
                write(json_path, json_output_path, self.engine_type)?;
            }
        }

        Ok(())
    }
}

fn main() -> Result<()> {
    let mut start_time = Instant::now();
    let mut cli = Cli::parse();

    tracing_subscriber::fmt()
        .without_time()
        .with_target(false)
        .with_level(true)
        .with_thread_names(false)
        .with_thread_ids(false)
        .with_ansi(true)
        .with_max_level(cli.verbosity)
        .init();

    let mut session = Session::new(&mut cli, &mut start_time)?;

    match cli.command {
        Command::Read(args) => session.execute_read(args)?,
        Command::Write(args) => session.execute_write(args)?,
        Command::Purge(args) => session.execute_purge(args)?,
        Command::Json { subcommand } => session.execute_json(&subcommand)?,
    }

    println!("Elapsed: {:.2}s", start_time.elapsed().as_secs_f32());
    Ok(())
}
