use clap::{Arg, ArgMatches, Command};
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::collections::HashMap;
use std::fs::{create_dir_all, read_dir, read_to_string};
use std::process::exit;
use std::time::Instant;
use sys_locale::get_locale;

mod read;
mod write;

use read::*;
use write::*;

fn main() {
    let start_time: Instant = Instant::now();

    let locale: String = get_locale().unwrap_or_else(|| String::from("en_US"));

    let language: &str = match locale.as_str() {
        "ru" => "ru",
        "uk" => "ru",
        "be" => "ru",
        _ => "en",
    };

    let (about_text, read_text, write_text, no_text, log_text, incorrect_no) = match language {
        "ru" => (
            "Репозиторий с инструментами, позволяющими редактировать текст F&H2: Termina и компилировать его в .json файлы",
            "Читает и парсит оригинальный текст из файлов игры.",
            "Записывает текстовые файлы в .json файлы игры.",
            "Не читает указанные файлы.",
            "Включает логирование.",
            "Некорректное значение аргумента --no. Допустимые значения: maps, other, system, plugins."
        ),
        "en" => (
            "Repository with tools for editing F&H2: Termina text and compiling it into .json files",
            "Reads and parses the original text from the game files.",
            "Writes the parsed text to the .json files of the game.",
            "Skips reading the specified files.",
            "Enables logging.",
            "Incorrect value of the --no argument. Available values: maps, other, system, plugins."
        ),
        _ => unreachable!(),
    };

    let matches: ArgMatches = Command::new("fh-termina-json-writer")
        .about(about_text)
        .subcommands([
            Command::new("read").about(read_text).arg(
                Arg::new("no")
                    .long("no")
                    .value_delimiter(',')
                    .help(format!("{no_text} Usage: --no=maps,other,system"))
                    .value_name("maps,other,system"),
            ),
            Command::new("write").about(write_text).arg(
                Arg::new("no")
                    .long("no")
                    .value_delimiter(',')
                    .help(format!("{no_text} Usage: --no=maps,other,system,plugins"))
                    .value_name("maps,other,system,plugins"),
            ),
        ])
        .arg(
            Arg::new("log")
                .long("log")
                .default_value("false")
                .action(clap::ArgAction::SetTrue)
                .global(true)
                .help(log_text),
        )
        .get_matches();

    let mode: &str = if let Some(subcommand) = matches.subcommand_name() {
        subcommand
    } else {
        exit(1);
    };

    let mut write_options: (bool, bool, bool, bool, bool) = (true, true, true, true, false);

    if let Some(no_values) = matches.subcommand().unwrap().1.get_one::<String>("no") {
        for no_value in no_values.split(',').collect::<Vec<&str>>() {
            match no_value {
                "maps" => write_options.0 = false,
                "other" => write_options.1 = false,
                "system" => write_options.2 = false,
                "plugins" => write_options.3 = false,
                _ => {
                    println!("{incorrect_no}");
                    exit(1);
                }
            }
        }
    }

    if matches.get_flag("log") {
        write_options.4 = true;
    }

    match mode {
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
                    .flatten()
                    .fold(
                        HashMap::new,
                        |mut hashmap: HashMap<String, Value>, path: std::fs::DirEntry| {
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

                write_maps(
                    maps_hashmap,
                    dir_paths.output,
                    maps_text_hashmap,
                    maps_names_hashmap,
                    write_options.4,
                    language,
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
                                    merge_other(
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

                write_other(
                    other_hashmap,
                    dir_paths.output,
                    dir_paths.other,
                    write_options.4,
                    language,
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

                write_system(
                    system_json,
                    dir_paths.output,
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

                let plugins_translated_text_vec: Vec<String> =
                    read_to_string(format!("{}/plugins_trans.txt", dir_paths.plugins))
                        .unwrap()
                        .par_split('\n')
                        .map(|x: &str| x.to_string())
                        .collect();

                write_plugins(
                    plugins_json,
                    dir_paths.plugins_output,
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
            const INPUT_DIR: &str = "../original";
            const OUTPUT_DIR: &str = "./parsed";

            create_dir_all(OUTPUT_DIR).unwrap();

            if write_options.0 {
                read_map(INPUT_DIR, OUTPUT_DIR, write_options.4, language);
            }

            if write_options.1 {
                read_other(INPUT_DIR, OUTPUT_DIR, write_options.4, language);
            }

            if write_options.2 {
                read_system(INPUT_DIR, OUTPUT_DIR, write_options.4, language);
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
