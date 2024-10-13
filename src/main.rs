use clap::{value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::{cformat, cstr};
use once_cell::sync::Lazy;
use regex::Regex;
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

mod read;
mod write;

#[derive(PartialEq, Clone, Copy)]
enum GameType {
    Termina,
    LisaRPG,
}

#[repr(u8)]
#[derive(PartialEq, Clone, Copy)]
enum ProcessingMode {
    Force,
    Append,
    Default,
}

#[derive(PartialEq, Clone, Copy)]
enum EngineType {
    New,
    VXAce,
    VX,
    XP,
}

#[derive(PartialEq)]
enum Code {
    Dialogue, // also goes for credit
    Choice,
    System,
    Misc,
}

enum Language {
    English,
    Russian,
}

#[derive(PartialEq, Clone, Copy)]
enum Variable {
    Name,
    Nickname,
    Description,
    Message1,
    Message2,
    Message3,
    Message4,
    Note,
}

#[derive(PartialEq, Clone, Copy)]
#[repr(u8)]
#[allow(dead_code)]
enum MapsProcessingMode {
    Default = 0,
    Separate = 1,
    Preserve = 2,
}

struct Localization<'a> {
    // About message and templates
    about_msg: &'a str,
    help_template: &'a str,
    subcommand_help_template: &'a str,

    // Command descriptions
    read_command_desc: &'a str,
    write_command_desc: &'a str,
    migrate_command_desc: &'a str,

    // Argument descriptions
    input_dir_arg_read_desc: &'a str,
    input_dir_arg_write_desc: &'a str,

    output_dir_arg_read_desc: &'a str,
    output_dir_arg_write_desc: &'a str,

    disable_processing_arg_desc: &'a str,

    romanize_desc: &'a str,

    disable_custom_processing_desc: &'a str,

    language_arg_desc: &'a str,

    log_arg_desc: &'a str,
    help_arg_desc: &'a str,

    processing_mode_arg_desc: &'a str,
    maps_processing_mode_arg_desc: &'a str,

    // Argument types
    number_arg_type: &'a str,
    input_path_arg_type: &'a str,
    output_path_arg_type: &'a str,
    disable_processing_arg_type: &'a str,
    language_arg_type: &'a str,

    // Messages and warnings
    input_dir_missing: &'a str,
    output_dir_missing: &'a str,
    original_dir_missing: &'a str,
    translation_dir_missing: &'a str,
    file_written_msg: &'a str,
    file_parsed_msg: &'a str,
    file_already_parsed_msg: &'a str,
    file_is_not_parsed_msg: &'a str,
    elapsed_time_msg: &'a str,
    force_mode_warning: &'a str,
    custom_processing_enabled_msg: &'a str,
    enabling_romanize_metadata_msg: &'a str,
    disabling_custom_processing_metadata_msg: &'a str,
    no_subcommand_specified_msg: &'a str,
    could_not_determine_game_engine_msg: &'a str,
    game_ini_file_missing_msg: &'a str,
    enabling_maps_processing_mode_metadata_msg: &'a str,

    // Misc
    possible_values: &'a str,
    example: &'a str,
    default_value: &'a str,
    when_reading: &'a str,
    when_writing: &'a str,
}

trait EachLine {
    fn each_line(&self) -> Vec<String>;
}

// Return a Vec of strings splitted by lines (inclusive), akin to each_line in Ruby
impl EachLine for str {
    fn each_line(&self) -> Vec<String> {
        let mut result: Vec<String> = Vec::new();
        let mut current_line: String = String::new();

        for char in self.chars() {
            current_line.push(char);

            if char == '\n' {
                result.push(std::mem::take(&mut current_line));
            }
        }

        if !current_line.is_empty() {
            result.push(std::mem::take(&mut current_line));
        }

        result
    }
}

