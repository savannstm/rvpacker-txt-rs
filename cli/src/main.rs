use clap::{Arg, ArgMatches, Command};
use color_print::{cformat, cstr};
use rand::{rngs::ThreadRng, seq::SliceRandom, thread_rng};
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::{
    collections::HashMap,
    env::args,
    fs::{create_dir_all, read_dir, read_to_string, DirEntry},
    path::{Path, PathBuf},
    process::exit,
    time::Instant,
};
use sys_locale::get_locale;

mod read;
mod write;

use read::*;
use write::*;

struct LanguageMessages<'a> {
    about_text: &'a str,
    read_text: &'a str,
    write_text: &'a str,
    no_text: &'a str,
    log_text: &'a str,
    input_dir_text: &'a str,
    output_dir_text: &'a str,
    drunk_text: &'a str,
    language_text: &'a str,
    help_text: &'a str,
    help_template: &'a str,
    subcommand_help_template: &'a str,
    possible_values_text: &'a str,
    example_text: &'a str,
    default_value_text: &'a str,
    input_dir_value_name: &'a str,
    output_dir_value_name: &'a str,
    no_arg_value_name: &'a str,
    drunk_arg_value_name: &'a str,
    language_arg_value_name: &'a str,
}

impl<'a> LanguageMessages<'a> {
    fn new(language: &str) -> Self {
        match language {
            "ru" => LanguageMessages {
                about_text: cstr!("<bold>Репозиторий с инструментами, позволяющими редактировать текст F&H2: Termina и компилировать его в .json файлы.</bold>"),
                read_text: cstr!("<bold>Читает и парсит оригинальный текст из файлов игры.</bold>"),
                write_text: cstr!("<bold>Записывает текстовые файлы в .json файлы игры.</bold>"),
                no_text: "Не обрабатывает указанные файлы.",
                log_text: "Включает логирование.",
                input_dir_text: "Входная директория, содержащая папки original и translation, с оригинальным текстом игры и .txt файлами с переводом соответственно.",
                output_dir_text: "Выходная директория, в которой будут созданы папки data и js, содержащие скомпилированные файлы с переводом.",
                drunk_text: "При значении 1, перемешивает все строки перевода. При значении 2, перемешивает все слова в строках перевода.",
                language_text: "Устанавливает локализацию инструмента на выбранный язык.",
                help_text: "Выводит справочную информацию по программе либо по введёной команде.",
                help_template: cstr!("{about}\n\n<underline><bold>Использование:</bold></underline> {usage}\n\n<underline><bold>Команды:</bold></underline>\n{subcommands}\n\n<underline><bold>Опции:</bold></underline>\n{options}"),
                subcommand_help_template: cstr!("{about}\n\n<underline><bold>Использование:</bold></underline> {usage}\n\n<underline><bold>Опции:</bold></underline>\n{options}"),
                possible_values_text: "Разрешённые значения:",
                example_text: "\nПример:",
                default_value_text: "Значение по умолчанию:",
                input_dir_value_name: "ВХОДНОЙ_ПУТЬ",
                output_dir_value_name: "ВЫХОДНОЙ_ПУТЬ",
                no_arg_value_name: "ИМЕНА_ФАЙЛОВ",
                drunk_arg_value_name: "ЦИФРА",
                language_arg_value_name: "ЯЗЫК",
            },
            "en" => LanguageMessages {
                about_text: cstr!("<bold>Repository with tools for editing F&H2: Termina text and compiling it into .json files.</bold>"),
                read_text: cstr!("<bold>Reads and parses the original text from the game files.</bold>"),
                write_text: cstr!("<bold>Writes the parsed text to the .json files of the game.</bold>"),
                no_text: "Skips processing the specified files.",
                log_text: "Enables logging.",
                input_dir_text: "Input directory, containing original and translation folders with the original game text and translation .txt files respectively.",
                output_dir_text: "Output directory, where the data and js folders will be created with compiled translation files.",
                drunk_text: "With value 1, shuffles all translation lines. With value 2, shuffles all words in translation lines.",
                language_text: "Sets the localization of the tool to the selected language.",
                help_text: "Prints the program's help message or for the entered subcommand.",
                help_template: cstr!("{about}\n\n<underline><bold>Usage:</bold></underline> {usage}\n\n<underline><bold>Commands:</bold></underline>\n{subcommands}\n\n<underline><bold>Options:</bold></underline>\n{options}"),
                subcommand_help_template: cstr!("{about}\n\n<underline><bold>Usage:</bold></underline> {usage}\n\n<underline><bold>Options:</bold></underline>\n{options}"),
                possible_values_text: "Allowed values:",
                example_text: "Example:",
                default_value_text: "Default value:",
                input_dir_value_name: "INPUT_PATH",
                output_dir_value_name: "OUTPUT_PATH",
                no_arg_value_name: "FILENAMES",
                drunk_arg_value_name: "NUMBER",
                language_arg_value_name: "LANGUAGE",
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

    let localization: LanguageMessages = LanguageMessages::new(language);

    // Help argument
    let help_arg: Arg = Arg::new("help")
        .short('h')
        .long("help")
        .help(localization.help_text)
        .action(clap::ArgAction::Help);

    // Read subcommand
    const POSSIBLE_READ_NO_VALUES: [&str; 3] = ["maps", "other", "system"];
    let read_no_arg: Arg = Arg::new("no")
        .long("no")
        .value_delimiter(',')
        .value_name(localization.no_arg_value_name)
        .help(cformat!(
            "{} {} --no=maps,other,system.<bold>\n[{} {}]</bold>",
            localization.no_text,
            localization.example_text,
            localization.possible_values_text,
            POSSIBLE_READ_NO_VALUES.join(", ")
        ))
        .value_parser(POSSIBLE_READ_NO_VALUES)
        .hide_possible_values(true);

    let read_subcommand: Command = Command::new("read")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .about(localization.read_text)
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
            localization.no_text,
            localization.example_text,
            localization.possible_values_text,
            POSSIBLE_WRITE_NO_VALUES.join(", ")
        ))
        .value_parser(POSSIBLE_WRITE_NO_VALUES)
        .hide_possible_values(true);

    let drunk_arg: Arg = Arg::new("drunk")
        .short('d')
        .long("drunk")
        .action(clap::ArgAction::Set)
        .value_name(localization.drunk_arg_value_name)
        .default_value("0")
        .value_parser(clap::value_parser!(u8).range(0..=2))
        .help(cformat!(
            "{} {} --drunk 1.<bold>\n[{} {}]\n[{} {}]</bold>",
            localization.drunk_text,
            localization.example_text,
            localization.possible_values_text,
            "0, 1, 2",
            localization.default_value_text,
            "0"
        ))
        .hide_possible_values(true)
        .hide_default_value(true);

    let write_subcommand: Command = Command::new("write")
        .disable_help_flag(true)
        .help_template(localization.subcommand_help_template)
        .next_line_help(true)
        .about(localization.write_text)
        .arg(write_no_arg)
        .arg(drunk_arg)
        .arg(&help_arg);

    // Main subcommand
    let input_dir_arg: Arg = Arg::new("input_dir")
        .short('i')
        .long("input-dir")
        .global(true)
        .help(localization.input_dir_text)
        .value_name(localization.input_dir_value_name)
        .value_parser(clap::value_parser!(PathBuf));

    let output_dir_arg: Arg = Arg::new("output_dir")
        .short('o')
        .long("output-dir")
        .global(true)
        .help(localization.output_dir_text)
        .value_name(localization.output_dir_value_name)
        .value_parser(clap::value_parser!(PathBuf));

    let language_arg: Arg = Arg::new("language")
        .short('l')
        .long("language")
        .value_name(localization.language_arg_value_name)
        .global(true)
        .help(cformat!(
            "{} {} --language en.<bold>\n[{} {}]</bold>",
            localization.language_text,
            localization.example_text,
            localization.possible_values_text,
            ALLOWED_LANGUAGES.join(", ")
        ))
        .value_parser(ALLOWED_LANGUAGES)
        .hide_possible_values(true);

    let log_arg: Arg = Arg::new("log")
        .long("log")
        .action(clap::ArgAction::SetTrue)
        .global(true)
        .help(localization.log_text);

    let cli: Command = Command::new("fh-termina-json-writer")
        .disable_version_flag(true)
        .disable_help_subcommand(true)
        .disable_help_flag(true)
        .term_width(80)
        .about(localization.about_text)
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
        .subcommand_matches("write")
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

            let input_dir: String = if let Some(input_dir) = matches.get_one::<String>("input_dir")
            {
                input_dir
            } else {
                "../"
            }
            .replace('\\', "/");

            if !Path::new(&input_dir).exists()
                || !Path::new(format!("{input_dir}/original").as_str()).exists()
                || !Path::new(format!("{input_dir}/translation").as_str()).exists()
            {
                if language == "ru" {
                    println!("Путь к входной директории, либо папкам original/translation, которая должна находится внутри входной директории, не существует.");
                } else {
                    println!("The path to the input directory, or the directories original/translation, which should be in the input directory, does not exist.");
                }
                return;
            }

            let output_dir: String =
                if let Some(output_dir) = matches.get_one::<String>("output_dir") {
                    output_dir
                } else {
                    "./output"
                }
                .replace('\\', "/");

            struct Paths {
                original: String,
                output: String,
                maps: String,
                maps_trans: String,
                names: String,
                names_trans: String,
                other: String,
                plugins: String,
                plugins_output: String,
            }

            let dir_paths: Paths = Paths {
                original: format!("{input_dir}/original"),
                output: format!("{output_dir}/data"),
                maps: format!("{input_dir}/translation/maps/maps.txt"),
                maps_trans: format!("{input_dir}/translation/maps/maps_trans.txt"),
                names: format!("{input_dir}/translation/maps/names.txt"),
                names_trans: format!("{input_dir}/translation/maps/names_trans.txt"),
                other: format!("{input_dir}/translation/other"),
                plugins: format!("{input_dir}/translation/plugins"),
                plugins_output: format!("{output_dir}/js"),
            };

            create_dir_all(&dir_paths.output).unwrap();
            create_dir_all(&dir_paths.plugins_output).unwrap();

            if write_options.0 {
                let maps_hashmap: HashMap<String, Value> = read_dir(&dir_paths.original)
                    .unwrap()
                    .par_bridge()
                    .flatten()
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<String, Value>, path: DirEntry| {
                            let filename: String = path.file_name().into_string().unwrap();

                            if filename.starts_with("Map") {
                                hashmap.insert(
                                    filename,
                                    merge_map(
                                        from_str(&read_to_string(path.path()).unwrap()).unwrap(),
                                    ),
                                );
                            }
                            hashmap
                        },
                    )
                    .reduce(
                        HashMap::new,
                        |mut a: HashMap<String, Value>, b: HashMap<String, Value>| {
                            a.extend(b);
                            a
                        },
                    );

                let maps_original_text_vec: Vec<String> = read_to_string(dir_paths.maps)
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.replace("\\n[", "\\N[").replace("\\n", "\n"))
                    .collect();

