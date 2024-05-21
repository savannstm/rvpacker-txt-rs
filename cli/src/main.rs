use colored::{ColoredString, Colorize};
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::collections::HashMap;
use std::env::args;
use std::fs::{create_dir_all, read_dir, read_to_string};
use std::process::exit;
use std::time::Instant;

mod read;
mod write;

fn handle_args(args: Vec<String>) -> ((bool, bool, bool, bool, bool), String) {
    let mut write_options: (bool, bool, bool, bool, bool) = (true, true, true, true, false);
    let mut mode: String = String::new();

    if args.len() >= 2 {
        match args[1].as_str() {
            "-h" | "--help" => {
                struct Help {
                    desc: ColoredString,
                    usage: String,
                    commands: String,
                    options: String,
                }

                #[allow(clippy::format_in_format_args)]
                let help_ru: Help = Help {
                    desc:
                        "Данный CLI инструмент записывает .txt файлы перевода в .json файлы игры."
                            .bold(),
                    usage: String::from("Использование: json-writer команда [ОПЦИИ]"),
                    commands: format!(
                        "Команды:\n    {}{}\n    {}{}",
                        "read".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(44),
                            "Читает и парсит оригинальный текст из файлов игры. (кроме файла plugins.js)."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                        "write".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(43),
                            "Записывает перевод в файлы игры."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        )
                    ),
                    options: format!(
                        "Опции:\n    {}{}\n    {}{}\n    {}{}",
                        format!(
                            "{}, {}",
                            "-h".bold(),
                            "--help".custom_color(colored::CustomColor::new(33, 33, 33)),
                        ),
                        format!(
                            "{}{}",
                            " ".repeat(38),
                            "Выводит эту справку."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                        "-no={maps,other,system,plugins}".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(17),
                            "Отключает компиляцию указанных файлов."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                        "--log".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(43),
                            "Включает логирование."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                    ),
                };

                #[allow(clippy::format_in_format_args)]
                let help_en: Help = Help {
                    desc: "This CLI tool compiles translation .txt files to game's .json files."
                        .bold(),
                    usage: String::from("Usage: json-writer command [OPTIONS]"),
                    commands: format!(
                        "Commands:\n    {}{}\n    {}{}",
                        "read".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(44),
                            "Reads and parses the original game text from game files. (except plugins.js)."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                        "write".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(43),
                            "Writes a translation to game files."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        )
                    ),
                    options: format!(
                        "Options:\n    {}{}\n    {}{}\n    {}{}",
                        format!(
                            "{}, {}",
                            "-h".bold(),
                            "--help".custom_color(colored::CustomColor::new(33, 33, 33)),
                        ),
                        format!(
                            "{}{}",
                            " ".repeat(38),
                            "Shows this help message."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                        "-no={maps,other,system,plugins}".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(17),
                            "Disables compilation of the specified files."
                                .custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                        "--log".bold(),
                        format!(
                            "{}{}",
                            " ".repeat(43),
                            "Enables logging.".custom_color(colored::CustomColor::new(33, 33, 33))
                        ),
                    ),
                };

                println!(
                    "\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}\n\n{}",
                    help_ru.desc,
                    help_ru.usage,
                    help_ru.commands,
                    help_ru.options,
                    help_en.desc,
                    help_en.usage,
                    help_en.commands,
                    help_en.options,
                );

                exit(0);
            }

            "write" => mode = String::from("write"),

            "read" => mode = String::from("read"),

            _ => {
                println!("\nНеверное значение аргумента.\nДопустимые значения: write, read.\n\nIncorrect argument value. Available values: write, read.");
                exit(1);
            }
        }

        for arg in args.iter().skip(2) {
            match arg.as_str() {
                "-h" | "--help" => {
                    #[allow(clippy::format_in_format_args)]
                    if mode == "read" {
                        println!("\n{}\n\n{}",
                        "Читает и парсит оригинальный текст из файлов игры. (кроме файла plugins.js).".bold(),
                        format!(
                            "Опции:\n    {}{}\n    {}{}\n    {}{}",
                            format!(
                                "{}, {}",
                                "-h".bold(),
                                "--help"
                                    .custom_color(colored::CustomColor::new(33, 33, 33)),
                                ),
                            format!(
                                "{}{}",
                                " ".repeat(38),
                                "Выводит эту справку."
                                    .custom_color(colored::CustomColor::new(33, 33, 33))
                                ),
                            "-no={maps,other,system}".bold(),
                            format!(
                                "{}{}",
                                " ".repeat(25),
                                "Отключает компиляцию указанных файлов."
                                    .custom_color(colored::CustomColor::new(33, 33, 33))
                                ),
                            "--log".bold(),
                            format!(
                                "{}{}",
                                " ".repeat(43),
                                "Включает логирование."
                                    .custom_color(colored::CustomColor::new(33, 33, 33))
                                ),
                            )
                        );
                    } else if mode == "write" {
                        println!(
                            "\n{}\n\n{}",
                            "Записывает перевод в файлы игры.".bold(),
                            format!(
                                "Опции:\n    {}{}\n    {}{}\n    {}{}",
                                format!(
                                    "{}, {}",
                                    "-h".bold(),
                                    "--help".custom_color(colored::CustomColor::new(33, 33, 33)),
                                ),
                                format!(
                                    "{}{}",
                                    " ".repeat(38),
                                    "Выводит эту справку."
                                        .custom_color(colored::CustomColor::new(33, 33, 33))
                                ),
                                "-no={maps,other,system,plugins}".bold(),
                                format!(
                                    "{}{}",
                                    " ".repeat(17),
                                    "Отключает компиляцию указанных файлов."
                                        .custom_color(colored::CustomColor::new(33, 33, 33))
                                ),
                                "--log".bold(),
                                format!(
                                    "{}{}",
                                    " ".repeat(43),
                                    "Включает логирование."
                                        .custom_color(colored::CustomColor::new(33, 33, 33))
                                ),
                            )
                        )
                    };

                    exit(0);
                }

                "-no" => {
                    for arg in arg[4..].split(',') {
                        match arg {
                            "maps" => write_options.0 = false,
                            "other" => write_options.1 = false,
                            "system" => write_options.2 = false,
                            "plugins" => write_options.3 = false,
                            _ => {
                                println!("\nНеверные значения аргумента -no.\nДопустимые значения: maps, other, system, plugins.");
                                exit(1);
                            }
                        }
                    }
                }

                "--log" => {
                    write_options.4 = true;
                }

                _ => {}
            }
        }
    } else {
        println!("\nКоманда не задана. Прерываю работу. Для получения справки, вызовите json-writer -h.\nCommand not specified. Exiting. For help, call json-writer -h.");
    }

    (write_options, mode)
}

