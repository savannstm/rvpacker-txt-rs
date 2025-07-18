mod localization;
use crate::localization::*;
use anyhow::{Context, Result, bail};
use clap::{Arg, ArgAction, Command, crate_version, value_parser};
use color_print::cformat;
use rpgmad_lib::Decrypter;
use rvpacker_lib::{
    json, purge, read, read_to_string_without_bom, types::*, write,
};
use serde_json::{Value, from_str, json, to_string};
use std::{
    ffi::OsStr,
    fs::{create_dir_all, read, read_dir, read_to_string, write},
    io::stdin,
    mem::transmute,
    path::PathBuf,
    process::exit,
    time::Instant,
};
use sys_locale::get_locale;
use tracing::{error, info, warn};
use tracing_subscriber::{fmt, prelude::*};

fn get_game_type(game_title: String) -> GameType {
    let lowercased = game_title.to_lowercase();

    if lowercased.contains("termina") {
        GameType::Termina
    } else if lowercased.contains("lisa") {
        GameType::LisaRPG
    } else {
        GameType::None
    }
}

fn log_errors(
    results: impl IntoIterator<Item = Result<Outcome, Error>>,
    loc: &Localization,
    verbose: bool,
) {
    for result in results {
        match result {
            Err(err) => match err {
                Error::ReadDirFailed { path, err } => {
                    error!(
                        "{path}: {loc} ({err})",
                        path = path.display(),
                        loc = loc.read_dir_failed_msg
                    );
                }
                Error::AppendModeIsNotSupported => {
                    error!("{loc}", loc = loc.append_mode_not_supported_msg);
                }
                Error::CreateDirFailed { path, err } => {
                    error!(
                        "{path}: {loc} ({err})",
                        path = path.display(),
                        loc = loc.create_dir_failed_msg
                    );
                }
                Error::JSONParseFailed { file, err } => {
                    error!(
                        "{file}: {loc} ({err})",
                        file = file.display(),
                        loc = loc.json_parse_failed_msg
                    );
                }
                Error::LoadFailed { file, err } => {
                    error!(
                        "{file}: {loc} ({err})",
                        file = file.display(),
                        loc = loc.load_failed_msg
                    );
                }
                Error::PluginsFileMissing => {
                    error!("{loc}", loc = loc.plugins_file_missing_msg);
                }
                Error::ReadFileFailed { file, err } => {
                    error!(
                        "{file}: {loc} ({err})",
                        file = file.display(),
                        loc = loc.read_file_failed_msg
                    );
                }
                Error::WriteFileFailed { file, err } => {
                    error!(
                        "{file}: {loc} ({err})",
                        file = file.display(),
                        loc = loc.write_file_failed_msg
                    );
                }
            },

            Ok(outcome) => match outcome {
                // this is quite important, so we always log it
                Outcome::TXTAlreadyExist(path) => {
                    info!(
                        "{path}: {msg}",
                        path = path.display(),
                        msg = loc.translation_already_exist_msg
                    );
                }

                _ => {
                    if !verbose {
                        return;
                    }

                    match outcome {
                        Outcome::TXTAlreadyExist(_) => unreachable!(),

                        Outcome::MapIsUnused(map) => {
                            info!(
                                "{map}: {msg}",
                                map = map,
                                msg = loc.map_is_unused_msg
                            );
                        }

                        Outcome::GeneratedJSON(file) => {
                            info!(
                                "{file}: {msg}",
                                file = file.display(),
                                msg = loc.generated_json_msg
                            );
                        }

                        Outcome::JSONAlreadyExist(file) => {
                            info!(
                                "{file}: {msg}",
                                file = file.display(),
                                msg = loc.json_already_exist_msg
                            );
                        }

                        Outcome::MVMZAlreadyJSON => {
                            info!("{msg}", msg = loc.mvmz_already_json_msg);
                        }

                        Outcome::NoTranslationForEntry { file, entry } => {
                            info!(
                                "{entry} ({file}): {msg}",
                                entry = entry,
                                msg = loc.no_translation_for_entry_msg
                            );
                        }

                        Outcome::PurgedFile(file) => {
                            info!(
                                "{file}: {msg}",
                                file = file.display(),
                                msg = loc.purged_file_msg
                            );
                        }

                        Outcome::ReadFile(file) => {
                            info!(
                                "{file}: {msg}",
                                file = file.display(),
                                msg = loc.read_file_msg
                            );
                        }

                        Outcome::NotInFileFlags(flag) => {
                            info!(
                                "{flag:?}: {msg}",
                                msg = loc.skipped_file_msg
                            );
                        }

                        Outcome::WrittenFile(file) => {
                            info!(
                                "{file}: {msg}",
                                file = file.display(),
                                msg = loc.written_file_msg
                            );
                        }

                        Outcome::WrittenJSON(file) => {
                            info!(
                                "{file}: {msg}",
                                file = file.display(),
                                msg = loc.written_json_msg
                            );
                        }
                    }
                }
            },
        }
    }
}

