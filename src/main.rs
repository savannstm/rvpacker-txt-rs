use clap::{value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::{cformat, cstr};
use serde_json::{from_str, Value};
use std::{
    env::args,
    fs::{create_dir_all, read_to_string},
    path::{Path, PathBuf},
    time::Instant,
};
use sys_locale::get_locale;

mod read;
mod write;

use read::*;
use write::*;

mod shuffle;
use shuffle::shuffle_words;

enum Language {
    English,
    Russian,
}

#[derive(PartialEq)]
enum ProcessingType {
    Force,
    Append,
    Default,
}

impl AsRef<ProcessingType> for ProcessingType {
    fn as_ref(&self) -> &ProcessingType {
        self
    }
}

impl PartialEq<ProcessingType> for &ProcessingType {
    fn eq(&self, other: &ProcessingType) -> bool {
        *self == other
    }
}

struct ProgramLocalization<'a> {
    // General program descriptions
    about_msg: &'a str,
    help_template: &'a str,
    subcommand_help_template: &'a str,

    // Command descriptions
    read_command_desc: &'a str,
    write_command_desc: &'a str,

    // Argument descriptions
    input_dir_arg_desc: &'a str,
    output_dir_arg_desc: &'a str,
    disable_processing_arg_desc: &'a str,
    log_arg_desc: &'a str,
    shuffle_arg_desc: &'a str,
    language_arg_desc: &'a str,
    force_arg_desc: &'a str,
    append_arg_desc: &'a str,
    help_arg_desc: &'a str,
    disable_custom_parsing_desc: &'a str,

    // Argument types
    input_dir_arg_type: &'a str,
    output_dir_arg_type: &'a str,
    disable_processing_arg_type: &'a str,
    shuffle_arg_type: &'a str,
    language_arg_type: &'a str,

    // Messages
    input_dir_not_exist: &'a str,
    output_dir_not_exist: &'a str,
    original_dir_missing: &'a str,
    translation_dirs_missing: &'a str,
    write_log_msg: &'a str,
    read_log_msg: &'a str,
    write_success_msg: &'a str,
    read_success_msg: &'a str,
    file_already_parsed_msg: &'a str,
    file_is_not_parsed_msg: &'a str,

    // Misc
    possible_values: &'a str,
    example: &'a str,
    default_value: &'a str,
}

impl<'a> ProgramLocalization<'a> {
    fn new(language: Language) -> Self {
        match language {
            Language::English => Self::load_english(),
            Language::Russian => Self::load_russian(),
        }
    }

