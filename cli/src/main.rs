use clap::{value_parser, Arg, ArgAction, ArgMatches, Command};
use color_print::{cformat, cstr};
use std::{
    env::args,
    fs::create_dir_all,
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
    about: &'a str,
    read: &'a str,
    write: &'a str,
    no: &'a str,
    log: &'a str,
    input_dir: &'a str,
    output_dir: &'a str,
    drunk: &'a str,
    language: &'a str,
    help: &'a str,
    help_template: &'a str,
    subcommand_help_template: &'a str,
    possible_values: &'a str,
    example: &'a str,
    default_value: &'a str,
    input_dir_value_name: &'a str,
    output_dir_value_name: &'a str,
    no_arg_value_name: &'a str,
    drunk_arg_value_name: &'a str,
    language_arg_value_name: &'a str,
    write_input_path_does_not_exist: &'a str,
    read_input_path_does_not_exist: &'a str,
    write_log: &'a str,
    read_log: &'a str,
    write_success: &'a str,
    read_success: &'a str,
}

impl<'a> ProgramLocalization<'a> {
    fn new(language: &str) -> Self {
        match language {
            "ru" => ProgramLocalization {
                about: cstr!("<bold>Репозиторий с инструментами, позволяющими редактировать текст F&H2: Termina и компилировать его в .json файлы.</bold>"),
                read: cstr!("<bold>Читает и парсит оригинальный текст из файлов игры.</bold>"),
                write: cstr!("<bold>Записывает текстовые файлы в .json файлы игры.</bold>"),
                no: "Не обрабатывает указанные файлы.",
                log: "Включает логирование.",
                input_dir: "Входная директория, содержащая папки original и translation, с оригинальным текстом игры и .txt файлами с переводом соответственно.",
                output_dir: "Выходная директория, в которой будут созданы папки data и js, содержащие скомпилированные файлы с переводом.",
                drunk: "При значении 1, перемешивает все строки перевода. При значении 2, перемешивает все слова в строках перевода.",
                language: "Устанавливает локализацию инструмента на выбранный язык.",
                help: "Выводит справочную информацию по программе либо по введёной команде.",
                help_template: cstr!("{about}\n\n<underline><bold>Использование:</bold></underline> {usage}\n\n<underline><bold>Команды:</bold></underline>\n{subcommands}\n\n<underline><bold>Опции:</bold></underline>\n{options}"),
                subcommand_help_template: cstr!("{about}\n\n<underline><bold>Использование:</bold></underline> {usage}\n\n<underline><bold>Опции:</bold></underline>\n{options}"),
                possible_values: "Разрешённые значения:",
                example: "\nПример:",
                default_value: "Значение по умолчанию:",
                input_dir_value_name: "ВХОДНОЙ_ПУТЬ",
                output_dir_value_name: "ВЫХОДНОЙ_ПУТЬ",
                no_arg_value_name: "ИМЕНА_ФАЙЛОВ",
                drunk_arg_value_name: "ЦИФРА",
                language_arg_value_name: "ЯЗЫК",
                write_input_path_does_not_exist:"Путь к входной директории, либо папкам original/translation, которые должны находиться внутри входной директории, не существует.",
                write_log: "Записан файл",
                write_success: "Все файлы были записаны успешно.\nПотрачено (в секундах):",
                read_input_path_does_not_exist: "Путь к входной директории не существует.",
                read_success: "Весь игровой текст был успешно запарсен.\nПотрачено (в секундах):",
                read_log: "Распарсен файл",
            },
            "en" => ProgramLocalization {
                about: cstr!("<bold>Repository with tools for editing F&H2: Termina text and compiling it into .json files.</bold>"),
                read: cstr!("<bold>Reads and parses the original text from the game files.</bold>"),
                write: cstr!("<bold>Writes the parsed text to the .json files of the game.</bold>"),
                no: "Skips processing the specified files.",
                log: "Enables logging.",
                input_dir: "Input directory, containing original and translation folders with the original game text and translation .txt files respectively.",
                output_dir: "Output directory, where the data and js folders will be created with compiled translation files.",
                drunk: "With value 1, shuffles all translation lines. With value 2, shuffles all words in translation lines.",
                language: "Sets the localization of the tool to the selected language.",
                help: "Prints the program's help message or for the entered subcommand.",
                help_template: cstr!("{about}\n\n<underline><bold>Usage:</bold></underline> {usage}\n\n<underline><bold>Commands:</bold></underline>\n{subcommands}\n\n<underline><bold>Options:</bold></underline>\n{options}"),
                subcommand_help_template: cstr!("{about}\n\n<underline><bold>Usage:</bold></underline> {usage}\n\n<underline><bold>Options:</bold></underline>\n{options}"),
                possible_values: "Allowed values:",
                example: "Example:",
                default_value: "Default value:",
                input_dir_value_name: "INPUT_PATH",
                output_dir_value_name: "OUTPUT_PATH",
                no_arg_value_name: "FILENAMES",
                drunk_arg_value_name: "NUMBER",
                language_arg_value_name: "LANGUAGE",
                write_input_path_does_not_exist: "The path to the input directory, or the directories original/translation, which should be in the input directory, does not exist.",
                write_log: "Wrote file",
                write_success: "All files were written successfully.\nTime spent (in seconds):",
                read_input_path_does_not_exist: "The path to the output directory does not exist.",
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
        .help(localization.help)
        .action(clap::ArgAction::Help);

    // Read subcommand
    const POSSIBLE_READ_NO_VALUES: [&str; 3] = ["maps", "other", "system"];
    let read_no_arg: Arg = Arg::new("no")
        .long("no")
        .value_delimiter(',')
        .value_name(localization.no_arg_value_name)
        .help(cformat!(
            "{} {} --no=maps,other,system.<bold>\n[{} {}]</bold>",
            localization.no,
            localization.example,
            localization.possible_values,
            POSSIBLE_READ_NO_VALUES.join(", ")
        ))
        .value_parser(POSSIBLE_READ_NO_VALUES)
        .hide_possible_values(true);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read)
        .arg(read_no_arg)
        .arg(&help_arg);

    // Write subcommand
    const POSSIBLE_WRITE_NO_VALUES: [&str; 4] = ["maps", "other", "system", "plugins"];
    let write_no_arg: Arg = Arg::new("no")
        .long("no")
        .value_delimiter(',')
        .value_name(localization.no_arg_value_name)
        .help(cformat!(
            "{} {} --no=maps,other,system,plugins.<bold>\n[{} {}]</bold>",
            localization.no,
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
        .value_name(localization.drunk_arg_value_name)
        .default_value("0")
        .value_parser(value_parser!(u8).range(0..=2))
        .help(cformat!(
            "{} {} --drunk 1.<bold>\n[{} {}]\n[{} {}]</bold>",
            localization.drunk,
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
        .about(localization.write)
        .arg(write_no_arg)
        .arg(drunk_arg)
        .arg(&help_arg);

    // Main subcommand
    let input_dir_arg: Arg = Arg::new("input_dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir)
        .value_name(localization.input_dir_value_name)
        .value_parser(value_parser!(PathBuf));

    let output_dir_arg: Arg = Arg::new("output_dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(localization.output_dir)
        .value_name(localization.output_dir_value_name)
        .value_parser(value_parser!(PathBuf));

    let language_arg: Arg = Arg::new("language")
        .short('l')
        .long("language")
        .value_name(localization.language_arg_value_name)
        .global(true)
        .help(cformat!(
            "{} {} --language en.<bold>\n[{} {}]</bold>",
            localization.language,
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
        .help(localization.log);

    let cli: Command = Command::new("fh-termina-json-writer")
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .term_width(80)
        .about(localization.about)
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
                    PathBuf::from("../")
                };

            if !Path::new(&input_dir).exists()
                || !Path::new(&input_dir.join("original")).exists()
                || !Path::new(&input_dir.join("translation")).exists()
            {
                println!("{}", localization.write_input_path_does_not_exist);
                return;
            }

            let output_dir: PathBuf =
                if let Some(output_dir) = matches.get_one::<PathBuf>("output_dir") {
                    output_dir.join("output")
                } else {
                    PathBuf::from("./output")
                };

            struct Paths {
                original: PathBuf,
                output: PathBuf,
                maps: PathBuf,
                other: PathBuf,
                plugins: PathBuf,
                plugins_output: PathBuf,
            }

            let dir_paths: Paths = Paths {
                original: input_dir.join("original"),
                maps: input_dir.join("translation/maps"),
                other: input_dir.join("translation/other"),
                plugins: input_dir.join("translation/plugins"),
                output: output_dir.join("data"),
                plugins_output: output_dir.join("js"),
            };

            create_dir_all(&dir_paths.output).unwrap();
            create_dir_all(&dir_paths.plugins_output).unwrap();

            if write_options.0 {
                write_maps(
                    &dir_paths.original,
                    &dir_paths.maps,
                    &dir_paths.output,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            if write_options.1 {
                write_other(
                    &dir_paths.original,
                    &dir_paths.output,
                    &dir_paths.other,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            if write_options.2 {
                write_system(
                    &dir_paths.original,
                    &dir_paths.other,
                    &dir_paths.output,
                    drunk,
                    write_options.4,
                    localization.write_log,
                );
            }

            if write_options.3 {
                write_plugins(
                    &dir_paths.plugins,
                    &dir_paths.plugins_output,
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

        "read" => {
            let input_dir: PathBuf =
                if let Some(input_dir) = matches.get_one::<PathBuf>("input_dir") {
                    input_dir.join("original")
                } else {
                    PathBuf::from("../original")
                };

            let output_dir: PathBuf =
                if let Some(output_dir) = matches.get_one::<PathBuf>("output_dir") {
                    output_dir.join("translation")
                } else {
                    PathBuf::from("./translation")
                };

            println!("{input_dir:?}, {output_dir:?}");

            if !Path::new(&input_dir).exists() {
                println!("{}", localization.read_input_path_does_not_exist);
                return;
            }

            let maps_output: PathBuf = output_dir.join("maps");
            let other_output: PathBuf = output_dir.join("other");

            create_dir_all(&maps_output).unwrap();
            create_dir_all(&other_output).unwrap();

            if write_options.0 {
                read_map(
                    &input_dir,
                    &maps_output,
                    write_options.4,
                    localization.read_log,
                );
            }

            if write_options.1 {
                read_other(
                    &input_dir,
                    &other_output,
                    write_options.4,
                    localization.read_log,
                );
            }

            if write_options.2 {
                read_system(
                    &input_dir,
                    &other_output,
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

        _ => unreachable!(),
    }
}