fn preparse_args() -> Language {
    let preparse = Command::new("preparse")
        .disable_help_flag(true)
        .disable_help_subcommand(true)
        .disable_version_flag(true)
        .ignore_errors(true)
        .subcommands([
            Command::new("read"),
            Command::new("write"),
            Command::new("purge"),
            Command::new("json")
                .subcommands([Command::new("write"), Command::new("generate")]),
        ])
        .args([Arg::new("language")
            .short('l')
            .long("language")
            .global(true)
            .value_parser(["ru", "en"])]);
    let mut preparse_matches = preparse.get_matches();
    let language_arg = preparse_matches.remove_one::<String>("language");

    let language = language_arg.unwrap_or_else(|| {
        let locale = get_locale().unwrap_or(String::from("en-US"));

        if let Some((lang, _)) = locale.split_once('-') {
            lang.to_owned()
        } else {
            locale
        }
    });

    let language = match language.as_str() {
        "ru" | "be" | "uk" => Language::Russian,
        _ => Language::English,
    };

    language
}

fn setup_cli(localization: &Localization) -> Command {
    let input_dir_arg = Arg::new("input-dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir_arg_desc)
        .value_name(localization.input_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(1);

    let output_dir_arg = Arg::new("output-dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(localization.output_dir_arg_desc)
        .value_name(localization.output_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .display_order(2);

    let read_mode_arg = Arg::new("read-mode")
        .short('r')
        .long("read-mode")
        .alias("mode")
        .value_parser(["default", "append", "force"])
        .hide_default_value(true)
        .default_value("default")
        .value_name(localization.mode_arg_type)
        .help(cformat!(
            "{}\n<bold>[{} default, append, force]\n[{} default]\n[{} mode]</>",
            localization.read_mode_arg_desc,
            localization.allowed_values,
            localization.default_value,
            localization.aliases
        ))
        .display_order(3);

    let romanize_flag = Arg::new("romanize")
        .short('R')
        .long("romanize")
        .action(ArgAction::SetTrue)
        .help(localization.romanize_desc)
        .display_order(5);

    let trim_flag = Arg::new("trim")
        .short('t')
        .help(localization.trim_flag_desc)
        .long("trim")
        .action(ArgAction::SetTrue)
        .display_order(6);

    let ignore_flag = Arg::new("ignore")
        .short('I')
        .help(localization.ignore_flag_desc)
        .long("ignore")
        .action(ArgAction::SetTrue)
        .display_order(8);

    let create_ignore_flag = Arg::new("create-ignore")
        .short('c')
        .help(localization.create_ignore_flag_desc)
        .long("create-ignore")
        .action(ArgAction::SetTrue)
        .display_order(23);

    let disable_custom_processing_flag = Arg::new("disable-custom-processing")
        .short('D')
        .long("disable-custom-processing")
        .alias("no-custom")
        .action(ArgAction::SetTrue)
        .help(cformat!(
            "{}\n<bold>[{} no-custom]</>",
            localization.disable_custom_processing_desc,
            localization.aliases
        ))
        .display_order(93);

    let disable_processing_arg = Arg::new("disable-processing")
        .long("disable-processing")
        .alias("no")
        .value_delimiter(',')
        .value_name(localization.disable_processing_arg_type)
        .help(cformat!(
            "{}\n{} --disable-processing=\"maps,other,system\"\n<bold>[{} maps, other, system, plugins, scripts]\n[{} no]</>",
            localization.disable_processing_arg_desc,
            localization.example,
            localization.allowed_values,
            localization.aliases
        ))
        .value_parser(["maps", "other", "system", "plugins", "scripts"])
        .display_order(94);

    let duplicate_mode_arg = Arg::new("duplicate-mode")
        .short('d')
        .long("duplicate-mode")
        .alias("dup-mode")
        .help(cformat!(
            "{}\n{} --duplicate-mode remove\n<bold>[{} allow, remove]\n[{} allow]\n[{} dup-mode]</>",
            localization.duplicate_mode_arg_desc,
            localization.example,
            localization.allowed_values,
            localization.default_value,
            localization.aliases,
        ))
        .value_parser(["allow", "remove"])
        .display_order(93);

    let language_arg = Arg::new("language")
        .short('l')
        .long("language")
        .value_name(localization.language_arg_type)
        .global(true)
        .help(cformat!(
            "{}\n{} --language en<bold>\n[{} en, ru]</>",
            localization.language_arg_desc,
            localization.example,
            localization.allowed_values,
        ))
        .value_parser(["en", "ru"])
        .display_order(95);

    let progress_flag = Arg::new("progress")
        .short('P')
        .long("progress")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.progress_arg_desc)
        .display_order(97);

    let verbose_flag = Arg::new("verbose")
        .short('v')
        .long("verbose")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.verbose_arg_desc)
        .display_order(96);

    let version_flag = Arg::new("version")
        .short('V')
        .long("version")
        .action(ArgAction::Version)
        .help(localization.version_flag_desc)
        .display_order(98);

    let help_flag = Arg::new("help")
        .short('h')
        .long("help")
        .help(localization.help_arg_desc)
        .action(ArgAction::Help)
        .display_order(99);

    let silent_flag = Arg::new("silent")
        .short('s')
        .long("silent")
        .hide(true)
        .action(ArgAction::SetTrue);

    let read_subcommand = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([silent_flag, ignore_flag])
        .args([
            &read_mode_arg,
            &help_flag,
            &trim_flag,
            &romanize_flag,
            &disable_custom_processing_flag,
            &disable_processing_arg,
            &duplicate_mode_arg,
        ]);

    let write_subcommand = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.write_command_desc)
        .args([
            &help_flag,
            &trim_flag,
            &romanize_flag,
            &disable_custom_processing_flag,
            &disable_processing_arg,
            &duplicate_mode_arg,
        ]);

    let purge_subcommand = Command::new("purge")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.purge_command_desc)
        .args([create_ignore_flag])
        .args([
            &help_flag,
            &trim_flag,
            &romanize_flag,
            &disable_custom_processing_flag,
            &disable_processing_arg,
            &duplicate_mode_arg,
        ]);

    let generate_json_subcommand = Command::new("generate")
        .about(localization.generate_json_command_desc)
        .disable_help_flag(true)
        .arg(&read_mode_arg);

    let write_json_subcommand = Command::new("write")
        .about(localization.write_json_command_desc)
        .disable_help_flag(true);

    let json_subcommand = Command::new("json")
        .disable_help_flag(true)
        .help_template(localization.json_help_template)
        .about(localization.json_command_desc)
        .subcommands([generate_json_subcommand, write_json_subcommand])
        .arg(&help_flag);

    let key_arg = Arg::new("key")
        .long("key")
        .help(localization.key_arg_desc)
        .value_name(localization.key_arg_type);

    let file_arg = Arg::new("file")
        .long("file")
        .help(localization.file_arg_desc)
        .value_name(localization.file_arg_type)
        .value_parser(value_parser!(PathBuf));

    let engine_arg = Arg::new("engine")
        .long("engine")
        .help(localization.engine_arg_desc)
        .value_parser(["mv", "mz"])
        .value_name(localization.engine_arg_type);

    let decrypt_subcommand =
        Command::new("decrypt").about(localization.decrypt_command_desc);
    let encrypt_subcommand =
        Command::new("encrypt").about(localization.encrypt_command_desc);
    let extract_key_subcommand = Command::new("extract-key")
        .about(localization.extract_key_command_desc);

    let asset_subcommand = Command::new("asset")
        .disable_help_flag(true)
        .about(localization.asset_command_desc)
        .subcommands([
            decrypt_subcommand,
            encrypt_subcommand,
            extract_key_subcommand,
        ])
        .args([key_arg, file_arg, engine_arg])
        .arg(&help_flag);

    Command::new("")
        .version(crate_version!())
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .next_line_help(true)
        .term_width(120)
        .about(localization.about_msg)
        .help_template(localization.help_template)
        .subcommands([
            read_subcommand,
            write_subcommand,
            purge_subcommand,
            json_subcommand,
            asset_subcommand,
        ])
        .args([
            input_dir_arg,
            output_dir_arg,
            language_arg,
            progress_flag,
            help_flag,
            version_flag,
            verbose_flag,
        ])
        .hide_possible_values(true)
}

