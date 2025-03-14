use crate::localization::*;
use clap::{crate_version, value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::cformat;
use rpgmad_lib::Decrypter;
use rvpacker_lib::{json, parse_ignore, purge, read, read_to_string_without_bom, types::*, write};
use sonic_rs::{from_str, json, prelude::*, to_string, Object};
use std::{
    env,
    fs::{create_dir_all, read, read_to_string, remove_file, write},
    io::stdin,
    mem::transmute,
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

pub fn get_game_type(game_title: String) -> Option<GameType> {
    let lowercased: &str = &game_title.to_lowercase();

    if lowercased.contains("termina") {
        Some(GameType::Termina)
    } else if lowercased.contains("lisa") {
        Some(GameType::LisaRPG)
    } else {
        None
    }
}

fn main() {
    let mut start_time: Instant = Instant::now();

    let language: Language = {
        let preparse: Command = Command::new("preparse")
            .disable_help_flag(true)
            .disable_help_subcommand(true)
            .disable_version_flag(true)
            .ignore_errors(true)
            .subcommands([
                Command::new("read"),
                Command::new("write"),
                Command::new("purge"),
                Command::new("json").subcommands([Command::new("write-json"), Command::new("generate-json")]),
            ])
            .args([Arg::new("language")
                .short('l')
                .long("language")
                .global(true)
                .value_parser(["ru", "en"])]);
        let preparse_matches: ArgMatches = preparse.get_matches();

        let language_arg: Option<&String> = preparse_matches.get_one::<String>("language");

        let language: String = language_arg.map(String::to_owned).unwrap_or_else(|| {
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
    };

    let localization: Localization = Localization::new(language);
    let cwd = env::current_dir().unwrap().into_os_string();

    let input_dir_arg: Arg = Arg::new("input-dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir_arg_desc)
        .value_name(localization.input_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value(cwd.clone())
        .hide_default_value(true)
        .display_order(0);

    let output_dir_arg: Arg = Arg::new("output-dir")
        .short('o')
        .long("output-dir")
        .help(localization.output_dir_arg_desc)
        .value_name(localization.output_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value(cwd.clone())
        .hide_default_value(true)
        .display_order(1);

    let disable_processing_arg: Arg = Arg::new("disable-processing")
        .long("disable-processing")
        .alias("no")
        .value_delimiter(',')
        .value_name(localization.disable_processing_arg_type)
        .help(cformat!(
            "{}\n{} --disable-processing=maps,other,system\n<bold>[{} maps, other, system, plugins, scripts]\n[{} no]</>",
            localization.disable_processing_arg_desc,
            localization.example,
            localization.possible_values,
            localization.aliases
        ))
        .global(true)
        .value_parser(["maps", "other", "system", "plugins", "scripts"])
        .display_order(3);

    let romanize_arg: Arg = Arg::new("romanize")
        .short('r')
        .long("romanize")
        .global(true)
        .action(ArgAction::SetTrue)
        .help(localization.romanize_desc)
        .display_order(4);

    let processing_mode_arg: Arg = Arg::new("processing-mode")
        .short('p')
        .long("processing-mode")
        .alias("mode")
        .value_parser(["default", "append", "force"])
        .hide_default_value(true)
        .default_value("default")
        .value_name(localization.mode_arg_type)
        .help(cformat!(
            "{}\n<bold>[{} default, append, force]\n[{} default]\n[{} mode]</>",
            localization.processing_mode_arg_desc,
            localization.possible_values,
            localization.default_value,
            localization.aliases
        ));

    let disable_custom_processing_flag: Arg = Arg::new("disable-custom-processing")
        .long("disable-custom-processing")
        .alias("no-custom")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(cformat!(
            "{}\n<bold>[{} no-custom]</>",
            localization.disable_custom_processing_desc,
            localization.aliases
        ))
        .display_order(97);

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
        .display_order(98);

    let log_flag: Arg = Arg::new("log")
        .long("log")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.log_arg_desc)
        .display_order(99);

    let help_flag: Arg = Arg::new("help")
        .short('h')
        .long("help")
        .help(localization.help_arg_desc)
        .action(ArgAction::Help)
        .display_order(100);

    let maps_processing_mode_arg: Arg = Arg::new("maps-processing-mode")
        .long("maps-processing-mode")
        .alias("maps-mode")
        .help(cformat!(
            "{}\n<bold>[{} default, separate, preserve]\n[{} default]\n[{} maps-mode]</>",
            localization.maps_processing_mode_arg_desc,
            localization.possible_values,
            localization.default_value,
            localization.aliases
        ))
        .value_name(localization.mode_arg_type)
        .hide_default_value(true)
        .value_parser(["default", "separate", "preserve"])
        .default_value("default");

    let silent_flag: Arg = Arg::new("silent").long("silent").hide(true).action(ArgAction::SetTrue);

    let ignore_flag: Arg = Arg::new("ignore")
        .help(localization.ignore_flag_desc)
        .long("ignore")
        .action(ArgAction::SetTrue);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([processing_mode_arg, silent_flag, ignore_flag])
        .args([&output_dir_arg, &maps_processing_mode_arg, &help_flag]);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.write_command_desc)
        .args([&output_dir_arg, &maps_processing_mode_arg, &help_flag]);

    let stat_flag: Arg = Arg::new("stat")
        .help(localization.stat_arg_desc)
        .long("stat")
        .short('s')
        .action(ArgAction::SetTrue);

    let leave_filled_flag: Arg = Arg::new("leave-filled")
        .help(localization.leave_filled_flag_desc)
        .long("leave-filled")
        .action(ArgAction::SetTrue);

    let purge_empty_flag: Arg = Arg::new("purge-empty")
        .help(localization.purge_empty_flag_desc)
        .long("purge-empty")
        .action(ArgAction::SetTrue);

    let create_ignore_flag: Arg = Arg::new("create-ignore")
        .help(localization.create_ignore_flag_desc)
        .long("create-ignore")
        .action(ArgAction::SetTrue);

    let purge_subcommand: Command = Command::new("purge")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.purge_command_desc)
        .args([stat_flag, leave_filled_flag, purge_empty_flag, create_ignore_flag])
        .arg(&help_flag);

    let generate_json_subcommand: Command = Command::new("generate-json")
        .about(localization.generate_json_command_desc)
        .arg(&output_dir_arg)
        .disable_help_flag(true);

    let write_json_subcommand: Command = Command::new("write-json")
        .about(localization.write_json_command_desc)
        .arg(&output_dir_arg)
        .disable_help_flag(true);

    let json_subcommand: Command = Command::new("json")
        .disable_help_flag(true)
        .help_template(localization.json_help_template)
        .about(localization.json_command_desc)
        .subcommands([generate_json_subcommand, write_json_subcommand])
        .arg(&help_flag);

    let version_flag: Arg = Arg::new("version")
        .short('v')
        .long("version")
        .action(ArgAction::Version)
        .help(localization.version_flag_desc);

    let cli: Command = Command::new("")
        .version(crate_version!())
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .next_line_help(true)
        .term_width(120)
        .about(localization.about_msg)
        .help_template(localization.help_template)
        .subcommands([read_subcommand, write_subcommand, purge_subcommand, json_subcommand])
        .args([
            input_dir_arg,
            output_dir_arg,
            disable_processing_arg,
            romanize_arg,
            language_arg,
            disable_custom_processing_flag,
            log_flag,
            help_flag,
            version_flag,
        ])
        .hide_possible_values(true);

    let matches: ArgMatches = cli.get_matches();
    let (subcommand, subcommand_matches): (&str, &ArgMatches) = matches.subcommand().unwrap_or_else(|| {
        println!("{}", localization.no_subcommand_specified_msg);
        exit(0);
    });

    let (disable_maps_processing, disable_other_processing, disable_system_processing, disable_plugins_processing) =
        matches
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

    let input_dir: &PathBuf = matches.get_one::<PathBuf>("input-dir").unwrap();

    if !input_dir.exists() {
        panic!("{}", localization.input_dir_missing);
    }

    let output_dir: &PathBuf = matches.get_one::<PathBuf>("output-dir").unwrap();

    if !output_dir.exists() {
        panic!("{}", localization.output_dir_missing)
    }

    let mut original_path: &PathBuf = &input_dir.join("original");
    let data_path: PathBuf = input_dir.join("data");

    if !original_path.exists() {
        original_path = &data_path;
    }

    let translation_path: &PathBuf = &output_dir.join("translation");
    let metadata_file_path: &Path = &translation_path.join(".rvpacker-metadata");
    let ignore_file_path: &Path = &translation_path.join(".rvpacker-ignore");

    let logging: bool = matches.get_flag("log");
    let disable_custom_processing: bool = matches.get_flag("disable-custom-processing");
    let mut romanize: bool = matches.get_flag("romanize");

    let mut maps_processing_mode: MapsProcessingMode = MapsProcessingMode::Default;
    let maps_processing_mode_value_mut = unsafe { &mut *(&mut maps_processing_mode as *mut MapsProcessingMode) };

    let (engine_type, system_file_path, archive_path, scripts_file_path, plugins_file_path) =
        if original_path.join("System.json").exists() {
            (
                EngineType::New,
                original_path.join("System.json"),
                None,
                None,
                Some(input_dir.join("js/plugins.js")),
            )
        } else if original_path.join("System.rvdata2").exists() || input_dir.join("Game.rgss3a").exists() {
            (
                EngineType::VXAce,
                original_path.join("System.rvdata2"),
                Some(input_dir.join("Game.rgss3a")),
                Some(original_path.join("Scripts.rvdata2")),
                None,
            )
        } else if original_path.join("System.rvdata").exists() || input_dir.join("Game.rgss2a").exists() {
            (
                EngineType::VX,
                original_path.join("System.rvdata"),
                Some(input_dir.join("Game.rgss2a")),
                Some(original_path.join("Scripts.rvdata")),
                None,
            )
        } else if original_path.join("System.rxdata").exists() || input_dir.join("Game.rgssad").exists() {
            (
                EngineType::XP,
                original_path.join("System.rxdata"),
                Some(input_dir.join("Game.rgssad")),
                Some(original_path.join("Scripts.rxdata")),
                None,
            )
        } else {
            panic!("{}", localization.could_not_determine_game_engine_msg)
        };

    let mut game_type: Option<GameType> = if disable_custom_processing {
        None
    } else {
        let game_title: String = if engine_type == EngineType::New {
            let system_obj: Object = from_str(&read_to_string_without_bom(&system_file_path).unwrap()).unwrap();
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
                    .find(|line: &&str| line.to_lowercase().starts_with("title"))
                    .unwrap();
                let game_title: String = unsafe { title_line.split_once('=').unwrap_unchecked() }
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

    if game_type.is_some() {
        println!("{}", localization.custom_processing_enabled_msg);
    }

    let mut read_metadata = || {
        let metadata: Object = unsafe { from_str(&read_to_string(metadata_file_path).unwrap()).unwrap_unchecked() };

        let romanize_metadata: bool = unsafe { metadata["romanize"].as_bool().unwrap_unchecked() };
        let disable_custom_processing_metadata: bool =
            unsafe { metadata["disableCustomProcessing"].as_bool().unwrap_unchecked() };
        let maps_processing_mode_metadata: u8 =
            unsafe { metadata["mapsProcessingMode"].as_u64().unwrap_unchecked() as u8 };

        if romanize_metadata {
            println!("{}", localization.enabling_romanize_metadata_msg);
            romanize = romanize_metadata;
        }

        if disable_custom_processing_metadata && game_type.is_some() {
            println!("{}", localization.disabling_custom_processing_metadata_msg);
            game_type = None;
        }

        if maps_processing_mode_metadata > 0 {
            maps_processing_mode = unsafe { transmute::<u8, MapsProcessingMode>(maps_processing_mode_metadata) };

            let (before, after) = unsafe {
                localization
                    .enabling_maps_processing_mode_metadata_msg
                    .split_once("  ")
                    .unwrap_unchecked()
            };

            println!(
                "{before} {maps_processing_mode} {after}",
                maps_processing_mode = match maps_processing_mode {
                    MapsProcessingMode::Default => "default",
                    MapsProcessingMode::Separate => "separate",
                    MapsProcessingMode::Preserve => "preserve",
                },
            );
        }
    };

    match subcommand {
        "read" => {
            use read::*;

            let processing_mode: ProcessingMode = match subcommand_matches
                .get_one::<String>("processing-mode")
                .unwrap_or(&String::from("default"))
                .as_str()
            {
                "default" => ProcessingMode::Default,
                "append" => ProcessingMode::Append,
                "force" => ProcessingMode::Force,
                _ => unreachable!(),
            };

            *maps_processing_mode_value_mut = match subcommand_matches
                .get_one::<String>("maps-processing-mode")
                .unwrap()
                .as_str()
            {
                "default" => MapsProcessingMode::Default,
                "separate" => MapsProcessingMode::Separate,
                "preserve" => MapsProcessingMode::Preserve,
                _ => unreachable!(),
            };

            let silent_flag: bool = subcommand_matches.get_flag("silent");
            let ignore: bool = subcommand_matches.get_flag("ignore");

            if let Some(archive_path) = archive_path {
                if archive_path.exists() {
                    let bytes: Vec<u8> = std::fs::read(archive_path).unwrap();
                    let mut decrypter: Decrypter = Decrypter::new(bytes);
                    decrypter
                        .extract(input_dir, processing_mode == ProcessingMode::Force)
                        .unwrap();
                }
            }

            if processing_mode == ProcessingMode::Force && !silent_flag {
                let start: Instant = Instant::now();
                println!("{}", localization.force_mode_warning);

                let mut buf: String = String::with_capacity(4);
                stdin().read_line(&mut buf).unwrap();

                if buf.trim_end() != "Y" {
                    exit(0);
                }

                start_time -= start.elapsed();
            }

            if metadata_file_path.exists() && processing_mode == ProcessingMode::Append {
                read_metadata();
            }

            create_dir_all(translation_path).unwrap();

            if processing_mode != ProcessingMode::Append {
                write(
                    metadata_file_path,
                    to_string(&json!({"romanize": romanize, "disableCustomProcessing": disable_custom_processing, "mapsProcessingMode": maps_processing_mode as u8})).unwrap(),
                )
                .unwrap();
            } else if ignore && !ignore_file_path.exists() {
                println!("{}", localization.ignore_file_does_not_exist_msg);
                exit(0);
            }

            if !disable_maps_processing {
                MapReader::new(original_path, translation_path, engine_type)
                    .romanize(romanize)
                    .game_type(game_type)
                    .processing_mode(processing_mode)
                    .maps_processing_mode(maps_processing_mode)
                    .logging(logging)
                    .ignore(ignore)
                    .read();
            }

            if !disable_other_processing {
                OtherReader::new(original_path, translation_path, engine_type)
                    .romanize(romanize)
                    .game_type(game_type)
                    .processing_mode(processing_mode)
                    .logging(logging)
                    .ignore(ignore)
                    .read();
            }

            if !disable_system_processing {
                SystemReader::new(&system_file_path, translation_path, engine_type)
                    .romanize(romanize)
                    .processing_mode(processing_mode)
                    .logging(logging)
                    .ignore(ignore)
                    .read();
            }

            if !disable_plugins_processing {
                if engine_type == EngineType::New {
                    PluginReader::new(&plugins_file_path.unwrap(), translation_path)
                        .romanize(romanize)
                        .processing_mode(processing_mode)
                        .logging(logging)
                        .ignore(ignore)
                        .read();
                } else {
                    ScriptReader::new(&scripts_file_path.unwrap(), translation_path)
                        .romanize(romanize)
                        .processing_mode(processing_mode)
                        .logging(logging)
                        .ignore(ignore)
                        .read();
                }
            }
        }
        "write" => {
            use write::*;

            if !translation_path.exists() {
                panic!("{}", localization.translation_dir_missing);
            }

            let (data_output_path, plugins_output_path) = if engine_type == EngineType::New {
                let plugins_output_path: PathBuf = output_dir.join("output/js");
                create_dir_all(&plugins_output_path).unwrap();

                (&output_dir.join("output/data"), Some(plugins_output_path))
            } else {
                (&output_dir.join("output/Data"), None)
            };

            create_dir_all(data_output_path).unwrap();

            if metadata_file_path.exists() {
                read_metadata();
            }

            if !disable_maps_processing {
                MapWriter::new(original_path, translation_path, data_output_path, engine_type)
                    .maps_processing_mode(maps_processing_mode)
                    .romanize(romanize)
                    .logging(logging)
                    .game_type(game_type);
            }

            if !disable_other_processing {
                OtherWriter::new(original_path, translation_path, data_output_path, engine_type)
                    .romanize(romanize)
                    .logging(logging)
                    .game_type(game_type);
            }

            if !disable_system_processing {
                SystemWriter::new(&system_file_path, translation_path, data_output_path, engine_type)
                    .romanize(romanize)
                    .logging(logging);
            }

            if !disable_plugins_processing {
                if engine_type == EngineType::New {
                    SystemWriter::new(
                        &plugins_file_path.unwrap(),
                        translation_path,
                        &plugins_output_path.unwrap(),
                        engine_type,
                    )
                    .romanize(romanize)
                    .logging(logging);
                } else {
                    SystemWriter::new(
                        &scripts_file_path.unwrap(),
                        translation_path,
                        data_output_path,
                        engine_type,
                    )
                    .romanize(romanize)
                    .logging(logging);
                }
            }
        }
        "purge" => {
            use purge::*;

            let stat: bool = subcommand_matches.get_flag("stat");
            let purge_empty: bool = subcommand_matches.get_flag("purge-empty");
            let leave_filled: bool = subcommand_matches.get_flag("leave-filled");
            let create_ignore: bool = subcommand_matches.get_flag("create-ignore");

            if stat && translation_path.join("stat.txt").exists() {
                remove_file(translation_path.join("stat.txt")).unwrap();
            }

            if metadata_file_path.exists() {
                read_metadata();
            }

            if maps_processing_mode == MapsProcessingMode::Preserve && (stat || create_ignore) {
                println!("{}", localization.purge_args_incompatible_with_preserve_mode_msg);
                exit(0);
            }

            let mut ignore_map: IgnoreMap = IgnoreMap::default();

            if create_ignore && translation_path.join(".rvpacker-ignore").exists() {
                ignore_map = parse_ignore(translation_path.join(".rvpacker-ignore"));
            }

            let mut stat_vec: Vec<(String, String)> = Vec::new();

            if !disable_maps_processing {
                MapPurger::new(original_path, translation_path, engine_type)
                    .maps_processing_mode(maps_processing_mode)
                    .romanize(romanize)
                    .logging(logging)
                    .game_type(game_type)
                    .stat(stat)
                    .leave_filled(leave_filled)
                    .purge_empty(purge_empty)
                    .create_ignore(create_ignore)
                    .purge(Some(&mut ignore_map), Some(&mut stat_vec));
            }

            if !disable_other_processing {
                OtherPurger::new(original_path, translation_path, engine_type)
                    .romanize(romanize)
                    .logging(logging)
                    .game_type(game_type)
                    .stat(stat)
                    .leave_filled(leave_filled)
                    .purge_empty(purge_empty)
                    .create_ignore(create_ignore)
                    .purge(Some(&mut ignore_map), Some(&mut stat_vec));
            }

            if !disable_system_processing {
                SystemPurger::new(&system_file_path, translation_path, engine_type)
                    .romanize(romanize)
                    .logging(logging)
                    .stat(stat)
                    .leave_filled(leave_filled)
                    .purge_empty(purge_empty)
                    .create_ignore(create_ignore)
                    .purge(Some(&mut ignore_map), Some(&mut stat_vec));
            }

            if !disable_plugins_processing {
                if engine_type == EngineType::New {
                    PluginPurger::new(&plugins_file_path.unwrap(), translation_path)
                        .romanize(romanize)
                        .logging(logging)
                        .stat(stat)
                        .leave_filled(leave_filled)
                        .purge_empty(purge_empty)
                        .create_ignore(create_ignore)
                        .purge(Some(&mut ignore_map), Some(&mut stat_vec));
                } else {
                    ScriptPurger::new(&scripts_file_path.unwrap(), translation_path)
                        .romanize(romanize)
                        .logging(logging)
                        .stat(stat)
                        .leave_filled(leave_filled)
                        .purge_empty(purge_empty)
                        .create_ignore(create_ignore)
                        .purge(Some(&mut ignore_map), Some(&mut stat_vec));
                }
            }

            if create_ignore {
                write_ignore(ignore_map, translation_path);
            }

            if stat {
                write_stat(stat_vec, translation_path);
            }
        }
        "json" => {
            use json::*;

            let json_subcommand: &str = subcommand_matches.subcommand_name().unwrap();
            let processing_mode: ProcessingMode = match subcommand_matches
                .get_one::<String>("processing-mode")
                .unwrap_or(&String::from("default"))
                .as_str()
            {
                "default" => ProcessingMode::Default,
                "append" => ProcessingMode::Append,
                "force" => ProcessingMode::Force,
                _ => unreachable!(),
            };

            match json_subcommand {
                "generate-json" => {
                    generate_json(original_path, input_dir, engine_type, processing_mode);
                }
                "write-json" => {
                    write_json(input_dir);
                }
                _ => unreachable!(),
            }
        }
        _ => unreachable!(),
    }

    println!(
        "{} {}",
        localization.elapsed_time_msg,
        start_time.elapsed().as_secs_f64()
    );
}