impl Localization<'_> {
    fn new(language: Language) -> Self {
        match language {
            Language::English => Self::init_en(),
            Language::Russian => Self::init_ru(),
        }
    }

    fn init_en() -> Self {
        Localization {
            // About message and templates
            about_msg: cstr!(
                "<bold>This tool allows to parse RPG Maker XP/VX/VXAce/MV/MZ games text to .txt files and write them \
                 back to their initial form.</>"
            ),
            help_template: cstr!(
                "{about}\n\n<underline,bold>Usage:</> rvpacker-txt-rs COMMAND \
                 [OPTIONS]\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"
            ),
            subcommand_help_template: cstr!(
                "{about}\n\n<underline,bold>Usage:</> {usage}\n\n<underline,bold>Options:</>\n{options}"
            ),

            // Command descriptions
            read_command_desc: cstr!(
                r#"<bold>Parses files from "original" or "data" ("Data") folders of input directory to "translation" folder of output directory.</>"#
            ),
            write_command_desc: cstr!(
                r#"<bold>Writes translated files using original files from "original" or "data" ("Data") folders of input directory and writes results to "output" folder of output directory.</>"#
            ),
            migrate_command_desc: cstr!(
                r#"<bold>Migrates v1/v2 projects to v3 format. Note: maps names are implemented differently in v3, so you should do read --append after migrate, and then insert translated maps names next to Mapxxx.json comments that contain an original map name.</>"#
            ),

            // Argument descriptions
            input_dir_arg_read_desc: r#"Input directory, containing folder "original" or "data" ("Data") with original game files."#,
            input_dir_arg_write_desc: r#"Input directory, containing folder "original" or "data" ("Data") with original game files, and folder "translation" with translation .txt files."#,

            output_dir_arg_read_desc: r#"Output directory, where a "translation" folder with translation .txt files will be created."#,
            output_dir_arg_write_desc: r#"Output directory, where an "output" folder with "data" ("Data") and/or "js" subfolders with game files with translated text from .txt files will be created."#,

            disable_processing_arg_desc: "Skips processing specified files.",

            romanize_desc: r#"If you parsing text from a Japanese game, that contains symbols like 「」, which are just the Japanese quotation marks, it automatically replaces these symbols by their roman equivalents (in this case, ''). This flag will automatically be used when writing if you parsed game text with it."#,


            disable_custom_processing_desc: "Disables built-in custom processing, implemented for some games. This \
                                             flag will automatically be used when writing if you parsed game text \
                                             with it.",
            language_arg_desc: "Sets the localization of the tool to the selected language.",

            log_arg_desc: "Enables logging.",
            help_arg_desc: "Prints the program's help message or for the entered subcommand.",

            processing_mode_arg_desc: "How to process files. default - Aborts processing if encounters already existing translation .txt files.\nappend - For example, if game you're translating updates, you can use this flag to append any new text to your existing files preserving lines order.\nforce - Force rewrites existing translation .txt files.",
            maps_processing_mode_arg_desc: "How to process maps.\ndefault - Ignore all previously encountered text duplicates\nseparate - For each new map, reset the set of previously encountered text duplicates\npreserve - Allow all text duplicates.",

            // Argument types
            number_arg_type: "NUMBER",
            input_path_arg_type: "INPUT_PATH",
            output_path_arg_type: "OUTPUT_PATH",
            disable_processing_arg_type: "FILES",
            language_arg_type: "LANGUAGE",

            // Messages and warnings
            input_dir_missing: "Input directory does not exist.",
            output_dir_missing: "Output directory does not exist.",
            original_dir_missing: r#"The "original" or "data" ("Data") folder in the input directory does not exist."#,
            translation_dir_missing: r#"The "translation" folder in the input directory does not exist."#,
            file_written_msg: "Wrote file",
            file_parsed_msg: "Parsed file",
            file_already_parsed_msg: "file already exists. If you want to forcefully re-read all files, use --force \
                                      flag, or --append if you want append new text to already existing files.",
            file_is_not_parsed_msg: "Files aren't already parsed. Continuing as if --append flag was omitted.",
            elapsed_time_msg: "Elapsed time:",
            force_mode_warning: "WARNING! Force mode will forcefully rewrite all your translation files in the \
                                 folder, including _trans. Input 'Y' to continue.",
            custom_processing_enabled_msg: "Custom processing for this game will be used. Use \
                                            --disable-custom-processing to disable it.",
            enabling_romanize_metadata_msg: "Enabling romanize according to the metadata from previous read.",
            disabling_custom_processing_metadata_msg: "Disabling custom processing according to the metadata from \
                                                       previous read.",
            no_subcommand_specified_msg: "No command was specified. Call rvpacker-txt-rs -h for help.",
            could_not_determine_game_engine_msg: "Couldn't determine game engine. Check the existence of System file \
                                                  inside your data/original directory.",
            game_ini_file_missing_msg: "Game.ini file not found.",
            enabling_maps_processing_mode_metadata_msg: "Setting maps_processing_mode value to  according to the metadata from previous read.",

            // Misc
            possible_values: "Allowed values:",
            example: "Example:",
            default_value: "Default value:",
            when_reading: "When reading:",
            when_writing: "When writing:",
        }
    }

    fn init_ru() -> Self {
        Localization {
            about_msg: cstr!(
                "<bold>Инструмент, позволяющий парсить текст из файлов RPG Maker XP/VX/VXAce/MV/MZ игр в .txt файлы, \
                 а затем записывать их обратно в совместимые файлы.</>"
            ),
            help_template: cstr!(
                "{about}\n\n<underline,bold>Использование:</> rvpacker-txt-rs КОМАНДА \
                 [ОПЦИИ]\n\n<underline,bold>Команды:</>\n{subcommands}\n\n<underline,bold>Опции:</>\n{options}"
            ),
            subcommand_help_template: cstr!(
                "{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Опции:</>\n{options}"
            ),

            read_command_desc: cstr!(
                r#"<bold>Парсит файлы из папки "original" или "data" ("Data") входной директории в папку "translation" выходной директории.</>"#
            ),
            write_command_desc: cstr!(
                r#"<bold>Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" ("Data") входной директории, применяя текст из .txt файлов папки "translation", выводя результаты в папку "output" выходной директории.</>"#
            ),
            migrate_command_desc: cstr!(
                r#"<bold>Переносит проекты версий v1/v2 в формат v3. Примечание: названия карт в версии 3 реализованы по-другому, поэтому вам следует выполнить read --append после переноса, а затем вставить переведенные названия карт рядом с комментариями Mapxxx.json, которые содержат оригинальное название карты.</>"#
            ),

            input_dir_arg_read_desc: r#"Входная директория, содержащая папку "original" или "data" ("Data") с оригинальными файлами игры."#,
            input_dir_arg_write_desc: r#"Входная директория, содержащая папку "original" или "data" ("Data") с оригинальными файлами игры, а также папку "translation" с .txt файлами перевода."#,

            output_dir_arg_read_desc: r#"Выходная директория, где будет создана папка "translation" с .txt файлами перевода."#,
            output_dir_arg_write_desc: r#"Выходная директория, где будет создана папка "output" с подпапками "data" ("Data") и/или "js", содержащими игровые файлы с переведённым текстом из .txt файлов."#,

            disable_processing_arg_desc: "Не обрабатывает указанные файлы.",

            romanize_desc: r#"Если вы парсите текст из японской игры, содержащей символы вроде 「」, являющимися обычными японскими кавычками, программа автоматически заменяет эти символы на их европейские эквиваленты. (в данном случае, '')"#,

            disable_custom_processing_desc: "Отключает использование индивидуальных способов обработки текста, \
                                             имплементированных для некоторых игр. Этот флаг будет автоматически \
                                             применён при записи, если текст игры был прочитан с его использованием.",
            language_arg_desc: "Устанавливает локализацию инструмента на выбранный язык.",

            log_arg_desc: "Включает логирование.",
            help_arg_desc: "Выводит справочную информацию по программе либо по введёной команде.",

            processing_mode_arg_desc: "Как обрабатывать файлы. default - Стандартный режим. Прекращает обработку, если .txt файлы перевода уже существуют.\nappend - Режим добавления. Например, если переводимая вами игра обновится, вы можете использовать этот аргумент чтобы добавить любой новый текст в существующие файлы, сохраняя порядок линий.\nforce - Принудительный режим. Принудительный режим перезаписывает существующие .txt файлы.",
            maps_processing_mode_arg_desc: "Как обрабатывать карты.\ndefault - Игнорировать дубликаты всего ранее встреченного текста.\nseparate - Для каждой новой карты, обновлять список ранее встреченного текста.\npreserve - Разрешить все дубликаты текста.",

            number_arg_type: "ЧИСЛО",
            input_path_arg_type: "ВХОДНОЙ_ПУТЬ",
            output_path_arg_type: "ВЫХОДНОЙ_ПУТЬ",
            disable_processing_arg_type: "ИМЕНА_ФАЙЛОВ",
            language_arg_type: "ЯЗЫК",

            input_dir_missing: "Входная директория не существует.",
            output_dir_missing: "Выходная директория не существует.",
            original_dir_missing: r#"Папка "original" или "data" ("Data") входной директории не существует."#,
            translation_dir_missing: r#"Папка "translation" входной директории не существует."#,
            file_written_msg: "Записан файл",
            file_parsed_msg: "Распарсен файл",
            file_already_parsed_msg: "уже существует. Если вы хотите принудительно перезаписать все файлы, \
                                      используйте флаг --force, или --append если вы хотите добавить новый текст в \
                                      файлы.",
            file_is_not_parsed_msg: "Файлы ещё не распарсены. Продолжаем в режиме с выключенным флагом --append.",
            elapsed_time_msg: "Затраченное время:",
            force_mode_warning: "ПРЕДУПРЕЖДЕНИЕ! Принудительный режим полностью перепишет все ваши файлы перевода, \
                                 включая _trans-файлы. Введите Y, чтобы продолжить.",
            custom_processing_enabled_msg: "Индивидуальная обработка текста будет использована для этой игры. \
                                            Используйте --disable-custom-processing, чтобы отключить её.",
            enabling_romanize_metadata_msg: "В соответствии с метаданными из прошлого чтения, романизация текста \
                                             будет использована.",
            disabling_custom_processing_metadata_msg: "В соответсвии с метаданными из прошлого чтения, индивидуальная \
                                                       обработка текста будет выключена.",
            no_subcommand_specified_msg: "Команда не была указана. Вызовите rvpacker-txt-rs -h для помощи.",
            could_not_determine_game_engine_msg: "Не удалось определить движок игры. Убедитесь, что файл System \
                                                  существует.",
            game_ini_file_missing_msg: "Файл Game.ini не был обнаружен.",
            enabling_maps_processing_mode_metadata_msg: "Значение аргумента maps_processing_mode установлено на  в соответствии с метаданными из прошлого чтения.",

            possible_values: "Разрешённые значения:",
            example: "Пример:",
            default_value: "Значение по умолчанию:",
            when_reading: "При чтении:",
            when_writing: "При записи:",
        }
    }
}

