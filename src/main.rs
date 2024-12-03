mod localization;

use crate::localization::*;
use clap::{value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::cformat;
use regex::Regex;
use rpgmad_lib::Decrypter;
use rvpacker_lib::{read, statics::LINES_SEPARATOR, types::*, write};
use sonic_rs::{from_str, json, prelude::*, to_string, Object};
use std::{
    fs::{create_dir_all, read_to_string, write},
    io::stdin,
    mem::transmute,
    path::{Path, PathBuf},
    process::exit,
    time::Instant,
};
use sys_locale::get_locale;

pub fn get_game_type(game_title: String) -> Option<GameType> {
    let lowercased: &str = &game_title.to_lowercase();

    let termina_re: Regex = unsafe { Regex::new(r"\btermina\b").unwrap_unchecked() };
    let lisarpg_re: Regex = unsafe { Regex::new(r"\blisa\b").unwrap_unchecked() };

    if termina_re.is_match(lowercased) {
        Some(GameType::Termina)
    } else if lisarpg_re.is_match(lowercased) {
        Some(GameType::LisaRPG)
    } else {
        None
    }
}

fn main() {
    let mut start_time: Instant = Instant::now();

    let (language, subcommand) = {
        let preparse: Command = Command::new("preparse")
            .disable_help_flag(true)
            .disable_help_subcommand(true)
            .disable_version_flag(true)
            .ignore_errors(true)
            .subcommands([Command::new("read"), Command::new("write")])
            .args([Arg::new("language")
                .short('l')
                .long("language")
                .global(true)
                .value_parser(["ru", "en"])]);
        let preparse_matches: ArgMatches = preparse.get_matches();

        let subcommand: Option<String> = preparse_matches.subcommand_name().map(str::to_owned);
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

        (language, subcommand)
    };

    let localization: Localization = Localization::new(language);

    let (input_dir_arg_desc, output_dir_arg_desc) = if let Some(subcommand) = subcommand {
        match subcommand.as_str() {
            "read" => (
                localization.input_dir_arg_read_desc.to_owned(),
                localization.output_dir_arg_read_desc.to_owned(),
            ),
            "write" => (
                localization.input_dir_arg_write_desc.to_owned(),
                localization.output_dir_arg_write_desc.to_owned(),
            ),
            _ => unreachable!(),
        }
    } else {
        (
            format!(
                "{} {}\n{} {}",
                localization.when_reading,
                localization.input_dir_arg_read_desc,
                localization.when_writing,
                localization.input_dir_arg_write_desc
            ),
            format!(
                "{} {}\n{} {}",
                localization.when_reading,
                localization.output_dir_arg_read_desc,
                localization.when_writing,
                localization.output_dir_arg_write_desc
            ),
        )
    };

    let input_dir_arg: Arg = Arg::new("input-dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(input_dir_arg_desc)
        .value_name(localization.input_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(0);

    let output_dir_arg: Arg = Arg::new("output-dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(output_dir_arg_desc)
        .value_name(localization.output_path_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(1);

    let disable_processing_arg: Arg = Arg::new("disable-processing")
        .long("disable-processing")
        .alias("no")
        .value_delimiter(',')
        .value_name(localization.disable_processing_arg_type)
        .help(cformat!(
            "{}\n{} --disable-processing=maps,other,system\n<bold>[{} maps, other, system, plugins]\n[{} no]</>",
            localization.disable_processing_arg_desc,
            localization.example,
            localization.possible_values,
            localization.aliases
        ))
        .global(true)
        .value_parser(["maps", "other", "system", "plugins"])
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
        .default_value("default")
        .global(true);

    let silent_flag: Arg = Arg::new("silent").long("silent").hide(true).action(ArgAction::SetTrue);

    let generate_json_flag: Arg = Arg::new("generate-json")
        .short('g')
        .long("gen-json")
        .help(localization.generate_json_arg_desc)
        .action(ArgAction::SetTrue);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([processing_mode_arg, silent_flag, generate_json_flag])
        .arg(&help_flag);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.write_command_desc)
        .arg(&help_flag);

    let migrate_subcommand: Command = Command::new("migrate")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.migrate_command_desc)
        .arg(&help_flag);

    let cli: Command = Command::new("")
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .next_line_help(true)
        .term_width(120)
        .about(localization.about_msg)
        .help_template(localization.help_template)
        .subcommands([read_subcommand, write_subcommand, migrate_subcommand])
        .args([
            input_dir_arg,
            output_dir_arg,
            disable_processing_arg,
            romanize_arg,
            language_arg,
            disable_custom_processing_flag,
            maps_processing_mode_arg,
            log_flag,
            help_flag,
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
                        "plugins" => flags.3 = true,
                        _ => {}
                    }
                }
                flags
            })
            .unwrap_or((false, false, false, false));

    let input_dir: &Path = matches.get_one::<PathBuf>("input-dir").unwrap();

    if !input_dir.exists() {
        panic!("{}", localization.input_dir_missing);
    }

    let output_dir: &Path = matches.get_one::<PathBuf>("output-dir").unwrap();

    if !output_dir.exists() {
        panic!("{}", localization.output_dir_missing)
    }

    let mut original_path: &Path = &input_dir.join("original");
    let data_path: PathBuf = input_dir.join("data");

    if !original_path.exists() {
        original_path = &data_path;
    }

    let root_dir: &Path = if *output_dir.as_os_str() == *"./" {
        input_dir
    } else {
        output_dir
    };

    let output_path: &Path = &root_dir.join("translation");
    let metadata_file_path: &Path = &output_path.join(".rvpacker-txt-rs-metadata.json");

    let logging_flag: bool = matches.get_flag("log");
    let disable_custom_processing_flag: bool = matches.get_flag("disable-custom-processing");
    let mut romanize_flag: bool = matches.get_flag("romanize");

    let mut maps_processing_mode_value: MapsProcessingMode =
        match matches.get_one::<String>("maps-processing-mode").unwrap().as_str() {
            "default" => MapsProcessingMode::Default,
            "separate" => MapsProcessingMode::Separate,
            "preserve" => MapsProcessingMode::Preserve,
            _ => unreachable!(),
        };

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

    let (engine_type, system_file_path, scripts_file_path): (EngineType, PathBuf, Option<PathBuf>) = {
        let mut archive_path: PathBuf = input_dir.join("Game.rgss3a");
        let mut system_path: PathBuf = original_path.join("System.json");
        let engine_type: EngineType;
        let scripts_path: Option<PathBuf>;

        if system_path.exists() {
            engine_type = EngineType::New;
            scripts_path = None;
        } else {
            system_path = original_path.join("System.rvdata2");

            if system_path.exists() || archive_path.exists() {
                engine_type = EngineType::VXAce;
                scripts_path = Some(original_path.join("Scripts.rvdata2"));
            } else {
                system_path = original_path.join("System.rvdata");
                archive_path = input_dir.join("Game.rgss2a");

                if system_path.exists() || archive_path.exists() {
                    engine_type = EngineType::VX;
                    scripts_path = Some(original_path.join("Scripts.rvdata"));
                } else {
                    system_path = original_path.join("System.rxdata");
                    archive_path = input_dir.join("Game.rgssad");

                    if system_path.exists() || archive_path.exists() {
                        engine_type = EngineType::XP;
                        scripts_path = Some(original_path.join("Scripts.rxdata"));
                    } else {
                        panic!("{}", localization.could_not_determine_game_engine_msg)
                    }
                }
            }
        }

        if archive_path.exists() {
            let bytes: Vec<u8> = std::fs::read(archive_path).unwrap();
            let mut decrypter: Decrypter = Decrypter::new(bytes);
            decrypter
                .extract(input_dir, processing_mode == ProcessingMode::Force)
                .unwrap();
        }

        (engine_type, system_path, scripts_path)
    };

    let mut game_type: Option<GameType> = if disable_custom_processing_flag {
        None
    } else {
        let game_title: String = if engine_type == EngineType::New {
            let system_obj: Object = from_str(&read_to_string(&system_file_path).unwrap()).unwrap();
            system_obj["gameTitle"].as_str().unwrap().to_owned()
        } else {
            let ini_file_path: &Path = &input_dir.join("Game.ini");

            if let Ok(ini_file_content) = read_to_string(ini_file_path) {
                let title_line: &str = ini_file_content
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

    match subcommand {
        "read" => {
            use read::*;

            let silent_flag: bool = subcommand_matches.get_flag("silent");

            let generate_json_flag: bool = if engine_type != EngineType::New {
                subcommand_matches.get_flag("generate-json")
            } else {
                false
            };

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

            create_dir_all(output_path).unwrap();
            if generate_json_flag {
                create_dir_all(root_dir.join("json")).unwrap();
            }

            write(
                metadata_file_path,
                to_string(&json!({"romanize": romanize_flag, "disableCustomProcessing": disable_custom_processing_flag, "mapsProcessingMode": maps_processing_mode_value as u8})).unwrap(),
            )
            .unwrap();

            if !disable_maps_processing {
                read_map(
                    original_path,
                    output_path,
                    maps_processing_mode_value,
                    romanize_flag,
                    logging_flag,
                    game_type,
                    engine_type,
                    processing_mode,
                    generate_json_flag,
                );
            }

            if !disable_other_processing {
                read_other(
                    original_path,
                    output_path,
                    romanize_flag,
                    logging_flag,
                    game_type,
                    processing_mode,
                    engine_type,
                    generate_json_flag,
                );
            }

            if !disable_system_processing {
                read_system(
                    &system_file_path,
                    output_path,
                    romanize_flag,
                    logging_flag,
                    processing_mode,
                    engine_type,
                    generate_json_flag,
                );
            }

            if !disable_plugins_processing && engine_type != EngineType::New {
                read_scripts(
                    &unsafe { scripts_file_path.unwrap_unchecked() },
                    output_path,
                    romanize_flag,
                    logging_flag,
                    generate_json_flag,
                );
            }
        }
        "write" => {
            use write::*;

            if !output_path.exists() {
                panic!("{}", localization.translation_dir_missing);
            }

            let (data_output_path, plugins_output_path) = if engine_type == EngineType::New {
                let plugins_output_path: PathBuf = root_dir.join("output/js");
                create_dir_all(&plugins_output_path).unwrap();

                (&root_dir.join("output/data"), Some(plugins_output_path))
            } else {
                (&root_dir.join("output/Data"), None)
            };

            create_dir_all(data_output_path).unwrap();

            if metadata_file_path.exists() {
                let metadata: Object =
                    unsafe { from_str(&read_to_string(metadata_file_path).unwrap()).unwrap_unchecked() };

                let romanize_metadata: bool = unsafe { metadata["romanize"].as_bool().unwrap_unchecked() };
                let disable_custom_processing_metadata: bool =
                    unsafe { metadata["disableCustomProcessing"].as_bool().unwrap_unchecked() };
                let maps_processing_mode_metadata: u8 =
                    unsafe { metadata["mapsProcessingMode"].as_u64().unwrap_unchecked() as u8 };

                if romanize_metadata {
                    println!("{}", localization.enabling_romanize_metadata_msg);
                    romanize_flag = romanize_metadata;
                }

                if disable_custom_processing_metadata && game_type.is_some() {
                    println!("{}", localization.disabling_custom_processing_metadata_msg);
                    game_type = None;
                }

                if maps_processing_mode_metadata > 0 {
                    let (before, after) = unsafe {
                        localization
                            .enabling_maps_processing_mode_metadata_msg
                            .split_once("  ")
                            .unwrap_unchecked()
                    };

                    maps_processing_mode_value =
                        unsafe { transmute::<u8, MapsProcessingMode>(maps_processing_mode_metadata) };

                    println!(
                        "{} {} {}",
                        before,
                        match maps_processing_mode_value {
                            MapsProcessingMode::Default => "default",
                            MapsProcessingMode::Separate => "separate",
                            MapsProcessingMode::Preserve => "preserve",
                        },
                        after
                    );
                }
            }

            if !disable_maps_processing {
                write_maps(
                    output_path,
                    original_path,
                    data_output_path,
                    maps_processing_mode_value,
                    romanize_flag,
                    logging_flag,
                    game_type,
                    engine_type,
                );
            }

            if !disable_other_processing {
                write_other(
                    output_path,
                    original_path,
                    data_output_path,
                    romanize_flag,
                    logging_flag,
                    game_type,
                    engine_type,
                );
            }

            if !disable_system_processing {
                write_system(
                    &system_file_path,
                    output_path,
                    data_output_path,
                    romanize_flag,
                    logging_flag,
                    engine_type,
                );
            }

            if !disable_plugins_processing
                && game_type.is_some_and(|game_type: GameType| game_type == GameType::Termina)
            {
                write_plugins(
                    &output_path.join("plugins.json"),
                    output_path,
                    &unsafe { plugins_output_path.unwrap_unchecked() },
                    logging_flag,
                );
            }

            if !disable_plugins_processing && engine_type != EngineType::New {
                write_scripts(
                    &unsafe { scripts_file_path.unwrap_unchecked() },
                    output_path,
                    data_output_path,
                    romanize_flag,
                    logging_flag,
                    engine_type,
                )
            }
        }
        "migrate" => {
            let maps_path: PathBuf = output_path.join("maps");
            let other_path: PathBuf = output_path.join("other");
            let plugins_path: PathBuf = output_path.join("plugins");

            let mut original_content: String = String::new();
            let mut translated_content: String;
            let mut original_filename: String = String::new();

            let dirs_array: &[PathBuf] = if engine_type == EngineType::New {
                &[maps_path, other_path, plugins_path]
            } else {
                &[maps_path, other_path]
            };

            for path in dirs_array {
                for entry in std::fs::read_dir(path).unwrap().flatten() {
                    if !entry.file_name().to_str().unwrap().contains("trans") {
                        original_content = read_to_string(entry.path()).unwrap();
                        original_filename = entry.file_name().to_str().unwrap().to_owned();
                    } else {
                        translated_content = read_to_string(entry.path()).unwrap();

                        let mut output_content: String = String::from_iter(
                            original_content
                                .split('\n')
                                .zip(translated_content.split('\n'))
                                .map(|(original, translated)| format!("{original}{LINES_SEPARATOR}{translated}\n")),
                        );

                        output_content.pop();

                        write(output_path.join(original_filename.as_str()), output_content).unwrap();
                    }
                }
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