    fn load_english() -> Self {
        ProgramLocalization {
            about_msg: cstr!("<bold>A tool that parses .json files of RPG Maker MV/MZ games into .txt files and vice versa.</bold>"),
            read_command_desc: cstr!(r#"<bold>Parses files from "original" or "data" folders of input directory to "translation" folder of output directory.</bold>"#),
            write_command_desc: cstr!(r#"<bold>Writes translated files using original files from "original" or "data" folders of input directory and writes results to "output" folder of output directory.</bold>"#),
            disable_processing_arg_desc: "Skips processing the specified files.",
            log_arg_desc: "Enables logging.",
            input_dir_arg_desc: r#"Input directory, containing folders "original" or "data" and "translation", with original game text and .txt files with translation respectively."#,
            output_dir_arg_desc: r#"Output directory, containing an "output" folder with folders "data" and "js", containing compiled .txt files with translation."#,
            shuffle_arg_desc: "With value 1, shuffles all translation lines. With value 2, shuffles all words in translation lines.",
            language_arg_desc: "Sets the localization of the tool to the selected language.",
            force_arg_desc: "Force rewrite all files. Cannot be used with --append.",
            append_arg_desc: "When you update the rvpacker-json-txt, you probably should re-read your files with append, as some new text might be added to parser. Cannot be used with --force.",
            help_arg_desc: "Prints the program's help message or for the entered subcommand.",
            help_template: cstr!("{about}\n\n<underline,bold>Usage:</> {usage}\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"),
            subcommand_help_template: cstr!("{about}\n\n<underline,bold>Usage:</> {usage}\n\n<underline,bold>Options:</>\n{options}"),
            possible_values: "Allowed values:",
            example: "Example:",
            default_value: "Default value:",
            input_dir_arg_type: "INPUT_PATH",
            output_dir_arg_type: "OUTPUT_PATH",
            disable_processing_arg_type: "FILENAMES",
            shuffle_arg_type: "NUMBER",
            language_arg_type: "LANGUAGE",
            input_dir_not_exist: "Input directory does not exist.",
            output_dir_not_exist: "Output directory does not exist.",
            original_dir_missing: r#"The "original" or "data" folder in the input directory does not exist."#,
            translation_dirs_missing: r#"The "translation/maps" and/or "translation/other" folders in the input directory do not exist."#,
            write_log_msg: "Wrote file",
            write_success_msg: "All files were written successfully.\nTime spent (in seconds):",
            read_success_msg: "The entire game text was successfully parsed.\nTime spent: (in seconds):",
            read_log_msg: "Parsed file",
            file_already_parsed_msg: "file already exists. If you want to forcefully re-read all files, use --force flag, or --append if you want append new text to already existing files.",
            file_is_not_parsed_msg: "Files aren't already parsed. Continuing as if --append flag was omitted.",
            disable_custom_parsing_desc: "Disables built-in custom parsing for some games.",
        }
    }

    fn load_russian() -> Self {
        ProgramLocalization {
            about_msg: cstr!("<bold>Инструмент, позволяющий парсить текст .json файлов RPG Maker MV/MZ игр в .txt файлы, а затем записывать их обратно.</bold>"),
            read_command_desc: cstr!(r#"<bold>Парсит файлы из папки "original" или "data" входной директории в папку "translation" выходной директории.</bold>"#),
            write_command_desc: cstr!(r#"<bold>Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" входной директории, заменяя текст файлами из папки "translation" и выводя результаты в папку "output".</bold>"#),
            disable_processing_arg_desc: "Не обрабатывает указанные файлы.",
            log_arg_desc: "Включает логирование.",
            input_dir_arg_desc: r#"Входная директория, содержащая папки "original" или "data" и "translation", с оригинальным текстом игры и .txt файлами с переводом соответственно."#,
            output_dir_arg_desc: r#"Выходная директория, в которой будут создана директория "output" с папками "data" и "js", содержащими скомпилированные файлы с переводом."#,
            shuffle_arg_desc: "При значении 1, перемешивает все строки перевода. При значении 2, перемешивает все слова в строках перевода.",
            language_arg_desc: "Устанавливает локализацию инструмента на выбранный язык.",
            force_arg_desc: "Принудительно перезаписать все файлы. Не может быть использован с --append.",
            append_arg_desc: "Когда вы обновляете rvpacker-json-txt, вам наверное стоит повторно прочитать файлы игры с флагом --append, поскольку новый текст может быть добавлен в парсер. Не может быть использован с --force.",
            help_arg_desc: "Выводит справочную информацию по программе либо по введёной команде.",
            help_template: cstr!("{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Команды:</>\n{subcommands}\n\n<underline,bold>Опции:</>\n{options}"),
            subcommand_help_template: cstr!("{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Опции:</>\n{options}"),
            possible_values: "Разрешённые значения:",
            example: "Пример:",
            default_value: "Значение по умолчанию:",
            input_dir_arg_type: "ВХОДНОЙ_ПУТЬ",
            output_dir_arg_type: "ВЫХОДНОЙ_ПУТЬ",
            disable_processing_arg_type: "ИМЕНА_ФАЙЛОВ",
            shuffle_arg_type: "ЦИФРА",
            language_arg_type: "ЯЗЫК",
            input_dir_not_exist: "Входная директория не существует.",
            output_dir_not_exist: "Выходная директория не существует.",
            original_dir_missing: r#"Папка "original" или "data" входной директории не существует."#,
            translation_dirs_missing: r#"Папки "translation/maps" и/или "translation/other" входной директории не существуют."#,
            write_log_msg: "Записан файл",
            write_success_msg: "Все файлы были записаны успешно.\nПотрачено (в секундах):",
            read_success_msg: "Весь игровой текст был успешно запарсен.\nПотрачено (в секундах):",
            read_log_msg: "Распарсен файл",
            file_already_parsed_msg: "уже существует. Если вы хотите принудительно перезаписать все файлы, используйте флаг --force, или --append если вы хотите добавить новый текст в файлы.",
            file_is_not_parsed_msg: "Файлы ещё не распарсены. Продолжаем в режиме с выключенным флагом --append.",
            disable_custom_parsing_desc: "Отключает использование индивидуальных способов парсинга файлов для некоторых игр.",
        }
    }
}

fn get_game_type(system_file_path: &Path) -> Option<&str> {
    let system_obj: Value = from_str(&read_to_string(system_file_path).unwrap()).unwrap();
    let game_title: String = system_obj["gameTitle"].as_str().unwrap().to_lowercase();

    if game_title.contains("termina") {
        return Some("termina");
    }

    None
}

fn determine_language() -> Language {
    let mut locale: String = get_locale().unwrap_or_else(|| String::from("en_US"));

    let args_vec: Vec<String> = args().collect();

    for (i, arg) in args_vec.iter().enumerate() {
        if arg == "-l" || arg == "--language" {
            locale = args_vec[i + 1].to_string();
        }
    }

    if let Some((first, _)) = locale.split_once('_') {
        locale = first.to_string()
    }

    match locale.as_str() {
        "ru" | "uk" | "be" => Language::Russian,
        _ => Language::English,
    }
}

fn main() {
    let start_time: Instant = Instant::now();

    let language: Language = determine_language();
    let localization: ProgramLocalization = ProgramLocalization::new(language);

    let input_dir_arg: Arg = Arg::new("input_dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir_arg_desc)
        .value_name(localization.input_dir_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(0);

    let output_dir_arg: Arg = Arg::new("output_dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(localization.output_dir_arg_desc)
        .value_name(localization.output_dir_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(1);

    let shuffle_level_arg: Arg = Arg::new("shuffle_level")
        .short('s')
        .long("shuffle-level")
        .action(ArgAction::Set)
        .value_name(localization.shuffle_arg_type)
        .default_value("0")
        .value_parser(value_parser!(u8).range(0..=2))
        .help(cformat!(
            "{}\n{} --shuffle-level 1.<bold>\n[{} 0, 1, 2]\n[{} 0]</bold>",
            localization.shuffle_arg_desc,
            localization.example,
            localization.possible_values,
            localization.default_value,
        ))
        .hide_default_value(true)
        .display_order(2);

    let disable_processing_arg: Arg = Arg::new("disable-processing")
        .long("disable-processing")
        .value_delimiter(',')
        .value_name(localization.disable_processing_arg_type)
        .help(cformat!(
            "{}\n{} --disable-processing=maps,other,system.<bold>\n[{} maps, other, system, plugins]</bold>",
            localization.disable_processing_arg_desc,
            localization.example,
            localization.possible_values,
        ))
        .global(true)
        .value_parser(["maps", "other", "system", "plugins"])
        .display_order(2);

    let disable_custom_parsing_flag: Arg = Arg::new("disable-custom-parsing")
        .long("disable-custom-parsing")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.disable_custom_parsing_desc)
        .display_order(97);

    let language_arg: Arg = Arg::new("language")
        .short('l')
        .long("language")
        .value_name(localization.language_arg_type)
        .global(true)
        .help(cformat!(
            "{}\n{} --language en.<bold>\n[{} en, ru]</bold>",
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

    let force_flag: Arg = Arg::new("force")
        .short('f')
        .long("force")
        .action(ArgAction::SetTrue)
        .help(localization.force_arg_desc)
        .display_order(95)
        .conflicts_with("append");

    let append_flag: Arg = Arg::new("append")
        .short('a')
        .long("append")
        .action(ArgAction::SetTrue)
        .help(localization.append_arg_desc)
        .display_order(96);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([force_flag, append_flag])
        .arg(&help_flag);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .next_line_help(true)
        .about(localization.write_command_desc)
        .arg(shuffle_level_arg)
        .arg(&help_flag);

    let cli: Command = Command::new("fh-termina-json-writer")
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .term_width(120)
        .about(localization.about_msg)
        .help_template(localization.help_template)
        .subcommands([read_subcommand, write_subcommand])
        .args([
            input_dir_arg,
            output_dir_arg,
            disable_processing_arg,
            language_arg,
            disable_custom_parsing_flag,
            log_flag,
            help_flag,
        ])
        .hide_possible_values(true);

    let matches: ArgMatches = cli.get_matches();
    let command: &str = matches.subcommand_name().unwrap();

    let (
        disable_maps_processing,
        disable_other_processing,
        disable_system_processing,
        disable_plugins_processing,
    ) = matches
        .get_many::<String>("disable_processing")
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

    let enable_logging: bool = matches.get_flag("log");
    let disable_custom_parsing: bool = matches.get_flag("disable-custom-parsing");

    let input_dir: &Path = matches.get_one::<PathBuf>("input_dir").unwrap();

    if !input_dir.exists() {
        panic!("{}", localization.input_dir_not_exist);
    }

    let output_dir: &Path = matches.get_one::<PathBuf>("output_dir").unwrap();

    if !output_dir.exists() {
        panic!("{}", localization.output_dir_not_exist)
    }

    let mut original_path: PathBuf = input_dir.join("original");

    if !original_path.exists() {
        original_path = input_dir.join("data");

        if !original_path.exists() {
            panic!("{}", localization.original_dir_missing)
        }
    }

    let (maps_path, other_path) = if output_dir == PathBuf::from("./") {
        (
            input_dir.join("translation/maps"),
            input_dir.join("translation/other"),
        )
    } else {
        (
            output_dir.join("translation/maps"),
            output_dir.join("translation/other"),
        )
    };

    let system_file_path: PathBuf = original_path.join("System.json");

    let game_type: Option<&str> = if disable_custom_parsing {
        None
    } else {
        get_game_type(&system_file_path)
    };

    if command == "read" {
        let read_matches: &ArgMatches = matches.subcommand_matches(command).unwrap();

        let force: bool = read_matches.get_flag("force");
        let append: bool = read_matches.get_flag("append");

        let processing_type: ProcessingType = if force {
            ProcessingType::Force
        } else if append {
            ProcessingType::Append
        } else {
            ProcessingType::Default
        };

        create_dir_all(&maps_path).unwrap();
        create_dir_all(&other_path).unwrap();

        unsafe { read::LOG_MSG = localization.read_log_msg }
        unsafe { read::FILE_ALREADY_PARSED = localization.file_already_parsed_msg }
        unsafe { read::FILE_IS_NOT_PARSED = localization.file_is_not_parsed_msg }

        if !disable_maps_processing {
            read_map(
                &original_path,
                &maps_path,
                enable_logging,
                game_type,
                &processing_type,
            );
        }

        if !disable_other_processing {
            read_other(
                &original_path,
                &other_path,
                enable_logging,
                game_type,
                &processing_type,
            );
        }

        if !disable_system_processing {
            read_system(
                &system_file_path,
                &other_path,
                enable_logging,
                &processing_type,
            );
        }

        println!(
            "{} {}.",
            localization.read_success_msg,
            start_time.elapsed().as_secs_f64()
        );
    } else {
        if !maps_path.exists() || !other_path.exists() {
            panic!("{}", localization.translation_dirs_missing);
        }

        let plugins_path: PathBuf = input_dir.join("translation/plugins");

        let (output_path, plugins_output_path) = if output_dir == PathBuf::from("./") {
            (input_dir.join("output/data"), input_dir.join("output/js"))
        } else {
            (output_dir.join("output/data"), output_dir.join("output/js"))
        };

        create_dir_all(&output_path).unwrap();
        create_dir_all(&plugins_output_path).unwrap();

        let shuffle_level: u8 = *matches
            .subcommand_matches(command)
            .unwrap()
            .get_one::<u8>("shuffle_level")
            .unwrap();

        unsafe { write::LOG_MSG = localization.write_log_msg }

        if !disable_maps_processing {
            write_maps(
                &maps_path,
                &original_path,
                &output_path,
                shuffle_level,
                enable_logging,
                game_type,
            );
        }

        if !disable_other_processing {
            write_other(
                &other_path,
                &original_path,
                &output_path,
                shuffle_level,
                enable_logging,
                game_type,
            );
        }

        if !disable_system_processing {
            write_system(
                &system_file_path,
                &other_path,
                &output_path,
                shuffle_level,
                enable_logging,
            );
        }

        if !disable_plugins_processing
            && plugins_path.exists()
            && game_type.is_some()
            && game_type.unwrap() == "termina"
        {
            write_plugins(
                &plugins_path.join("plugins.json"),
                &plugins_path,
                &plugins_output_path,
                shuffle_level,
                enable_logging,
            );
        }

        println!(
            "{} {}.",
            localization.write_success_msg,
            start_time.elapsed().as_secs_f64()
        );
    }
}