pub fn romanize_string(string: String) -> String {
    let mut result: String = String::with_capacity(string.capacity());

    for char in string.chars() {
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
            '※' => "·",
            '…' | '‥' => "...",
            '　' => " ",
            'Ⅰ' => "I",
            'ⅰ' => "i",
            'Ⅱ' => "II",
            'ⅱ' => "ii",
            'Ⅲ' => "III",
            'ⅲ' => "iii",
            'Ⅳ' => "IV",
            'ⅳ' => "iv",
            'Ⅴ' => "V",
            'ⅴ' => "v",
            'Ⅵ' => "VI",
            'ⅵ' => "vi",
            'Ⅶ' => "VII",
            'ⅶ' => "vii",
            'Ⅷ' => "VIII",
            'ⅷ' => "viii",
            'Ⅸ' => "IX",
            'ⅸ' => "ix",
            'Ⅹ' => "X",
            'ⅹ' => "x",
            'Ⅺ' => "XI",
            'ⅺ' => "xi",
            'Ⅻ' => "XII",
            'ⅻ' => "xii",
            'Ⅼ' => "L",
            'ⅼ' => "l",
            'Ⅽ' => "C",
            'ⅽ' => "c",
            'Ⅾ' => "D",
            'ⅾ' => "d",
            'Ⅿ' => "M",
            'ⅿ' => "m",
            _ => {
                result.push(char);
                continue;
            }
        };

        result.push_str(replacement);
    }

    result
}

