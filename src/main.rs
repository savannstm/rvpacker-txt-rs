use crate::localization::*;
use clap::{crate_version, value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::cformat;
use rpgmad_lib::Decrypter;
use rvpacker_lib::{
    json, purge, read, read_to_string_without_bom, types::*, write,
};
use sonic_rs::{from_str, json, prelude::*, to_string, Object, Value};
use std::{
    fs::{create_dir_all, read, read_dir, read_to_string, remove_file, write},
    io::stdin,
    path::{Path, PathBuf},
    process::exit,
    time::Instant,
};
use sys_locale::get_locale;

mod localization;

const ENCODINGS: [&encoding_rs::Encoding; 5] = [
    encoding_rs::UTF_8,
    encoding_rs::SHIFT_JIS,
    encoding_rs::GB18030,
    encoding_rs::WINDOWS_1252,
    encoding_rs::WINDOWS_1251,
];

pub fn get_game_type(game_title: String) -> GameType {
    let lowercased: &str = &game_title.to_lowercase();

    if lowercased.contains("termina") {
        GameType::Termina
    } else if lowercased.contains("lisa") {
        GameType::LisaRPG
    } else {
        GameType::None
    }
}

fn preparse_args() -> Language {
    let preparse: Command = Command::new("preparse")
        .disable_help_flag(true)
        .disable_help_subcommand(true)
        .disable_version_flag(true)
        .ignore_errors(true)
        .subcommands([
            Command::new("read"),
            Command::new("write"),
            Command::new("purge"),
            Command::new("json").subcommands([
                Command::new("write-json"),
                Command::new("generate-json"),
            ]),
        ])
        .args([Arg::new("language")
            .short('l')
            .long("language")
            .global(true)
            .value_parser(["ru", "en"])]);
    let preparse_matches: ArgMatches = preparse.get_matches();

    let language_arg: Option<&String> =
        preparse_matches.get_one::<String>("language");

    let language: String =
        language_arg.map(String::to_owned).unwrap_or_else(|| {
            let locale: String = get_locale().unwrap_or(String::from("en-US"));

            if let Some((lang, _)) = locale.split_once('-') {
                lang.to_owned()
            } else {
                locale
            }
        });

    let language: Language = match language.as_str() {
        "ru" | "be" | "uk" => Language::Russian,
        _ => Language::English,
    };

    language
}

fn setup_cli(localization: &Localization) -> Command {
    let input_dir_arg: Arg = Arg::new("input-dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir_arg_desc)
        .value_name(localization.input_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(1);

    let output_dir_arg: Arg = Arg::new("output-dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(localization.output_dir_arg_desc)
        .value_name(localization.output_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .display_order(2);

    let read_mode_arg: Arg = Arg::new("read-mode")
        .short('p')
        .long("read-mode")
        .alias("mode")
        .value_parser(["default", "append", "force"])
        .hide_default_value(true)
        .default_value("default")
        .value_name(localization.mode_arg_type)
        .help(cformat!(
            "{}\n<bold>[{} default, append, force]\n[{} default]\n[{} mode]</>",
            localization.read_mode_arg_desc,
            localization.possible_values,
            localization.default_value,
            localization.aliases
        ))
        .display_order(3);

    let romanize_flag: Arg = Arg::new("romanize")
        .short('r')
        .long("romanize")
        .global(true)
        .action(ArgAction::SetTrue)
        .help(localization.romanize_desc)
        .display_order(5);

    let trim_flag: Arg = Arg::new("trim")
        .help(localization.trim_flag_desc)
        .long("trim")
        .action(ArgAction::SetTrue)
        .display_order(6);

    let sort_flag: Arg = Arg::new("sort")
        .help(localization.sort_flag_desc)
        .long("sort")
        .action(ArgAction::SetTrue)
        .display_order(7);

    let ignore_flag: Arg = Arg::new("ignore")
        .help(localization.ignore_flag_desc)
        .long("ignore")
        .action(ArgAction::SetTrue)
        .display_order(8);

    let stat_flag: Arg = Arg::new("stat")
        .help(localization.stat_arg_desc)
        .long("stat")
        .short('s')
        .action(ArgAction::SetTrue)
        .display_order(20);

    let leave_filled_flag: Arg = Arg::new("leave-filled")
        .help(localization.leave_filled_flag_desc)
        .long("leave-filled")
        .action(ArgAction::SetTrue)
        .display_order(21);

    let purge_empty_flag: Arg = Arg::new("purge-empty")
        .help(localization.purge_empty_flag_desc)
        .long("purge-empty")
        .action(ArgAction::SetTrue)
        .display_order(22);

    let create_ignore_flag: Arg = Arg::new("create-ignore")
        .help(localization.create_ignore_flag_desc)
        .long("create-ignore")
        .action(ArgAction::SetTrue)
        .display_order(23);

    let disable_custom_processing_flag: Arg =
        Arg::new("disable-custom-processing")
            .long("disable-custom-processing")
            .alias("no-custom")
            .action(ArgAction::SetTrue)
            .global(true)
            .help(cformat!(
                "{}\n<bold>[{} no-custom]</>",
                localization.disable_custom_processing_desc,
                localization.aliases
            ))
            .display_order(93);

    let disable_processing_arg: Arg = Arg::new("disable-processing")
    .long("disable-processing")
    .alias("no")
    .value_delimiter(',')
    .value_name(localization.disable_processing_arg_type)
    .help(cformat!(
        "{}\n{} --disable-processing=\"maps,other,system\"\n<bold>[{} maps, other, system, plugins, scripts]\n[{} no]</>",
        localization.disable_processing_arg_desc,
        localization.example,
        localization.possible_values,
        localization.aliases
    ))
    .global(true)
    .value_parser(["maps", "other", "system", "plugins", "scripts"])
    .display_order(94);

    let language_arg: Arg = Arg::new("language")
        .short('l')
        .long("language")
        .value_name(localization.language_arg_type)
        .global(true)
        .help(cformat!(
            "{}\n{} --language en<bold>\n[{} en, ru]</>",
            localization.language_arg_desc,
            localization.example,
            localization.possible_values,
        ))
        .value_parser(["en", "ru"])
        .display_order(95);

    let log_flag: Arg = Arg::new("log")
        .long("log")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.log_arg_desc)
        .display_order(96);

    let version_flag: Arg = Arg::new("version")
        .short('v')
        .long("version")
        .action(ArgAction::Version)
        .help(localization.version_flag_desc)
        .display_order(98);

    let help_flag: Arg = Arg::new("help")
        .short('h')
        .long("help")
        .help(localization.help_arg_desc)
        .action(ArgAction::Help)
        .display_order(99);

    let silent_flag: Arg = Arg::new("silent")
        .long("silent")
        .hide(true)
        .action(ArgAction::SetTrue);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([read_mode_arg, silent_flag, ignore_flag, sort_flag])
        .args([
            &help_flag,
            &trim_flag,
            &romanize_flag,
            &disable_custom_processing_flag,
            &disable_processing_arg,
        ]);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.write_command_desc)
        .args([
            &help_flag,
            &trim_flag,
            &romanize_flag,
            &disable_custom_processing_flag,
            &disable_processing_arg,
        ]);

    let purge_subcommand: Command = Command::new("purge")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.purge_command_desc)
        .args([
            stat_flag,
            leave_filled_flag,
            purge_empty_flag,
            create_ignore_flag,
        ])
        .args([
            &help_flag,
            &trim_flag,
            &romanize_flag,
            &disable_custom_processing_flag,
            &disable_processing_arg,
        ]);

    let generate_json_subcommand: Command = Command::new("generate-json")
        .about(localization.generate_json_command_desc)
        .disable_help_flag(true);

    let write_json_subcommand: Command = Command::new("write-json")
        .about(localization.write_json_command_desc)
        .disable_help_flag(true);

    let json_subcommand: Command = Command::new("json")
        .disable_help_flag(true)
        .help_template(localization.json_help_template)
        .about(localization.json_command_desc)
        .subcommands([generate_json_subcommand, write_json_subcommand])
        .arg(&help_flag);

    let key_arg: Arg = Arg::new("key")
        .long("key")
        .help(localization.key_arg_desc)
        .value_name(localization.key_arg_type)
        .global(true);

    let file_arg: Arg = Arg::new("file")
        .long("file")
        .help(localization.file_arg_desc)
        .value_name(localization.file_arg_type)
        .value_parser(value_parser!(PathBuf))
        .global(true);

    let engine_arg: Arg = Arg::new("engine")
        .long("engine")
        .help(localization.engine_arg_desc)
        .value_parser(["mv", "mz"])
        .value_name(localization.engine_arg_type)
        .global(true);

    let decrypt_subcommand: Command =
        Command::new("decrypt").about(localization.decrypt_command_desc);
    let encrypt_subcommand: Command =
        Command::new("encrypt").about(localization.encrypt_command_desc);
    let extract_key_subcommand: Command = Command::new("extract-key")
        .about(localization.extract_key_command_desc);

    let asset_subcommand: Command = Command::new("asset")
        .disable_help_flag(true)
        .about(localization.asset_command_desc)
        .subcommands([
            decrypt_subcommand,
            encrypt_subcommand,
            extract_key_subcommand,
        ])
        .args([key_arg, file_arg, engine_arg])
        .arg(&help_flag);

    let cli: Command = Command::new("")
        .version(crate_version!())
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
            log_flag,
            help_flag,
            version_flag,
        ])
        .hide_possible_values(true);

    cli
}