fn main() {
    let start_time: Instant = Instant::now();

    let args: Vec<String> = args().collect();

    let settings: ((bool, bool, bool, bool, bool), String) = handle_args(args);

    let write_options: (bool, bool, bool, bool, bool) = settings.0;
    let mode: String = settings.1;

    match mode.as_str() {
        "write" => {
            struct Paths {
                original: &'static str,
                output: &'static str,
                maps: &'static str,
                maps_trans: &'static str,
                names: &'static str,
                names_trans: &'static str,
                other: &'static str,
                plugins: &'static str,
                plugins_output: &'static str,
            }

            let dir_paths: Paths = Paths {
                original: "../original",
                output: "./data",
                maps: "../translation/maps/maps.txt",
                maps_trans: "../translation/maps/maps_trans.txt",
                names: "../translation/maps/names.txt",
                names_trans: "../translation/maps/names_trans.txt",
                other: "../translation/other",
                plugins: "../translation/plugins",
                plugins_output: "./js",
            };

            create_dir_all(dir_paths.output).unwrap();
            create_dir_all(dir_paths.plugins_output).unwrap();

            if write_options.0 {
                let maps_hashmap: HashMap<String, Value> = read_dir(dir_paths.original)
                    .unwrap()
                    .par_bridge()
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<String, Value>,
                         path: Result<std::fs::DirEntry, std::io::Error>| {
                            let filename: String =
                                path.as_ref().unwrap().file_name().into_string().unwrap();

                            if filename.starts_with("Map") {
                                hashmap.insert(
                                    filename,
                                    write::merge_map(
                                        from_str(&read_to_string(path.unwrap().path()).unwrap())
                                            .unwrap(),
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

                let maps_translated_text_vec: Vec<String> = read_to_string(dir_paths.maps_trans)
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.replace("\\n", "\n").trim().to_string())
                    .collect();

                let maps_original_names_vec: Vec<String> = read_to_string(dir_paths.names)
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.replace("\\n[", "\\N[").replace("\\n", "\n"))
                    .collect();

                let maps_translated_names_vec: Vec<String> = read_to_string(dir_paths.names_trans)
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.replace("\\n", "\n").trim().to_string())
                    .collect();

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

                write::write_maps(
                    maps_hashmap,
                    dir_paths.output,
                    maps_text_hashmap,
                    maps_names_hashmap,
                    write_options.4,
                );
            }

            if write_options.1 {
                const PREFIXES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];

                let other_hashmap: HashMap<String, Value> = read_dir(dir_paths.original)
                    .unwrap()
                    .par_bridge()
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<String, Value>,
                         path: Result<std::fs::DirEntry, std::io::Error>| {
                            let filename: String =
                                path.as_ref().unwrap().file_name().into_string().unwrap();

                            if !PREFIXES.par_iter().any(|x: &&str| filename.starts_with(x)) {
                                hashmap.insert(
                                    filename,
                                    write::merge_other(
                                        from_str(&read_to_string(path.unwrap().path()).unwrap())
                                            .unwrap(),
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

                write::write_other(
                    other_hashmap,
                    dir_paths.output,
                    dir_paths.other,
                    write_options.4,
                );
            }

            if write_options.2 {
                let system_json: Value = from_str(
                    &read_to_string(format!("{}/System.json", dir_paths.original)).unwrap(),
                )
                .unwrap();

                let system_original_text: Vec<String> =
                    read_to_string(format!("{}/System.txt", dir_paths.other))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                let system_translated_text: Vec<String> =
                    read_to_string(format!("{}/System_trans.txt", dir_paths.other))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

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

                write::write_system(
                    system_json,
                    dir_paths.output,
                    system_text_hashmap,
                    write_options.4,
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

                let plugins_translated_text_vec: Vec<String> =
                    read_to_string(format!("{}/plugins_trans.txt", dir_paths.plugins))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                write::write_plugins(
                    plugins_json,
                    dir_paths.plugins_output,
                    plugins_original_text_vec,
                    plugins_translated_text_vec,
                    write_options.4,
                );
            }

            println!(
                "Все файлы были записаны успешно.\nПотрачено {} секунд.",
                start_time.elapsed().as_secs_f64()
            );
        }

        "read" => {
            const INPUT_DIR: &str = "../original";
            const OUTPUT_DIR: &str = "./parsed";

            create_dir_all(OUTPUT_DIR).unwrap();

            if write_options.0 {
                read::read_map(INPUT_DIR, OUTPUT_DIR, write_options.4);
            }

            if write_options.1 {
                read::read_other(INPUT_DIR, OUTPUT_DIR, write_options.4);
            }

            if write_options.2 {
                read::read_system(INPUT_DIR, OUTPUT_DIR, write_options.4);
            }

            println!(
                "Весь игровой текст был успешно запарсен.\nПотрачено {} секунд.",
                start_time.elapsed().as_secs_f64()
            );
        }

        _ => {}
    }
}