pub fn get_object_data(object: &Object) -> String {
    match object.get(&"__type") {
        Some(object_type) => {
            if object_type.as_str().is_some_and(|_type: &str| _type == "bytes") {
                unsafe { String::from_utf8_unchecked(sonic_rs::from_value(&object["data"]).unwrap_unchecked()) }
            } else {
                String::new()
            }
        }
        None => String::new(),
    }
}

pub fn extract_strings(
    ruby_code: &str,
    mode: bool,
) -> (
    indexmap::IndexSet<String, std::hash::BuildHasherDefault<xxhash_rust::xxh3::Xxh3>>,
    Vec<usize>,
) {
    fn is_escaped(index: usize, string: &str) -> bool {
        let mut backslash_count: u8 = 0;

        for char in string[..index].chars().rev() {
            if char == '\\' {
                backslash_count += 1;
            } else {
                break;
            }
        }

        backslash_count % 2 == 1
    }

    let mut strings: indexmap::IndexSet<String, std::hash::BuildHasherDefault<xxhash_rust::xxh3::Xxh3>> =
        indexmap::IndexSet::default();
    let mut indices: Vec<usize> = Vec::new();
    let mut inside_string: bool = false;
    let mut inside_multiline_comment: bool = false;
    let mut string_start_index: usize = 0;
    let mut current_quote_type: char = '\0';
    let mut global_index: usize = 0;

    for line in ruby_code.each_line() {
        let trimmed: &str = line.trim();

        if !inside_string {
            if trimmed.starts_with('#') {
                global_index += line.len();
                continue;
            }

            if trimmed.starts_with("=begin") {
                inside_multiline_comment = true;
            } else if trimmed.starts_with("=end") {
                inside_multiline_comment = false;
            }
        }

        if inside_multiline_comment {
            global_index += line.len();
            continue;
        }

        let char_indices: std::str::CharIndices = line.char_indices();

        for (i, char) in char_indices {
            if !inside_string && char == '#' {
                break;
            }

            if !inside_string && (char == '"' || char == '\'') {
                inside_string = true;
                string_start_index = global_index + i;
                current_quote_type = char;
            } else if inside_string && char == current_quote_type && !is_escaped(i, &line) {
                let extracted_string: String = ruby_code[string_start_index + 1..global_index + i]
                    .replace("\r\n", NEW_LINE)
                    .replace('\n', NEW_LINE);

                if !strings.contains(&extracted_string) {
                    strings.insert(extracted_string);
                }

                if mode {
                    indices.push(string_start_index + 1);
                }

                inside_string = false;
                current_quote_type = '\0';
            }
        }

        global_index += line.len();
    }

    (strings, indices)
}