fn main() {
    let mut start_time: Instant = Instant::now();

    let language: Language = preparse_args();

    let localization: Localization = Localization::new(language);

    let cli = setup_cli(&localization);

    let matches: ArgMatches = cli.get_matches();
    let (subcommand, subcommand_matches): (&str, &ArgMatches) =
        matches.subcommand().unwrap_or_else(|| {
            println!("{}", localization.no_subcommand_specified_msg);
            exit(0);
        });

    let input_dir: &PathBuf = matches.get_one::<PathBuf>("input-dir").unwrap();

    if !input_dir.exists() {
        panic!("{}", localization.input_dir_missing);
    }

    let output_dir: &PathBuf = matches
        .get_one::<PathBuf>("output-dir")
        .unwrap_or(input_dir);

    if !output_dir.exists() {
        panic!("{}", localization.output_dir_missing)
    }

    let mut source_path: &PathBuf = &input_dir.join("original");
    let data_path: PathBuf = input_dir.join("data");

    if !source_path.exists() {
        source_path = &data_path;
    }

    let translation_path: &PathBuf = &output_dir.join("translation");
    let metadata_file_path: &Path =
        &translation_path.join(".rvpacker-metadata");
    let ignore_file_path: &Path = &translation_path.join(".rvpacker-ignore");

    let logging: bool = matches.get_flag("log");

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
            panic!("{}", localization.could_not_determine_game_engine_msg);
        } else {
            (EngineType::New, source_path.join("System.json"), None)
        };

    let mut game_type: GameType = if subcommand == "asset"
        || ["read", "write", "purge"].contains(&subcommand)
            && matches.get_flag("disable-custom-processing")
    {
        GameType::None
    } else {
        let game_title: String = if engine_type == EngineType::New {
            let system_obj: Object = from_str(
                &read_to_string_without_bom(&system_file_path).unwrap(),
            )
            .unwrap();
            system_obj["gameTitle"].as_str().unwrap().to_owned()
        } else {
            let ini_file_path: &Path = &input_dir.join("Game.ini");

            if ini_file_path.exists() {
                let ini_file_bytes: Vec<u8> = read(ini_file_path).unwrap();
                let mut content: String = String::new();

                for encoding in ENCODINGS {
                    let (decoded, _, error) = encoding.decode(&ini_file_bytes);

                    if !error {
                        content = decoded.into_owned();
                    }
                }

                if content.is_empty() {
                    panic!("{}", localization.could_not_decrypt_ini_file_msg);
                }

                let title_line: &str = content
                    .lines()
                    .find(|line: &&str| {
                        line.to_lowercase().starts_with("title")
                    })
                    .unwrap();
                let game_title: String =
                    unsafe { title_line.split_once('=').unwrap_unchecked() }
                        .1
                        .trim()
                        .to_owned();

                game_title
            } else {
                panic!("{}", localization.game_ini_file_missing_msg)
            }
        };

        get_game_type(game_title)
    };

    if !game_type.is_none() {
        println!("{}", localization.custom_processing_enabled_msg);
    }

    let (
        mut disable_maps_processing,
        mut disable_other_processing,
        mut disable_system_processing,
        mut disable_plugins_processing,
    ) = (false, false, false, false);

    let mut read_mode: ReadMode = ReadMode::Default;
    let mut trim: bool = false;
    let mut romanize: bool = false;

    if ["read", "write", "purge"].contains(&subcommand) {
        romanize = matches.get_flag("romanize");
        trim = subcommand_matches.get_flag("trim");
        (
            disable_maps_processing,
            disable_other_processing,
            disable_system_processing,
            disable_plugins_processing,
        ) = subcommand_matches
            .get_many::<String>("disable-processing")
            .map(|disable_processing_args| {
                let mut flags = (false, false, false, false);

                for disable_processing_of in disable_processing_args {
                    match disable_processing_of.as_str() {
                        "maps" => flags.0 = true,
                        "other" => flags.1 = true,
                        "system" => flags.2 = true,
                        "plugins" | "scripts" => flags.3 = true,
                        _ => unreachable!(),
                    }
                }

                flags
            })
            .unwrap_or((false, false, false, false));
    }

    if ["read", "json"].contains(&subcommand) {
        read_mode = match subcommand_matches
            .get_one::<String>("read-mode")
            .unwrap_or(&String::from("default"))
            .as_str()
        {
            "default" => ReadMode::Default,
            "append" => ReadMode::Append,
            "force" => ReadMode::Force,
            _ => unreachable!(),
        }
    }

    let mut read_metadata = || {
        let metadata: Object = unsafe {
            from_str(&read_to_string(metadata_file_path).unwrap())
                .unwrap_unchecked()
        };

        let romanize_metadata: bool =
            unsafe { metadata["romanize"].as_bool().unwrap_unchecked() };
        let disable_custom_processing_metadata: bool = unsafe {
            metadata["disableCustomProcessing"]
                .as_bool()
                .unwrap_unchecked()
        };
        let trim_metadata: bool = metadata
            .get(&"trim")
            .unwrap_or(&Value::from(true))
            .as_bool()
            .unwrap_or(true);

        if romanize_metadata {
            println!("{}", localization.enabling_romanize_metadata_msg);
            romanize = romanize_metadata;
        }

        if disable_custom_processing_metadata && !game_type.is_none() {
            println!(
                "{}",
                localization.disabling_custom_processing_metadata_msg
            );
            game_type = GameType::None;
        }

        if trim_metadata {
            println!("{}", localization.enabling_trim_metadata_msg);
            trim = trim_metadata;
        }
    };

    let mut file_flags: FileFlags = FileFlags::None;

    if !disable_maps_processing {
        file_flags |= FileFlags::Map;
    }

    if !disable_other_processing {
        file_flags |= FileFlags::Other;
    }

    if !disable_system_processing {
        file_flags |= FileFlags::System;
    }

    if !disable_plugins_processing {
        file_flags |= FileFlags::Scripts;
    }

    match subcommand {
        "read" => {
            use read::*;

            let silent: bool = subcommand_matches.get_flag("silent");

            if read_mode == ReadMode::Force && !silent {
                let start: Instant = Instant::now();
                println!("{}", localization.force_mode_warning);

                let mut buf: String = String::with_capacity(4);
                stdin().read_line(&mut buf).unwrap();

                if buf.trim_end() != "Y" {
                    exit(0);
                }

                start_time -= start.elapsed();
            }

            if metadata_file_path.exists() && read_mode == ReadMode::Append {
                read_metadata();
            }

            create_dir_all(translation_path).unwrap();

            let ignore: bool = subcommand_matches.get_flag("ignore");
            let disable_custom_processing: bool =
                matches.get_flag("disable-custom-processing");

            if read_mode != ReadMode::Append {
                write(
                    metadata_file_path,
                    to_string(&json!({"romanize": romanize, "disableCustomProcessing": disable_custom_processing, "trim": trim})).unwrap(),
                )
                .unwrap();
            } else if ignore && !ignore_file_path.exists() {
                println!("{}", localization.ignore_file_does_not_exist_msg);
                exit(0);
            }

            let sort: bool = subcommand_matches.get_flag("sort");

            if let Some(archive_path) = archive_path {
                if archive_path.exists() && !system_file_path.exists() {
                    let bytes: Vec<u8> = read(archive_path).unwrap();
                    let mut decrypter: Decrypter =
                        Decrypter::new().force(read_mode == ReadMode::Force);
                    decrypter.extract(&bytes, input_dir).unwrap();
                }
            }

            let reader = ReaderBuilder::new()
                .with_flags(file_flags)
                .romanize(romanize)
                .game_type(game_type)
                .read_mode(read_mode)
                .logging(logging)
                .ignore(ignore)
                .trim(trim)
                .sort(sort)
                .build();

            reader.read(source_path, translation_path, engine_type);
        }
        "write" => {
            use write::*;

            if !translation_path.exists() {
                panic!("{}", localization.translation_dir_missing);
            }

            let data_output_path = if engine_type == EngineType::New {
                &output_dir.join("output/data")
            } else {
                &output_dir.join("output/Data")
            };

            create_dir_all(data_output_path).unwrap();

            if metadata_file_path.exists() {
                read_metadata();
            }

            let writer = WriterBuilder::new()
                .romanize(romanize)
                .logging(logging)
                .game_type(game_type)
                .trim(trim)
                .build();

            writer.write(
                source_path,
                translation_path,
                data_output_path,
                engine_type,
            );
        }
        "purge" => {
            use purge::*;

            let stat: bool = subcommand_matches.get_flag("stat");
            let purge_empty: bool = subcommand_matches.get_flag("purge-empty");
            let leave_filled: bool =
                subcommand_matches.get_flag("leave-filled");
            let create_ignore: bool =
                subcommand_matches.get_flag("create-ignore");

            if stat && translation_path.join("stat.txt").exists() {
                remove_file(translation_path.join("stat.txt")).unwrap();
            }

            if metadata_file_path.exists() {
                read_metadata();
            }

            let romanize: bool = matches.get_flag("romanize");

            let purger = PurgerBuilder::new()
                .romanize(romanize)
                .logging(logging)
                .game_type(game_type)
                .stat(stat)
                .leave_filled(leave_filled)
                .purge_empty(purge_empty)
                .create_ignore(create_ignore)
                .trim(trim)
                .build();

            purger.purge(source_path, translation_path, engine_type);
        }
        "json" => {
            use json::*;

            let json_subcommand: &str =
                subcommand_matches.subcommand_name().unwrap();

            match json_subcommand {
                "generate-json" => {
                    generate_json(
                        source_path,
                        input_dir,
                        engine_type,
                        read_mode,
                    );
                }
                "write-json" => {
                    write_json(input_dir);
                }
                _ => unreachable!(),
            }
        }
        "asset" => {
            use asset_decrypter::*;

            let image_subcommand: &str =
                subcommand_matches.subcommand_name().unwrap();

            let key: Option<String> =
                subcommand_matches.get_one::<String>("key").cloned();
            let file: Option<PathBuf> =
                subcommand_matches.get_one::<PathBuf>("file").cloned();
            let engine: &str = subcommand_matches
                .get_one::<String>("engine")
                .unwrap_or_else(|| {
                    eprintln!("{}", localization.engine_argument_required_msg);
                    exit(1);
                });

            let mut decrypter: Decrypter = Decrypter::new();

            if key.is_none() && matches!(image_subcommand, "encrypt") {
                decrypter.set_key_from_str(DEFAULT_KEY).unwrap()
            } else {
                decrypter.set_key_from_str(&key.unwrap()).unwrap()
            };

            match image_subcommand {
                "extract-key" => {
                    let file: PathBuf = file.unwrap_or_else(|| {
                        eprintln!("--file argument is not specified.");
                        exit(1);
                    });

                    let content: String;

                    let key = if file.extension().unwrap() == "json" {
                        content = read_to_string(&file).unwrap();
                        let index: usize =
                            content.rfind("encryptionKey").unwrap()
                                + "encryptionKey\":".len();
                        &content[index..].trim().trim_matches('"')[..32]
                    } else {
                        let buf: Vec<u8> = read(&file).unwrap();
                        decrypter.set_key_from_image(&buf);
                        decrypter.key().unwrap()
                    };

                    println!("Encryption key: {key}");
                }

                "decrypt" | "encrypt" => {
                    let mut process_file = |file: &PathBuf| {
                        let data: Vec<u8> = read(file).unwrap();

                        let (processed, new_ext) = match image_subcommand {
                            "decrypt" => {
                                let decrypted: Vec<u8> =
                                    decrypter.decrypt(&data);
                                let ext: &str =
                                    file.extension().unwrap().to_str().unwrap();
                                let new_ext: &str = match ext {
                                    "rpgmvp" | "png_" => "png",
                                    "rpgmvo" | "ogg_" => "ogg",
                                    "rpgmvm" | "m4a_" => "m4a",
                                    _ => unreachable!(),
                                };
                                (decrypted, new_ext)
                            }
                            "encrypt" => {
                                let encrypted: Vec<u8> =
                                    decrypter.encrypt(&data).unwrap();
                                let ext: &str =
                                    file.extension().unwrap().to_str().unwrap();
                                let new_ext: &str = match (engine, ext) {
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

                        let output_file: PathBuf = output_dir.join(
                            PathBuf::from(file.file_name().unwrap())
                                .with_extension(new_ext),
                        );
                        write(output_file, processed).unwrap();
                    };

                    if let Some(file) = &file {
                        process_file(file);
                    } else {
                        let exts: &[&str] = match image_subcommand {
                            "encrypt" => &["png", "ogg", "m4a"],
                            "decrypt" => &[
                                "rpgmvp", "rpgmvo", "rpgmvm", "ogg_", "png_",
                                "m4a_",
                            ],
                            _ => unreachable!(),
                        };

                        for entry in read_dir(input_dir).unwrap().flatten() {
                            let path: PathBuf = entry.path();

                            if let Some(ext) =
                                path.extension().and_then(|e| e.to_str())
                            {
                                if exts.contains(&ext) {
                                    process_file(&path);
                                }
                            }
                        }
                    }
                }
                _ => unreachable!(),
            }
        }
        _ => unreachable!(),
    }

    println!(
        "{} {:.2}s",
        localization.elapsed_time_msg,
        start_time.elapsed().as_secs_f32()
    );
}
