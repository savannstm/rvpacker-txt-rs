use clap::{value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::{cformat, cstr};
use fancy_regex::Regex;
use std::{
    env::args,
    fs::{create_dir_all, read_dir, DirEntry},
    path::{Path, PathBuf},
    process::exit,
    time::Instant,
};
use sys_locale::get_locale;

mod read;
mod write;

use read::*;
use write::*;

mod shuffle;
use shuffle::shuffle_words;

struct ProgramLocalization<'a> {
    program_desc: &'a str,
    read_command_desc: &'a str,
    write_command_desc: &'a str,
    no_arg_desc: &'a str,
    log_arg_desc: &'a str,
    input_dir_arg_desc: &'a str,
    output_dir_arg_desc: &'a str,
    drunk_arg_desc: &'a str,
    language_arg_desc: &'a str,
    help_arg_desc: &'a str,
    help_template: &'a str,
    subcommand_help_template: &'a str,
    possible_values: &'a str,
    example: &'a str,
    default_value: &'a str,
    input_dir_arg_type: &'a str,
    output_dir_arg_type: &'a str,
    no_arg_type: &'a str,
    drunk_arg_type: &'a str,
    language_arg_type: &'a str,
    input_dir_does_not_exist: &'a str,
    original_dir_missing: &'a str,
    translation_dirs_missing: &'a str,
    write_log: &'a str,
    read_log: &'a str,
    write_success: &'a str,
    read_success: &'a str,
}

impl<'a> ProgramLocalization<'a> {
    fn new(language: &str) -> Self {
        match language {
            "ru" => ProgramLocalization {
                program_desc: cstr!("<bold>Инструмент, позволяющий парсить текст .json файлов RPG Maker MV/MZ игр в .txt файлы, а затем записывать их обратно.</bold>"),
                read_command_desc: cstr!("<bold>Парсит файлы из папки \"original\" или \"data\" входной директории в папку \"translation\" выходной директории.</bold>"),
                write_command_desc: cstr!("<bold>Записывает переведенные файлы, используя исходные файлы из папки \"original\" или \"data\" входной директории, заменяя текст файлами из папки \"translation\" и выводя результаты в папку \"output\".</bold>"),
                no_arg_desc: "Не обрабатывает указанные файлы.",
                log_arg_desc: "Включает логирование.",
                input_dir_arg_desc: "Входная директория, содержащая папки \"original\" или \"data\" и \"translation\", с оригинальным текстом игры и .txt файлами с переводом соответственно.",
                output_dir_arg_desc: "Выходная директория, в которой будут создана директория \"output\" с папками \"data\" и \"js\", содержащими скомпилированные файлы с переводом.",
                drunk_arg_desc: "При значении 1, перемешивает все строки перевода. При значении 2, перемешивает все слова в строках перевода.",
                language_arg_desc: "Устанавливает локализацию инструмента на выбранный язык.",
                help_arg_desc: "Выводит справочную информацию по программе либо по введёной команде.",
                help_template: cstr!("{about}\n\n<underline><bold>Использование:</bold></underline> {usage}\n\n<underline><bold>Команды:</bold></underline>\n{subcommands}\n\n<underline><bold>Опции:</bold></underline>\n{options}"),
                subcommand_help_template: cstr!("{about}\n\n<underline><bold>Использование:</bold></underline> {usage}\n\n<underline><bold>Опции:</bold></underline>\n{options}"),
                possible_values: "Разрешённые значения:",
                example: "\nПример:",
                default_value: "Значение по умолчанию:",
                input_dir_arg_type: "ВХОДНОЙ_ПУТЬ",
                output_dir_arg_type: "ВЫХОДНОЙ_ПУТЬ",
                no_arg_type: "ИМЕНА_ФАЙЛОВ",
                drunk_arg_type: "ЦИФРА",
                language_arg_type: "ЯЗЫК",
                input_dir_does_not_exist: "Входная директория не существует.",
                original_dir_missing: "Папка \"original\" или \"data\" входной директории не существует.",
                translation_dirs_missing: "Папки \"translation/maps\" и/или \"translation/other\" входной директории не существуют.",
                write_log: "Записан файл",
                write_success: "Все файлы были записаны успешно.\nПотрачено (в секундах):",
                read_success: "Весь игровой текст был успешно запарсен.\nПотрачено (в секундах):",
                read_log: "Распарсен файл",
            },
            "en" => ProgramLocalization {
                program_desc: cstr!("<bold>A tool that parses .json files of RPG Maker MV/MZ games into .txt files and vice versa.</bold>"),
                read_command_desc: cstr!("<bold>Parses files from \"original\" or \"data\" folders of input directory to \"translation\" folder of output directory.</bold>"),
                write_command_desc: cstr!("<bold>Writes translated files using original files from \"original\" or \"data\" folders of input directory and writes results to \"output\" folder of output directory.</bold>"),
                no_arg_desc: "Skips processing the specified files.",
                log_arg_desc: "Enables logging.",
                input_dir_arg_desc: "Input directory, containing folders \"original\" or \"data\" and \"translation\", with original game text and .txt files with translation respectively.",
                output_dir_arg_desc: "Output directory, containing an \"output\" folder with folders \"data\" and \"js\", containing compiled .txt files with translation.",
                drunk_arg_desc: "With value 1, shuffles all translation lines. With value 2, shuffles all words in translation lines.",
                language_arg_desc: "Sets the localization of the tool to the selected language.",
                help_arg_desc: "Prints the program's help message or for the entered subcommand.",
                help_template: cstr!("{about}\n\n<underline><bold>Usage:</bold></underline> {usage}\n\n<underline><bold>Commands:</bold></underline>\n{subcommands}\n\n<underline><bold>Options:</bold></underline>\n{options}"),
                subcommand_help_template: cstr!("{about}\n\n<underline><bold>Usage:</bold></underline> {usage}\n\n<underline><bold>Options:</bold></underline>\n{options}"),
                possible_values: "Allowed values:",
                example: "Example:",
                default_value: "Default value:",
                input_dir_arg_type: "INPUT_PATH",
                output_dir_arg_type: "OUTPUT_PATH",
                no_arg_type: "FILENAMES",
                drunk_arg_type: "NUMBER",
                language_arg_type: "LANGUAGE",
                input_dir_does_not_exist: "Input directory does not exist.",
                original_dir_missing: "The \"original\" or \"data\" folder in the input directory does not exist.",
                translation_dirs_missing: "The \"translation/maps\" and/or \"translation/other\" folders in the input directory do not exist.",
                write_log: "Wrote file",
                write_success: "All files were written successfully.\nTime spent (in seconds):",
                read_success: "The entire game text was successfully parsed.\nTime spent: (in seconds):",
                read_log: "Parsed file",
            },
            _ => unreachable!(),
        }
    }
}