fn get_game_type(game_title: String) -> Option<GameType> {
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

static STRING_IS_ONLY_SYMBOLS_RE: Lazy<Regex> = Lazy::new(|| unsafe {
    Regex::new(r#"^[.()+\-:;\[\]^~%&!№$@`*\/→×？?ｘ％▼|♥♪！：〜『』「」〽。…‥＝゠、，【】［］｛｝（）〔〕｟｠〘〙〈〉《》・\\#<>=_ー※▶ⅠⅰⅡⅱⅢⅲⅣⅳⅤⅴⅥⅵⅦⅶⅧⅷⅨⅸⅩⅹⅪⅺⅫⅻⅬⅼⅭⅽⅮⅾⅯⅿ\s0-9]+$"#).unwrap_unchecked()
});
static ENDS_WITH_IF_RE: Lazy<Regex> = Lazy::new(|| unsafe { Regex::new(r" if\(.*\)$").unwrap_unchecked() });
static LISA_PREFIX_RE: Lazy<Regex> = Lazy::new(|| unsafe { Regex::new(r"^(\\et\[[0-9]+\]|\\nbt)").unwrap_unchecked() });
static INVALID_MULTILINE_VARIABLE_RE: Lazy<Regex> =
    Lazy::new(|| unsafe { Regex::new(r"^#? ?<.*>.?$|^[a-z][0-9]$").unwrap_unchecked() });
static INVALID_VARIABLE_RE: Lazy<Regex> =
    Lazy::new(|| unsafe { Regex::new(r"^[+-]?[0-9]+$|^///|---|restrict eval").unwrap_unchecked() });
static _SELECT_WORDS_RE: Lazy<Regex> = Lazy::new(|| unsafe { Regex::new(r"\S+").unwrap_unchecked() });

static NEW_LINE: &str = r"\#";
static LINES_SEPARATOR: &str = "<#>";
static mut EXTENSION: &str = "";

fn main() {
    let start_time: Instant = Instant::now();

    let (language, subcommand) = {
        let preparse: Command = Command::new("preparse")
            .disable_help_flag(true)
            .disable_help_subcommand(true)
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
            let locale: String = get_locale().unwrap_or(String::from("en_US"));

            if let Some((lang, _)) = locale.split_once('_') {
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
            "{}\n{} --disable-processing=maps,other,system\n<bold>[{} maps, other, system, plugins]</>",
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

    let processing_mode_arg: Arg = Arg::new("processing-mode")
        .short('p')
        .long("processing-mode")
        .value_parser(["default", "append", "force"])
        .default_value("default")
        .value_name(localization.number_arg_type)
        .help(cformat!(
            "{}\n<bold>[{} default, append, force] [{} default]</>",
            localization.processing_mode_arg_desc,
            localization.possible_values,
            localization.default_value
        ));

    let disable_custom_processing_flag: Arg = Arg::new("disable-custom-processing")
        .long("disable-custom-processing")
        .alias("no-custom")
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
            "{}\n<bold>[{} default, separate, preserve] [{} default]</>",
            localization.maps_processing_mode_arg_desc,
            localization.possible_values,
            localization.default_value
        ))
        .value_parser(["default", "separate", "preserve"])
        .default_value("default")
        .global(true);

    let silent_flag: Arg = Arg::new("silent").long("silent").hide(true).action(ArgAction::SetTrue);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .args([processing_mode_arg, silent_flag])
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

        if !original_path.exists() {
            panic!("{}", localization.original_dir_missing)
        }
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

    let (engine_type, system_file_path, scripts_file_path): (EngineType, PathBuf, Option<PathBuf>) = {
        let mut system_path: PathBuf = original_path.join("System.json");

        if system_path.exists() {
            unsafe { EXTENSION = ".json" }
            (EngineType::New, system_path, None)
        } else {
            system_path = original_path.join("System.rvdata2");

            if system_path.exists() {
                unsafe { EXTENSION = ".rvdata2" }
                (
                    EngineType::VXAce,
                    system_path,
                    Some(original_path.join("Scripts.rvdata2")),
                )
            } else {
                system_path = original_path.join("System.rvdata");

                if system_path.exists() {
                    unsafe { EXTENSION = ".rvdata" }
                    (EngineType::VX, system_path, Some(original_path.join("Scripts.rvdata")))
                } else {
                    system_path = original_path.join("System.rxdata");

                    if system_path.exists() {
                        unsafe { EXTENSION = ".rxdata" }
                        (EngineType::XP, system_path, Some(original_path.join("Scripts.rxdata")))
                    } else {
                        panic!("{}", localization.could_not_determine_game_engine_msg)
                    }
                }
            }
        }
    };

    let mut game_type: Option<GameType> = if disable_custom_processing_flag {
        None
    } else {
        let game_title: String = if engine_type == EngineType::New {
            let system_obj: Object = from_str::<Object>(&read_to_string(&system_file_path).unwrap()).unwrap();
            system_obj["gameTitle"].as_str().unwrap().to_owned()
        } else {
            let ini_file_path: &Path = &input_dir.join("Game.ini");

            if let Ok(ini_file_content) = read_to_string(ini_file_path) {
                let mut game_title: Option<String> = None;

                for line in ini_file_content.lines() {
                    if line.to_lowercase().starts_with("title") {
                        game_title = Some(line.split_once('=').unwrap().1.trim().to_owned());
                    }
                }

                game_title.unwrap()
            } else {
                panic!("{}", localization.game_ini_file_missing_msg)
            }
        };

        get_game_type(game_title)
    };

    if game_type.is_some() {
        println!("{}", localization.custom_processing_enabled_msg);
    }

    let mut wait_time: f64 = 0f64;

    if subcommand == "read" {
        use read::*;

        let processing_mode: ProcessingMode = match subcommand_matches
            .get_one::<String>("processing-mode")
            .unwrap()
            .as_str()
        {
            "default" => ProcessingMode::Default,
            "append" => ProcessingMode::Append,
            "force" => ProcessingMode::Force,
            _ => unreachable!(),
        };

        let silent_flag: bool = subcommand_matches.get_flag("silent");

        if processing_mode == ProcessingMode::Force && !silent_flag {
            let start_time: Instant = Instant::now();
            println!("{}", localization.force_mode_warning);

            let mut buf: String = String::with_capacity(4);
            stdin().read_line(&mut buf).unwrap();

            if buf.trim_end() != "Y" {
                exit(0);
            }

            wait_time += start_time.elapsed().as_secs_f64();
        }

        create_dir_all(output_path).unwrap();
        create_dir_all(output_path).unwrap();

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
                (
                    localization.file_parsed_msg,
                    localization.file_already_parsed_msg,
                    localization.file_is_not_parsed_msg,
                ),
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
                (
                    localization.file_parsed_msg,
                    localization.file_already_parsed_msg,
                    localization.file_is_not_parsed_msg,
                ),
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
                (
                    localization.file_parsed_msg,
                    localization.file_already_parsed_msg,
                    localization.file_is_not_parsed_msg,
                ),
            );
        }

        if !disable_plugins_processing && engine_type != EngineType::New {
            read_scripts(
                &unsafe { scripts_file_path.unwrap_unchecked() },
                output_path,
                romanize_flag,
                logging_flag,
                localization.file_parsed_msg,
            );
        }
    } else if subcommand == "write" {
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
            let metadata: Object = unsafe { from_str(&read_to_string(metadata_file_path).unwrap()).unwrap_unchecked() };

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
                localization.file_written_msg,
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
                localization.file_written_msg,
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
                localization.file_written_msg,
            );
        }

        if !disable_plugins_processing && game_type.is_some_and(|game_type: GameType| game_type == GameType::Termina) {
            write_plugins(
                &output_path.join("plugins.json"),
                output_path,
                &unsafe { plugins_output_path.unwrap_unchecked() },
                logging_flag,
                localization.file_written_msg,
            );
        }

        if !disable_plugins_processing && engine_type != EngineType::New {
            write_scripts(
                &unsafe { scripts_file_path.unwrap_unchecked() },
                output_path,
                data_output_path,
                romanize_flag,
                logging_flag,
                localization.file_written_msg,
            )
        }
    } else if subcommand == "migrate" {
        let maps_path: PathBuf = output_path.join("maps");
        let other_path: PathBuf = output_path.join("other");
        let plugins_path: PathBuf = output_path.join("plugins");

        let mut original_content: String = String::new();
        let mut translated_content: String;
        let mut original_filename: String = String::new();

        for path in [maps_path, other_path, plugins_path] {
            for entry in std::fs::read_dir(path).unwrap().flatten() {
                if !entry.file_name().to_str().unwrap().contains("trans") {
                    original_content = read_to_string(entry.path()).unwrap();
                    original_filename = entry.file_name().to_str().unwrap().to_owned();
                } else {
                    translated_content = read_to_string(entry.path()).unwrap();

                    std::fs::write(
                        output_path.join(original_filename.as_str()),
                        String::from_iter(
                            original_content
                                .split('\n')
                                .zip(translated_content.split('\n'))
                                .map(|(original, translated)| format!("{original}{LINES_SEPARATOR}{translated}\n")),
                        ),
                    )
                    .unwrap();
                }
            }
        }
    }

    println!(
        "{} {}",
        localization.elapsed_time_msg,
        start_time.elapsed().as_secs_f64() - wait_time
    );
}