fn main() -> Result<()> {
    let mut start_time = Instant::now();

    let language = preparse_args();
    let localization = Localization::new(language);
    let cli = setup_cli(&localization);

    let matches = cli.get_matches();
    let (subcommand, subcommand_matches) =
        matches.subcommand().unwrap_or_else(|| {
            warn!("{}", localization.no_subcommand_specified_msg);
            exit(0);
        });

    let input_dir =
        unsafe { matches.get_one::<PathBuf>("input-dir").unwrap_unchecked() };

    if !input_dir.exists() {
        bail!("{}", localization.input_dir_missing);
    }

    let output_dir = matches
        .get_one::<PathBuf>("output-dir")
        .unwrap_or(input_dir);

    if !output_dir.exists() {
        bail!("{}", localization.output_dir_missing)
    }

    tracing_subscriber::registry()
        .with(
            fmt::layer()
                .without_time()
                .with_target(false)
                .with_level(true)
                .with_thread_names(false)
                .with_thread_ids(false)
                .with_ansi(true),
        )
        .init();

    let mut source_path = &input_dir.join("original");
    let data_path = input_dir.join("data");

    if !source_path.exists() {
        source_path = &data_path;
    }

    let translation_path = &output_dir.join("translation");
    create_dir_all(translation_path)?;

    let metadata_file_path = &translation_path.join(".rvpacker-metadata");
    let ignore_file_path = &translation_path.join(".rvpacker-ignore");

    let progress = matches.get_flag("progress");
    let verbose = matches.get_flag("verbose");

    let (engine_type, system_file_path, archive_path) =
        if source_path.join("System.json").exists() {
            (EngineType::New, source_path.join("System.json"), None)
        } else if source_path.join("System.rvdata2").exists()
            || input_dir.join("Game.rgss3a").exists()
        {
            (
                EngineType::VXAce,
                source_path.join("System.rvdata2"),
                Some(input_dir.join("Game.rgss3a")),
            )
        } else if source_path.join("System.rvdata").exists()
            || input_dir.join("Game.rgss2a").exists()
        {
            (
                EngineType::VX,
                source_path.join("System.rvdata"),
                Some(input_dir.join("Game.rgss2a")),
            )
        } else if source_path.join("System.rxdata").exists()
            || input_dir.join("Game.rgssad").exists()
        {
            (
                EngineType::XP,
                source_path.join("System.rxdata"),
                Some(input_dir.join("Game.rgssad")),
            )
        } else if subcommand != "asset" {
            bail!("{}", localization.could_not_determine_game_engine_msg);
        } else {
            (EngineType::New, source_path.join("System.json"), None)
        };

    let mut game_type = if subcommand == "asset"
        || ["read", "write", "purge"].contains(&subcommand)
            && subcommand_matches.get_flag("disable-custom-processing")
    {
        GameType::None
    } else {
        let game_title = if engine_type.is_new() {
            let system_obj: Value =
                from_str(&read_to_string_without_bom(&system_file_path)?)?;
            unsafe {
                system_obj["gameTitle"].as_str().unwrap_unchecked().into()
            }
        } else {
            let ini_file_path = &input_dir.join("Game.ini");

            if ini_file_path.exists() {
                let ini_file_bytes = read(ini_file_path)?;
                let mut content = String::new();

                for encoding in [
                    encoding_rs::UTF_8,
                    encoding_rs::SHIFT_JIS,
                    encoding_rs::GB18030,
                    encoding_rs::WINDOWS_1252,
                    encoding_rs::WINDOWS_1251,
                ] {
                    let (decoded, _, error) = encoding.decode(&ini_file_bytes);

                    if !error {
                        content = decoded.into_owned();
                    }
                }

                if content.is_empty() {
                    bail!("{}", localization.could_not_decrypt_ini_file_msg);
                }

                let title_line = unsafe {
                    content
                        .lines()
                        .find(|line| line.to_lowercase().starts_with("title"))
                        .unwrap_unchecked()
                };
                let game_title = unsafe {
                    title_line
                        .split_once('=')
                        .unwrap_unchecked()
                        .1
                        .trim()
                        .into()
                };

                game_title
            } else {
                bail!("{}", localization.game_ini_file_missing_msg)
            }
        };

        get_game_type(game_title)
    };

    if !game_type.is_none() {
        info!("{}", localization.custom_processing_enabled_msg);
    }

    let mut read_mode = ReadMode::Default;
    let mut trim = false;
    let mut romanize = false;
    let mut file_flags = FileFlags::all();
    let mut duplicate_mode = DuplicateMode::Allow;

    if ["read", "write", "purge"].contains(&subcommand) {
        romanize = subcommand_matches.get_flag("romanize");
        trim = subcommand_matches.get_flag("trim");

        if let Some(disable_processing_args) =
            subcommand_matches.get_many::<String>("disable-processing")
        {
            for disable_processing_of in disable_processing_args {
                file_flags.remove(match disable_processing_of.as_str() {
                    "maps" => FileFlags::Map,
                    "other" => FileFlags::Other,
                    "system" => FileFlags::System,
                    "plugins" | "scripts" => FileFlags::Scripts,
                    _ => unreachable!(),
                })
            }
        }

        if let Some(duplicate_mode_arg) =
            subcommand_matches.get_one::<String>("duplicate-mode")
        {
            if duplicate_mode_arg == "remove" {
                duplicate_mode = DuplicateMode::Remove;
            }
        }
    }

    if ["read"].contains(&subcommand) {
        let mode = subcommand_matches
            .get_one::<String>("read-mode")
            .map(|x| x.as_str())
            .unwrap_or("default");

        read_mode = match mode {
            "default" => ReadMode::Default,
            "append" => ReadMode::Append,
            "force" => ReadMode::Force,
            _ => unreachable!(),
        }
    }

    if read_mode.is_append() || ["write", "purge"].contains(&subcommand) {
        if let Ok(metadata_file_content) = read_to_string(metadata_file_path) {
            let metadata: Value = from_str(&metadata_file_content)?;
            let romanize_metadata =
                unsafe { metadata["romanize"].as_bool().unwrap_unchecked() };
            let disable_custom_processing_metadata = unsafe {
                metadata["disableCustomProcessing"]
                    .as_bool()
                    .unwrap_unchecked()
            };
            let trim_metadata = metadata["trim"].as_bool().unwrap_or(false);
            let duplicate_mode_metadata = metadata["duplicateMode"].as_u64();

            if romanize_metadata {
                info!("{}", localization.enabling_romanize_metadata_msg);
                romanize = romanize_metadata;
            }

            if disable_custom_processing_metadata && !game_type.is_none() {
                info!(
                    "{}",
                    localization.disabling_custom_processing_metadata_msg
                );
                game_type = GameType::None;
            }

            if trim_metadata {
                info!("{}", localization.enabling_trim_metadata_msg);
                trim = trim_metadata;
            }

            if let Some(dup_mode) = duplicate_mode_metadata {
                info!("{}", localization.setting_duplicate_mode_metadata_msg);
                duplicate_mode =
                    unsafe { transmute::<u8, DuplicateMode>(dup_mode as u8) };
            }
        }
    }

    match subcommand {
        "read" => {
            use read::*;

            let silent = subcommand_matches.get_flag("silent");
            let ignore = subcommand_matches.get_flag("ignore");
            let disable_custom_processing =
                subcommand_matches.get_flag("disable-custom-processing");

            if read_mode.is_force() && !silent {
                let start = Instant::now();
                warn!("{}", localization.force_mode_warning);

                let mut buf = String::with_capacity(4);
                stdin().read_line(&mut buf)?;

                if buf.trim_end() != "Y" {
                    exit(0);
                }

                start_time -= start.elapsed();
            }

            if !read_mode.is_append() {
                let metadata = json!({ "romanize": romanize,
                                                "disableCustomProcessing": disable_custom_processing,
                                                "trim": trim,
                                                "duplicateMode": duplicate_mode });
                write(metadata_file_path, to_string(&metadata)?)?;
            } else if ignore && !ignore_file_path.exists() {
                error!("{}", localization.ignore_file_does_not_exist_msg);
                exit(0);
            }

            if let Some(archive_path) = archive_path {
                if archive_path.exists() && !system_file_path.exists() {
                    let bytes = read(archive_path)?;
                    let mut decrypter =
                        Decrypter::new().force(read_mode.is_force());
                    decrypter.extract(&bytes, input_dir)?;
                }
            }

            let results = ReaderBuilder::new()
                .with_flags(file_flags)
                .romanize(romanize)
                .game_type(game_type)
                .read_mode(read_mode)
                .logging(progress)
                .ignore(ignore)
                .trim(trim)
                .duplicate_mode(duplicate_mode)
                .build()
                .read(source_path, translation_path, engine_type)?;

            log_errors(results, &localization, verbose);
        }
        "write" => {
            use write::*;

            if !translation_path.exists() {
                bail!("{}", localization.translation_dir_missing);
            }

            let results = WriterBuilder::new()
                .with_flags(file_flags)
                .romanize(romanize)
                .logging(progress)
                .game_type(game_type)
                .trim(trim)
                .duplicate_mode(duplicate_mode)
                .build()
                .write(
                    source_path,
                    translation_path,
                    output_dir,
                    engine_type,
                )?;

            log_errors(results, &localization, verbose);
        }
        "purge" => {
            use purge::*;
            let create_ignore = subcommand_matches.get_flag("create-ignore");

            let results = PurgerBuilder::new()
                .with_flags(file_flags)
                .romanize(romanize)
                .logging(progress)
                .game_type(game_type)
                .trim(trim)
                .duplicate_mode(duplicate_mode)
                .create_ignore(create_ignore)
                .build()
                .purge(source_path, translation_path, engine_type)?;

            log_errors(results, &localization, verbose);
        }
        "json" => {
            use json::*;
            let (json_subcommand, json_subcommand_matches) =
                unsafe { subcommand_matches.subcommand().unwrap_unchecked() };

            let json_path = input_dir.join("json");
            let json_output_path = input_dir.join("json-output");

            match json_subcommand {
                "generate" => {
                    let mode = json_subcommand_matches
                        .get_one::<String>("read-mode")
                        .map(|x| x.as_str())
                        .unwrap_or("default");

                    read_mode = match mode {
                        "default" => ReadMode::Default,
                        "append" => ReadMode::Append,
                        "force" => ReadMode::Force,
                        _ => unreachable!(),
                    };

                    let results =
                        generate(source_path, &json_path, read_mode, progress);
                    log_errors(results, &localization, verbose);
                }
                "write" => {
                    let results = write(
                        json_path,
                        json_output_path,
                        engine_type,
                        progress,
                    );
                    log_errors(results, &localization, verbose);
                }
                _ => unreachable!(),
            }
        }
        "asset" => {
            use asset_decrypter::*;

            let image_subcommand = unsafe {
                subcommand_matches.subcommand_name().unwrap_unchecked()
            };

            let key = subcommand_matches.get_one::<String>("key");
            let file = subcommand_matches.get_one::<PathBuf>("file");
            let engine: &str =
                subcommand_matches
                    .get_one::<String>("engine")
                    .context(localization.engine_argument_required_msg)?;

            let mut decrypter = Decrypter::new();

            if key.is_none() && matches!(image_subcommand, "encrypt") {
                decrypter.set_key_from_str(DEFAULT_KEY)?
            } else {
                decrypter.set_key_from_str(unsafe { key.unwrap_unchecked() })?
            };

            match image_subcommand {
                "extract-key" => {
                    let file =
                        file.context(localization.file_argument_missing_msg)?;

                    let filename = file
                        .file_name()
                        .context(localization.file_argument_is_not_file_msg)?;

                    let content: String;

                    let key = if filename == "System.json" {
                        content = read_to_string(file)?;
                        let index = unsafe {
                            content.rfind("encryptionKey").unwrap_unchecked()
                        } + "encryptionKey\":".len();
                        &content[index..].trim().trim_matches('"')[..KEY_LENGTH]
                    } else {
                        let buf = read(file)?;
                        decrypter.set_key_from_image(&buf);
                        decrypter.key().unwrap()
                    };

                    info!("Encryption key: {key}");
                }

                "decrypt" | "encrypt" => {
                    let mut process_file = |path: &PathBuf,
                                            filename: &OsStr,
                                            extension: &str|
                     -> Result<()> {
                        let data = read(path)?;

                        let (processed, new_ext) = match image_subcommand {
                            "decrypt" => {
                                let decrypted = decrypter.decrypt(&data);
                                let new_ext = match extension {
                                    "rpgmvp" | "png_" => "png",
                                    "rpgmvo" | "ogg_" => "ogg",
                                    "rpgmvm" | "m4a_" => "m4a",
                                    _ => unreachable!(),
                                };
                                (decrypted, new_ext)
                            }
                            "encrypt" => {
                                let encrypted = decrypter.encrypt(&data)?;
                                let new_ext = match (engine, extension) {
                                    ("mv", "png") => "rpgmvp",
                                    ("mv", "ogg") => "rpgmvo",
                                    ("mv", "m4a") => "rpgmvm",
                                    ("mz", "png") => "png_",
                                    ("mz", "ogg") => "ogg_",
                                    ("mz", "m4a") => "m4a_",
                                    _ => unreachable!(),
                                };
                                (encrypted, new_ext)
                            }
                            _ => unreachable!(),
                        };

                        let output_file = output_dir.join(
                            PathBuf::from(filename).with_extension(new_ext),
                        );
                        write(output_file, processed)?;

                        Ok(())
                    };

                    let exts: &[&str] = match image_subcommand {
                        "encrypt" => &["png", "ogg", "m4a"],
                        "decrypt" => &[
                            "rpgmvp", "rpgmvo", "rpgmvm", "ogg_", "png_",
                            "m4a_",
                        ],
                        _ => unreachable!(),
                    };

                    if let Some(file) = &file {
                        let filename = file.file_name().context(
                            localization.file_argument_is_not_file_msg,
                        )?;
                        let extension = unsafe {
                            file.extension()
                                .unwrap_unchecked()
                                .to_str()
                                .unwrap_unchecked()
                        };

                        if exts.contains(&extension) {
                            process_file(file, filename, extension)?;
                        }
                    } else {
                        for entry in read_dir(input_dir)?.flatten() {
                            let path = entry.path();
                            let filename = entry.file_name();
                            let extension = match path.extension() {
                                Some(ext) => ext,
                                None => continue,
                            };

                            let extension = match extension.to_str() {
                                Some(ext) => ext,
                                None => continue,
                            };

                            if exts.contains(&extension) {
                                process_file(&path, &filename, extension)?;
                            }
                        }
                    }
                }
                _ => unreachable!(),
            }
        }
        _ => unreachable!(),
    }

    info!(
        "{} {:.2}s",
        localization.elapsed_time_msg,
        start_time.elapsed().as_secs_f32()
    );

    Ok(())
}
