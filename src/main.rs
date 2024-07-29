use clap::{value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::{cformat, cstr};
use fastrand::seed;
use lazy_static::lazy_static;
use regex::Regex;
use sonic_rs::{from_str, JsonValueTrait, Object};
use std::{
    env::args,
    fs::{create_dir_all, read_to_string, write},
    io::stdin,
    path::{Path, PathBuf},
    process::exit,
    time::Instant,
};
use sys_locale::get_locale;

mod read;
mod write;

#[derive(PartialEq)]
enum GameType {
    Termina,
}

#[derive(PartialEq)]
enum ProcessingMode {
    Force,
    Append,
    Default,
}

impl AsRef<ProcessingMode> for ProcessingMode {
    fn as_ref(&self) -> &ProcessingMode {
        self
    }
}

impl PartialEq<ProcessingMode> for &ProcessingMode {
    fn eq(&self, other: &ProcessingMode) -> bool {
        *self == other
    }
}

enum Code {
    Dialogue, // also goes for credit
    Choice,
    System,
    Unknown,
}

enum Language {
    English,
    Russian,
}

#[derive(PartialEq)]
enum Variable {
    Name,
    Nickname,
    Description,
    Note,
}

struct ProgramLocalization<'a> {
    // About message and templates
    about_msg: &'a str,
    help_template: &'a str,
    subcommand_help_template: &'a str,

    // Command descriptions
    read_command_desc: &'a str,
    write_command_desc: &'a str,

    // Argument descriptions
    input_dir_arg_read_desc: &'a str,
    input_dir_arg_write_desc: &'a str,

    output_dir_arg_read_desc: &'a str,
    output_dir_arg_write_desc: &'a str,

    shuffle_level_arg_desc: &'a str,
    disable_processing_arg_desc: &'a str,

    romanize_desc: &'a str,

    force_arg_desc: &'a str,
    append_arg_desc: &'a str,

    disable_custom_processing_desc: &'a str,

    language_arg_desc: &'a str,

    log_arg_desc: &'a str,
    help_arg_desc: &'a str,

    // Argument types
    input_dir_arg_type: &'a str,
    output_dir_arg_type: &'a str,
    disable_processing_arg_type: &'a str,
    shuffle_arg_type: &'a str,
    language_arg_type: &'a str,

    // Messages and warnings
    input_dir_not_exist: &'a str,
    output_dir_not_exist: &'a str,
    original_dir_missing: &'a str,
    translation_dirs_missing: &'a str,
    file_written_msg: &'a str,
    file_parsed_msg: &'a str,
    file_already_parsed_msg: &'a str,
    file_is_not_parsed_msg: &'a str,
    done_in_msg: &'a str,
    force_mode_warning: &'a str,
    custom_processing_enabled_msg: &'a str,
    enabling_romanize_metadata_msg: &'a str,
    disabling_custom_processing_metadata_msg: &'a str,

    // Misc
    possible_values: &'a str,
    example: &'a str,
    default_value: &'a str,
    when_reading: &'a str,
    when_writing: &'a str,
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
            // About message and templates
            about_msg: cstr!("<bold>This tool allows to parse RPG Maker MV/MZ games text to .txt files and write them back to their initial form.</bold>"),
            help_template: cstr!("{about}\n\n<underline,bold>Usage:</> rvpacker-json-txt COMMAND [OPTIONS]\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"),
            subcommand_help_template: cstr!("{about}\n\n<underline,bold>Usage:</> {usage}\n\n<underline,bold>Options:</>\n{options}"),

            // Command descriptions
            read_command_desc: cstr!(r#"<bold>Parses files from "original" or "data" folders of input directory to "translation" folder of output directory.</bold>"#),
            write_command_desc: cstr!(r#"<bold>Writes translated files using original files from "original" or "data" folders of input directory and writes results to "output" folder of output directory.</bold>"#),

            // Argument descriptions
            input_dir_arg_read_desc: r#"Input directory, containing folder "original" or "data" with original game files."#,
            input_dir_arg_write_desc: r#"Input directory, containing folder "original" or "data" with original game files, and folder "translation" with translation .txt files."#,

            output_dir_arg_read_desc: r#"Output directory, where a "translation" folder with translation .txt files will be created."#,
            output_dir_arg_write_desc: r#"Output directory, where an "output" folder with "data" and "js" subfolders with game files with translated text from .txt files will be created."#,

            shuffle_level_arg_desc: "With value 1, shuffles all translation lines. With value 2, shuffles all words in translation lines.",
            disable_processing_arg_desc: "Skips processing specified files.",

            romanize_desc: r#"If you parsing text from a Japanese game, that contains symbols like 「」, which are just the Japanese quotation marks, it automatically replaces these symbols by their roman equivalents (in this case, ""). This flag will automatically be used when writing if you parsed game text with it."#,

            force_arg_desc: "Force rewrite all files. Cannot be used with --append.",
            append_arg_desc: "When the game, which files you've parsed, or the rvpacker-json-txt updates, you probably should re-read game files using --append flag, to append any unparsed text to the existing without overwriting translation. Cannot be used with --force.",

            disable_custom_processing_desc: "Disables built-in custom processing, implemented for some games. This flag will automatically be used when writing if you parsed game text with it.",
            language_arg_desc: "Sets the localization of the tool to the selected language.",

            log_arg_desc: "Enables logging.",
            help_arg_desc: "Prints the program's help message or for the entered subcommand.",

            // Argument types
            input_dir_arg_type: "INPUT_PATH",
            output_dir_arg_type: "OUTPUT_PATH",
            disable_processing_arg_type: "FILENAMES",
            shuffle_arg_type: "NUMBER",
            language_arg_type: "LANGUAGE",

            // Messages and warnings
            input_dir_not_exist: "Input directory does not exist.",
            output_dir_not_exist: "Output directory does not exist.",
            original_dir_missing: r#"The "original" or "data" folder in the input directory does not exist."#,
            translation_dirs_missing: r#"The "translation/maps" and/or "translation/other" folders in the input directory do not exist."#,
            file_written_msg: "Wrote file",
            file_parsed_msg: "Parsed file",
            file_already_parsed_msg: "file already exists. If you want to forcefully re-read all files, use --force flag, or --append if you want append new text to already existing files.",
            file_is_not_parsed_msg: "Files aren't already parsed. Continuing as if --append flag was omitted.",
            done_in_msg: "Done in:",
            force_mode_warning: "WARNING! Force mode will forcefully rewrite all your translation files in the folder, including _trans. Input 'Y' to continue.",
            custom_processing_enabled_msg: "Custom processing for this game will be used. Use --disable-custom-processing to disable it.",
            enabling_romanize_metadata_msg: "Enabling romanize according to the metadata from previous read.",
            disabling_custom_processing_metadata_msg: "Disabling custom processing according to the metadata from previous read.",

            // Misc
            possible_values: "Allowed values:",
            example: "Example:",
            default_value: "Default value:",
            when_reading: "When reading:",
            when_writing: "When writing:"
        }
    }

    fn load_russian() -> Self {
        ProgramLocalization {
            about_msg: cstr!("<bold>Инструмент, позволяющий парсить текст .json файлов RPG Maker MV/MZ игр в .txt файлы, а затем записывать их обратно.</bold>"),
            help_template: cstr!("{about}\n\n<underline,bold>Использование:</> rvpacker-json-txt КОМАНДА [ОПЦИИ]\n\n<underline,bold>Команды:</>\n{subcommands}\n\n<underline,bold>Опции:</>\n{options}"),
            subcommand_help_template: cstr!("{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Опции:</>\n{options}"),

            read_command_desc: cstr!(r#"<bold>Парсит файлы из папки "original" или "data" входной директории в папку "translation" выходной директории.</bold>"#),
            write_command_desc: cstr!(r#"<bold>Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" входной директории, применяя текст из .txt файлов папки "translation", выводя результаты в папку "output" выходной директории.</bold>"#),

            input_dir_arg_read_desc: r#"Входная директория, содержащая папку "original" или "data" с оригинальными файлами игры."#,
            input_dir_arg_write_desc: r#"Входная директория, содержащая папку "original" или "data" с оригинальными файлами игры, а также папку "translation" с .txt файлами перевода."#,

            output_dir_arg_read_desc: r#"Выходная директория, где будет создана папка "translation" с .txt файлами перевода."#,
            output_dir_arg_write_desc: r#"Выходная директория, где будет создана папка "output" с подпапками "data" и "js", содержащими игровые файлы с переведённым текстом из .txt файлов."#,

            shuffle_level_arg_desc: "При значении 1, перемешивает все строки перевода. При значении 2, перемешивает все слова в строках перевода.",
            disable_processing_arg_desc: "Не обрабатывает указанные файлы.",

            romanize_desc: r#"Если вы парсите текст из японскной игры, содержащей символы вроде 「」, являющимися обычными японскими кавычками, программа автоматически заменяет эти символы на их европейские эквиваленты. (в данном случае, "")"#,

            force_arg_desc: "Принудительно перезаписать все файлы. Не может быть использован с --append.",
            append_arg_desc: "Когда игра, файлы которой вы распарсили, либо же rvpacker-json-txt обновляется, вы, наверное, должны перечитать файлы игры используя флаг --append, чтобы добавить любой нераспарсенный текст к имеющемуся без перезаписи прогресса. Не может быть использован с --force.",

            disable_custom_processing_desc: "Отключает использование индивидуальных способов обработки текста, имплементированных для некоторых игр. Этот флаг будет автоматически применён при записи, если текст игры был прочитан с его использованием.",
            language_arg_desc: "Устанавливает локализацию инструмента на выбранный язык.",

            log_arg_desc: "Включает логирование.",
            help_arg_desc: "Выводит справочную информацию по программе либо по введёной команде.",

            input_dir_arg_type: "ВХОДНОЙ_ПУТЬ",
            output_dir_arg_type: "ВЫХОДНОЙ_ПУТЬ",
            disable_processing_arg_type: "ИМЕНА_ФАЙЛОВ",
            shuffle_arg_type: "ЦИФРА",
            language_arg_type: "ЯЗЫК",

            input_dir_not_exist: "Входная директория не существует.",
            output_dir_not_exist: "Выходная директория не существует.",
            original_dir_missing: r#"Папка "original" или "data" входной директории не существует."#,
            translation_dirs_missing: r#"Папки "translation/maps" и/или "translation/other" входной директории не существуют."#,
            file_written_msg: "Записан файл",
            file_parsed_msg: "Распарсен файл",
            file_already_parsed_msg: "уже существует. Если вы хотите принудительно перезаписать все файлы, используйте флаг --force, или --append если вы хотите добавить новый текст в файлы.",
            file_is_not_parsed_msg: "Файлы ещё не распарсены. Продолжаем в режиме с выключенным флагом --append.",
            done_in_msg: "Выполнено за:",
            force_mode_warning: "ПРЕДУПРЕЖДЕНИЕ! Принудительный режим полностью перепишет все ваши файлы перевода, включая _trans-файлы. Введите Y, чтобы продолжить.",
            custom_processing_enabled_msg: "Индивидуальная обработка текста будет использована для этой игры. Используйте --disable-custom-processing, чтобы отключить её.",
            enabling_romanize_metadata_msg: "В соответствии с метаданными из прошлого чтения, романизация текста будет использована.",
            disabling_custom_processing_metadata_msg: "В соответсвии с метаданными из прошлого чтения, индивидуальная обработка текста будет выключена.",

            possible_values: "Разрешённые значения:",
            example: "Пример:",
            default_value: "Значение по умолчанию:",
            when_reading: "При чтении:",
            when_writing: "При записи:"
        }
    }
}

lazy_static! {pub static ref STRING_IS_ONLY_SYMBOLS_RE: Regex = Regex::new(r#"^[.()+\-:;\[\]^~%&!№$@`*\/→×？?ｘ％▼|♥♪！：〜『』「」〽。…‥＝゠、，【】［］｛｝（）〔〕｟｠〘〙〈〉《》・\\#'"<>=_ー※▶ⅠⅰⅡⅱⅢⅲⅣⅳⅤⅴⅥⅵⅦⅶⅧⅷⅨⅸⅩⅹⅪⅺⅫⅻⅬⅼⅭⅽⅮⅾⅯⅿ\s0-9]+$"#).unwrap();}

pub fn romanize_string<T>(string: T) -> String
where
    T: AsRef<str>,
    std::string::String: std::convert::From<T>,
{
    let actual_string: String = String::from(string);
    let mut result: String = String::new();

    for char in actual_string.chars() {
        let replacement: &str = match char {
            '。' => ".",
            '、' | '，' => ",",
            '・' => "·",
            '゠' => "–",
            '＝' | 'ー' => "—",
            '「' | '」' | '〈' | '〉' => "'",
            '『' | '』' | '《' | '》' => "\"",
            '（' | '〔' | '｟' | '〘' => "(",
            '）' | '〕' | '｠' | '〙' => ")",
            '｛' => "{",
            '｝' => "}",
            '［' | '【' | '〖' | '〚' => "[",
            '］' | '】' | '〗' | '〛' => "]",
            '〜' => "~",
            '？' => "?",
            '！' => "!",
            '：' => ":",
            '※' => "*",
            '…' | '‥' => "...",
            _ => {
                result.push(char);
                continue;
            }
        };

        result.push_str(replacement);
    }

    result
}

fn get_game_type(system_file_path: &Path) -> Option<GameType> {
    let system_obj: Object = from_str(&read_to_string(system_file_path).unwrap()).unwrap();
    let game_title: String = system_obj["gameTitle"].as_str().unwrap().to_lowercase();

    if game_title.contains("termina") {
        return Some(GameType::Termina);
    }

    None
}

// this function probably should be replaced by some clap-native equivalent
fn preparse_arguments() -> (Language, Option<String>) {
    let mut locale: String = get_locale().unwrap_or_else(|| String::from("en_US"));

    let args_vec: Vec<String> = args().collect();

    let subcommand: Option<String> = if ["read", "write"].contains(&args_vec[1].as_str()) {
        Some(args_vec[1].clone())
    } else {
        None
    };

    for (i, arg) in args_vec.iter().enumerate() {
        if arg == "-l" || arg == "--language" {
            locale = args_vec[i + 1].to_string();
        }
    }

    if let Some((first, _)) = locale.split_once('_') {
        locale = first.to_string()
    }

    match locale.as_str() {
        "ru" | "uk" | "be" => (Language::Russian, subcommand),
        _ => (Language::English, subcommand),
    }
}

fn main() {
    let start_time: Instant = Instant::now();

    let (language, subcommand): (Language, Option<String>) = preparse_arguments();
    let localization: ProgramLocalization = ProgramLocalization::new(language);

    let (input_dir_arg_desc, output_dir_arg_desc) = if let Some(subcommand) = subcommand {
        match subcommand.as_str() {
            "read" => (
                localization.input_dir_arg_read_desc.to_string(),
                localization.output_dir_arg_read_desc.to_string(),
            ),
            "write" => (
                localization.input_dir_arg_write_desc.to_string(),
                localization.output_dir_arg_write_desc.to_string(),
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
        .value_name(localization.input_dir_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(0);

    let output_dir_arg: Arg = Arg::new("output-dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(output_dir_arg_desc)
        .value_name(localization.output_dir_arg_type)
        .value_parser(value_parser!(PathBuf))
        .default_value("./")
        .hide_default_value(true)
        .display_order(1);

    let shuffle_level_arg: Arg = Arg::new("shuffle-level")
        .short('s')
        .long("shuffle-level")
        .action(ArgAction::Set)
        .value_name(localization.shuffle_arg_type)
        .default_value("0")
        .value_parser(value_parser!(u8).range(0..=2))
        .help(cformat!(
            "{}\n{} --shuffle-level 1.<bold>\n[{} 0, 1, 2]\n[{} 0]</bold>",
            localization.shuffle_level_arg_desc,
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
        .display_order(3);

    let romanize_arg: Arg = Arg::new("romanize")
        .short('r')
        .long("romanize")
        .global(true)
        .action(ArgAction::SetTrue)
        .help(localization.romanize_desc)
        .display_order(4);

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

    let disable_custom_processing_flag: Arg = Arg::new("disable-custom-processing")
        .long("disable-custom-processing")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.disable_custom_processing_desc)
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

    let silent_flag: Arg = Arg::new("silent").long("silent").hide(true).action(ArgAction::SetTrue);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([force_flag, append_flag, silent_flag])
        .arg(&help_flag);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.write_command_desc)
        .args([shuffle_level_arg])
        .arg(&help_flag);

    let cli: Command = Command::new("")
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .next_line_help(true)
        .term_width(120)
        .about(localization.about_msg)
        .help_template(localization.help_template)
        .subcommands([read_subcommand, write_subcommand])
        .args([
            input_dir_arg,
            output_dir_arg,
            disable_processing_arg,
            romanize_arg,
            language_arg,
            disable_custom_processing_flag,
            log_flag,
            help_flag,
        ])
        .hide_possible_values(true);

    let matches: ArgMatches = cli.get_matches();
    let (subcommand, subcommand_matches): (&str, &ArgMatches) = matches.subcommand().unwrap();

    let (disable_maps_processing, disable_other_processing, disable_system_processing, disable_plugins_processing) =
        matches
            .get_many::<&str>("disable-processing")
            .map(|disable_processing_args| {
                let mut flags = (false, false, false, false);

                for disable_processing_of in disable_processing_args {
                    match *disable_processing_of {
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

    let logging: bool = matches.get_flag("log");
    let disable_custom_processing: bool = matches.get_flag("disable-custom-processing");
    let mut romanize: bool = matches.get_flag("romanize");

    let input_dir: &Path = matches.get_one::<PathBuf>("input-dir").unwrap();

    if !input_dir.exists() {
        panic!("{}", localization.input_dir_not_exist);
    }

    let output_dir: &Path = matches.get_one::<PathBuf>("output-dir").unwrap();

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

    let (maps_path, other_path, metadata_file_path) = if output_dir.as_os_str().as_encoded_bytes() == "./".as_bytes() {
        (
            input_dir.join("translation/maps"),
            input_dir.join("translation/other"),
            input_dir.join("translation/.rvpacker-json-txt-metadata.json"),
        )
    } else {
        (
            output_dir.join("translation/maps"),
            output_dir.join("translation/other"),
            output_dir.join("translation/.rvpacker-json-txt-metadata.json"),
        )
    };

    let system_file_path: PathBuf = original_path.join("System.json");

    let mut game_type: Option<GameType> = if disable_custom_processing {
        None
    } else {
        get_game_type(&system_file_path)
    };

    if game_type.is_some() {
        println!("{}", localization.custom_processing_enabled_msg);
    }

    let mut wait_time: f64 = 0f64;

    if subcommand == "read" {
        use read::*;

        let force: bool = subcommand_matches.get_flag("force");
        let append: bool = subcommand_matches.get_flag("append");
        let silent: bool = subcommand_matches.get_flag("silent");

        let processing_type: ProcessingMode = if force {
            if !silent {
                let start_time: Instant = Instant::now();
                println!("{}", localization.force_mode_warning);

                let mut buf: String = String::new();
                stdin().read_line(&mut buf).unwrap();

                if buf.trim_end() != "Y" {
                    exit(0);
                }

                wait_time += start_time.elapsed().as_secs_f64();
            }

            ProcessingMode::Force
        } else if append {
            ProcessingMode::Append
        } else {
            ProcessingMode::Default
        };

        create_dir_all(&maps_path).unwrap();
        create_dir_all(&other_path).unwrap();

        write(
            metadata_file_path,
            format!(r#"{{"romanize":{romanize},"disableCustomProcessing":{disable_custom_processing}}}"#),
        )
        .unwrap();

        if !disable_maps_processing {
            read_map(
                &original_path,
                &maps_path,
                romanize,
                logging,
                localization.file_parsed_msg,
                localization.file_already_parsed_msg,
                localization.file_is_not_parsed_msg,
                &game_type,
                &processing_type,
            );
        }

        if !disable_other_processing {
            read_other(
                &original_path,
                &other_path,
                romanize,
                logging,
                localization.file_parsed_msg,
                localization.file_already_parsed_msg,
                localization.file_is_not_parsed_msg,
                &game_type,
                &processing_type,
            );
        }

        if !disable_system_processing {
            read_system(
                &system_file_path,
                &other_path,
                romanize,
                logging,
                localization.file_parsed_msg,
                localization.file_already_parsed_msg,
                localization.file_is_not_parsed_msg,
                &processing_type,
            );
        }
    } else {
        use write::*;

        if !maps_path.exists() || !other_path.exists() {
            panic!("{}", localization.translation_dirs_missing);
        }

        let plugins_path: PathBuf = input_dir.join("translation/plugins");

        let (output_path, plugins_output_path) = if output_dir.as_os_str().as_encoded_bytes() == "./".as_bytes() {
            (input_dir.join("output/data"), input_dir.join("output/js"))
        } else {
            (output_dir.join("output/data"), output_dir.join("output/js"))
        };

        create_dir_all(&output_path).unwrap();
        create_dir_all(&plugins_output_path).unwrap();

        let shuffle_level: u8 = *subcommand_matches.get_one::<u8>("shuffle-level").unwrap();

        if shuffle_level > 0 {
            seed(69);
        }

        if metadata_file_path.exists() {
            let metadata: Object = from_str(&read_to_string(metadata_file_path).unwrap()).unwrap();

            let romanize_bool: bool = metadata["romanize"].as_bool().unwrap();
            let disable_custom_processing_bool: bool = metadata["disableCustomProcessing"].as_bool().unwrap();

            if romanize_bool {
                println!("{}", localization.enabling_romanize_metadata_msg);
                romanize = romanize_bool;
            }

            if disable_custom_processing_bool && game_type.is_some() {
                println!("{}", localization.disabling_custom_processing_metadata_msg);
                game_type = None;
            }
        }

        if !disable_maps_processing {
            write_maps(
                &maps_path,
                &original_path,
                &output_path,
                romanize,
                shuffle_level,
                logging,
                localization.file_written_msg,
                &game_type,
            );
        }

        if !disable_other_processing {
            write_other(
                &other_path,
                &original_path,
                &output_path,
                romanize,
                shuffle_level,
                logging,
                localization.file_written_msg,
                &game_type,
            );
        }

        if !disable_system_processing {
            write_system(
                &system_file_path,
                &other_path,
                &output_path,
                romanize,
                shuffle_level,
                logging,
                localization.file_written_msg,
            );
        }

        if !disable_plugins_processing
            && plugins_path.exists()
            && game_type.is_some()
            && game_type.unwrap() == GameType::Termina
        {
            write_plugins(
                &plugins_path.join("plugins.json"),
                &plugins_path,
                &plugins_output_path,
                shuffle_level,
                logging,
                localization.file_written_msg,
            );
        }
    }

    println!(
        "{} {}",
        localization.done_in_msg,
        start_time.elapsed().as_secs_f64() - wait_time
    );
}