fn main() {
    let start_time: Instant = Instant::now();

    let mut locale: String = get_locale().unwrap_or_else(|| String::from("en_US"));

    const ALLOWED_LANGUAGES: [&str; 2] = ["ru", "en"];

    let args_vec: Vec<String> = args().collect();

    for (i, arg) in args_vec.iter().enumerate() {
        if arg == "-l"
            || arg == "--language" && ALLOWED_LANGUAGES.contains(&args_vec[i + 1].as_str())
        {
            locale = args_vec[i + 1].to_string();
        }
    }

    let language: &str = match locale.as_str() {
        "ru" => "ru",
        "uk" => "ru",
        "be" => "ru",
        _ => "en",
    };

    let localization: ProgramLocalization = ProgramLocalization::new(language);

    // Help argument
    let help_arg: Arg = Arg::new("help")
        .short('h')
        .long("help")
        .help(localization.help_arg_desc)
        .action(ArgAction::Help);

    // Read subcommand
    const POSSIBLE_READ_NO_VALUES: [&str; 3] = ["maps", "other", "system"];
    let read_no_arg: Arg = Arg::new("no")
        .long("no")
        .value_delimiter(',')
        .value_name(localization.no_arg_type)
        .help(cformat!(
            "{} {} --no=maps,other,system.<bold>\n[{} {}]</bold>",
            localization.no_arg_desc,
            localization.example,
            localization.possible_values,
            POSSIBLE_READ_NO_VALUES.join(", ")
        ))
        .value_parser(POSSIBLE_READ_NO_VALUES)
        .hide_possible_values(true);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_command_desc)
        .arg(read_no_arg)
        .arg(&help_arg);

    // Write subcommand
    const POSSIBLE_WRITE_NO_VALUES: [&str; 4] = ["maps", "other", "system", "plugins"];
    let write_no_arg: Arg = Arg::new("no")
        .long("no")
        .value_delimiter(',')
        .value_name(localization.no_arg_type)
        .help(cformat!(
            "{} {} --no=maps,other,system,plugins.<bold>\n[{} {}]</bold>",
            localization.no_arg_desc,
            localization.example,
            localization.possible_values,
            POSSIBLE_WRITE_NO_VALUES.join(", ")
        ))
        .value_parser(POSSIBLE_WRITE_NO_VALUES)
        .hide_possible_values(true);

    let drunk_arg: Arg = Arg::new("drunk")
        .short('d')
        .long("drunk")
        .action(ArgAction::Set)
        .value_name(localization.drunk_arg_type)
        .default_value("0")
        .value_parser(value_parser!(u8).range(0..=2))
        .help(cformat!(
            "{} {} --drunk 1.<bold>\n[{} {}]\n[{} {}]</bold>",
            localization.drunk_arg_desc,
            localization.example,
            localization.possible_values,
            "0, 1, 2",
            localization.default_value,
            "0"
        ))
        .hide_possible_values(true)
        .hide_default_value(true);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .next_line_help(true)
        .about(localization.write_command_desc)
        .arg(write_no_arg)
        .arg(drunk_arg)
        .arg(&help_arg);

    // Main subcommand
    let input_dir_arg: Arg = Arg::new("input_dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir_arg_desc)
        .value_name(localization.input_dir_arg_type)
        .value_parser(value_parser!(PathBuf));

    let output_dir_arg: Arg = Arg::new("output_dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(localization.output_dir_arg_desc)
        .value_name(localization.output_dir_arg_type)
        .value_parser(value_parser!(PathBuf));

    let language_arg: Arg = Arg::new("language")
        .short('l')
        .long("language")
        .value_name(localization.language_arg_type)
        .global(true)
        .help(cformat!(
            "{} {} --language en.<bold>\n[{} {}]</bold>",
            localization.language_arg_desc,
            localization.example,
            localization.possible_values,
            ALLOWED_LANGUAGES.join(", ")
        ))
        .value_parser(ALLOWED_LANGUAGES)
        .hide_possible_values(true);

    let log_arg: Arg = Arg::new("log")
        .long("log")
        .action(ArgAction::SetTrue)
        .global(true)
        .help(localization.log_arg_desc);

    let cli: Command = Command::new("fh-termina-json-writer")
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .term_width(80)
        .about(localization.program_desc)
        .help_template(localization.help_template)
        .subcommands([read_subcommand, write_subcommand])
        .arg(input_dir_arg)
        .arg(output_dir_arg)
        .arg(language_arg)
        .arg(log_arg)
        .arg(help_arg);

    let matches: ArgMatches = cli.get_matches();

    let mode: &str = if let Some(subcommand) = matches.subcommand_name() {
        subcommand
    } else {
        exit(1);
    };

    let mut write_options = (true, true, true, true, false);

    if let Some(no_values) = matches
        .subcommand_matches(mode)
        .unwrap()
        .get_one::<String>("no")
    {
        for no_value in no_values.split(',').collect::<Vec<&str>>() {
            match no_value {
                "maps" => write_options.0 = false,
                "other" => write_options.1 = false,
                "system" => write_options.2 = false,
                "plugins" => write_options.3 = false,
                _ => {}
            }
        }
    }

    if matches.get_flag("log") {
        write_options.4 = true;
    }

    match mode {
        "read" => {
            let input_dir: PathBuf =
                if let Some(input_dir) = matches.get_one::<PathBuf>("input_dir") {
                    input_dir.to_owned()
                } else {
                    PathBuf::from("./")
                };

            if !Path::new(&input_dir).exists() {
                panic!("{}", localization.input_dir_does_not_exist);
            }

            let output_dir: PathBuf =
                if let Some(output_dir) = matches.get_one::<PathBuf>("output_dir") {
                    output_dir.to_owned()
                } else {
                    PathBuf::from("./")
                };

            struct Paths {
                original: PathBuf,
                maps: PathBuf,
                other: PathBuf,
            }

            let mut paths: Paths = Paths {
                original: input_dir.join("original"),
                maps: output_dir.join("translation/maps"),
                other: output_dir.join("translation/other"),
            };

            if !Path::new(&paths.original).exists() {
                let mut files = read_dir(&input_dir).unwrap().flatten();

                let re: Regex = Regex::new(r"^(?-i:data)").unwrap();
                let data_folder: Option<DirEntry> = files.find(|entry: &DirEntry| {
                    re.is_match(entry.file_name().to_str().unwrap()).unwrap()
                });

                if data_folder.is_none() {
                    panic!("{}", localization.original_dir_missing);
                }

                paths.original = data_folder.unwrap().path();
            }

            if output_dir == PathBuf::from("./") {
                paths.maps = input_dir.join("translation/maps");
                paths.other = input_dir.join("translation/other");
            }

            create_dir_all(&paths.maps).unwrap();
            create_dir_all(&paths.other).unwrap();

            if write_options.0 {
                read_map(
                    &paths.original,
                    &paths.maps,
                    write_options.4,
                    localization.read_log,
                );
            }

            if write_options.1 {
                read_other(
                    &paths.original,
                    &paths.other,
                    write_options.4,
                    localization.read_log,
                );
            }

            if write_options.2 {
                read_system(
                    &paths.original,
                    &paths.other,
                    write_options.4,
                    localization.read_log,
                );
            }

            println!(
                "{} {}.",
                localization.read_success,
                start_time.elapsed().as_secs_f64()
            );
        }

        "write" => {
            let drunk: u8 = *matches
                .subcommand_matches("write")
                .unwrap()
                .get_one::<u8>("drunk")
                .unwrap();

            let input_dir: PathBuf =
                if let Some(input_dir) = matches.get_one::<PathBuf>("input_dir") {
                    input_dir.to_owned()
                } else {
                    PathBuf::from("./")
                };

            if !Path::new(&input_dir).exists() {
                panic!("{}", localization.input_dir_does_not_exist);
            }

            let output_dir: PathBuf =
                if let Some(output_dir) = matches.get_one::<PathBuf>("output_dir") {
                    output_dir.to_owned()
                } else {
                    PathBuf::from("./")
                };

            struct Paths {
                original: PathBuf,
                output: PathBuf,
                maps: PathBuf,
                other: PathBuf,
                plugins: PathBuf,
                plugins_output: PathBuf,
            }

            let mut paths: Paths = Paths {
                original: input_dir.join("original"),
                maps: input_dir.join("translation/maps"),
                other: input_dir.join("translation/other"),
                plugins: input_dir.join("translation/plugins"),
                output: output_dir.join("output/data"),
                plugins_output: output_dir.join("output/js"),
            };

            if !Path::new(&paths.original).exists() {
                let mut files = read_dir(&input_dir).unwrap().flatten();

                let re: Regex = Regex::new(r"^(?-i:data)").unwrap();
                let data_folder: Option<DirEntry> = files.find(|entry: &DirEntry| {
                    re.is_match(entry.file_name().to_str().unwrap()).unwrap()
                });

                if data_folder.is_none() {
                    panic!("{}", localization.original_dir_missing);
                }

                paths.original = data_folder.unwrap().path();
            }

            if output_dir == PathBuf::from("./") {
                paths.output = input_dir.join("output/data");
                paths.plugins_output = input_dir.join("output/js");
            }

            if !Path::new(&paths.maps).exists() || !Path::new(&paths.other).exists() {
                panic!("{}", localization.translation_dirs_missing);
            }

            create_dir_all(&paths.output).unwrap();
            create_dir_all(&paths.plugins_output).unwrap();

            if write_options.0 {
                write_maps(
                    &paths.maps,
                    &paths.original,
                    &paths.output,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            if write_options.1 {
                write_other(
                    &paths.other,
                    &paths.original,
                    &paths.output,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            if write_options.2 {
                write_system(
                    &paths.other,
                    &paths.original,
                    &paths.output,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            if write_options.3 {
                write_plugins(
                    &paths.plugins,
                    &paths.plugins_output,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            println!(
                "{} {}.",
                localization.write_success,
                start_time.elapsed().as_secs_f64()
            );
        }

        _ => unreachable!(),
    }
}