                let mut maps_translated_text_vec: Vec<String> =
                    read_to_string(dir_paths.maps_trans)
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.replace("\\n", "\n").trim().to_string())
                        .collect();

                let maps_original_names_vec: Vec<String> = read_to_string(dir_paths.names)
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.replace("\\n[", "\\N[").replace("\\n", "\n"))
                    .collect();

                let mut maps_translated_names_vec: Vec<String> =
                    read_to_string(dir_paths.names_trans)
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.replace("\\n", "\n").trim().to_string())
                        .collect();

                if drunk > 0 {
                    let mut rng: ThreadRng = thread_rng();

                    maps_translated_text_vec.shuffle(&mut rng);
                    maps_translated_names_vec.shuffle(&mut rng);

                    if drunk == 2 {
                        for (text_string, name_string) in maps_translated_text_vec
                            .iter_mut()
                            .zip(maps_translated_names_vec.iter_mut())
                        {
                            let mut text_string_split: Vec<&str> = text_string.split(' ').collect();
                            text_string_split.shuffle(&mut rng);
                            *text_string = text_string_split.join(" ");

                            let mut name_string_split: Vec<&str> = name_string.split(' ').collect();
                            name_string_split.shuffle(&mut rng);
                            *name_string = name_string_split.join(" ");
                        }
                    }
                }

                let maps_text_hashmap: HashMap<&str, &str> = maps_original_text_vec
                    .par_iter()
                    .zip(maps_translated_text_vec.par_iter())
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<&str, &str>, (key, value): (&String, &String)| {
                            hashmap.insert(key.as_str(), value.as_str());
                            hashmap
                        },
                    )
                    .reduce(
                        HashMap::new,
                        |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                            a.extend(b);
                            a
                        },
                    );

                let maps_names_hashmap: HashMap<&str, &str> = maps_original_names_vec
                    .par_iter()
                    .zip(maps_translated_names_vec.par_iter())
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<&str, &str>, (key, value): (&String, &String)| {
                            hashmap.insert(key.as_str(), value.as_str());
                            hashmap
                        },
                    )
                    .reduce(
                        HashMap::new,
                        |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                            a.extend(b);
                            a
                        },
                    );

                write_maps(
                    maps_hashmap,
                    &dir_paths.output,
                    maps_text_hashmap,
                    maps_names_hashmap,
                    write_options.4,
                    language,
                );
            }

            if write_options.1 {
                const PREFIXES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];

                let other_hashmap: HashMap<String, Value> = read_dir(&dir_paths.original)
                    .unwrap()
                    .par_bridge()
                    .flatten()
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<String, Value>, path: DirEntry| {
                            let filename: String = path.file_name().into_string().unwrap();

                            if !PREFIXES.par_iter().any(|x: &&str| filename.starts_with(x)) {
                                hashmap.insert(
                                    filename,
                                    merge_other(
                                        from_str(&read_to_string(path.path()).unwrap()).unwrap(),
                                    ),
                                );
                            }
                            hashmap
                        },
                    )
                    .reduce(
                        HashMap::new,
                        |mut a: HashMap<String, Value>, b: HashMap<String, Value>| {
                            a.extend(b);
                            a
                        },
                    );

                write_other(
                    other_hashmap,
                    &dir_paths.output,
                    &dir_paths.other,
                    write_options.4,
                    language,
                    drunk,
                );
            }

            if write_options.2 {
                let system_json: Value = from_str(
                    &read_to_string(format!("{}/System.json", &dir_paths.original)).unwrap(),
                )
                .unwrap();

                let system_original_text: Vec<String> =
                    read_to_string(format!("{}/System.txt", dir_paths.other))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                let mut system_translated_text: Vec<String> =
                    read_to_string(format!("{}/System_trans.txt", dir_paths.other))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                if drunk > 0 {
                    let mut rng: ThreadRng = thread_rng();

                    system_translated_text.shuffle(&mut rng);

                    if drunk == 2 {
                        for text_string in system_translated_text.iter_mut() {
                            let mut text_string_split: Vec<&str> = text_string.split(' ').collect();
                            text_string_split.shuffle(&mut rng);
                            *text_string = text_string_split.join(" ");
                        }
                    }
                }

                let system_text_hashmap: HashMap<&str, &str> = system_original_text
                    .par_iter()
                    .zip(system_translated_text.par_iter())
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<&str, &str>, (key, value): (&String, &String)| {
                            hashmap.insert(key.as_str(), value.as_str());
                            hashmap
                        },
                    )
                    .reduce(
                        HashMap::new,
                        |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                            a.extend(b);
                            a
                        },
                    );

                write_system(
                    system_json,
                    &dir_paths.output,
                    system_text_hashmap,
                    write_options.4,
                    language,
                );
            }

            if write_options.3 {
                let plugins_json: Vec<Value> = from_str(
                    &read_to_string(format!("{}/plugins.json", dir_paths.plugins)).unwrap(),
                )
                .unwrap();

                let plugins_original_text_vec: Vec<String> =
                    read_to_string(format!("{}/plugins.txt", dir_paths.plugins))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                let mut plugins_translated_text_vec: Vec<String> =
                    read_to_string(format!("{}/plugins_trans.txt", dir_paths.plugins))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                if drunk > 0 {
                    let mut rng: ThreadRng = thread_rng();

                    plugins_translated_text_vec.shuffle(&mut rng);

                    if drunk == 2 {
                        for text_string in plugins_translated_text_vec.iter_mut() {
                            let mut text_string_split: Vec<&str> = text_string.split(' ').collect();
                            text_string_split.shuffle(&mut rng);
                            *text_string = text_string_split.join(" ");
                        }
                    }
                }

                write_plugins(
                    plugins_json,
                    &dir_paths.plugins_output,
                    plugins_original_text_vec,
                    plugins_translated_text_vec,
                    write_options.4,
                    language,
                );
            }

            if language == "ru" {
                println!(
                    "Все файлы были записаны успешно.\nПотрачено (в секундах): {}.",
                    start_time.elapsed().as_secs_f64()
                );
            } else {
                println!(
                    "All files were successfully written.\nTime spent (in seconds): {}.",
                    start_time.elapsed().as_secs_f64()
                );
            }
        }

        "read" => {
            let input_dir: String = if let Some(input_dir) = matches.get_one::<String>("input_dir")
            {
                input_dir
            } else {
                "../original"
            }
            .replace('\\', "/");

            let output_dir: String =
                if let Some(output_dir) = matches.get_one::<String>("output_dir") {
                    output_dir
                } else {
                    "./parsed"
                }
                .replace('\\', "/");

            if !Path::new(&input_dir).exists() {
                if language == "ru" {
                    println!("Путь к входной директории не существует.");
                } else {
                    println!("The path to the input directory does not exist.");
                }
                return;
            }

            create_dir_all(&output_dir).unwrap();

            if write_options.0 {
                read_map(&input_dir, &output_dir, write_options.4, language);
            }

            if write_options.1 {
                read_other(&input_dir, &output_dir, write_options.4, language);
            }

            if write_options.2 {
                read_system(&input_dir, &output_dir, write_options.4, language);
            }

            if language == "ru" {
                println!(
                    "Весь игровой текст был успешно запарсен.\nПотрачено {} секунд.",
                    start_time.elapsed().as_secs_f64()
                );
            } else {
                println!(
                    "The entire game text was successfully parsed.\nTime spent: {} seconds.",
                    start_time.elapsed().as_secs_f64()
                );
            }
        }

        _ => {}
    }
}
