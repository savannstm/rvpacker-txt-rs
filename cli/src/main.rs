use colored::{ColoredString, Colorize, CustomColor};
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::collections::HashMap;
use std::env::args;
use std::fs::{create_dir_all, read_dir, read_to_string};
use std::process::exit;
use std::time::Instant;
use sys_locale::get_locale;

mod read;
mod write;

trait Gray {
    fn gray(&self) -> ColoredString;
}

impl<T: AsRef<str> + Colorize> Gray for T {
    fn gray(&self) -> ColoredString {
        self.as_ref().custom_color(CustomColor::new(33, 33, 33))
    }
}

fn handle_args(args: Vec<String>, language: &str) -> ((bool, bool, bool, bool, bool), String) {
    let mut write_options = (true, true, true, true, false);

    if args.len() < 2 {
        if language == "ru" {
            println!("\nКоманда не задана. Прерываем работу. Для получения справки, вызовите json-writer -h.");
        } else {
            println!("\nCommand not specified. Exiting. For help, call json-writer -h.");
        }
        exit(1);
    }

    const SPACES: usize = 48;

    let (
        desc,
        usage,
        commands,
        read_command_text,
        write_command_text,
        options,
        help_command_text,
        no_command_text,
        log_command_text,
    ) = if language == "ru" {
        (
            "Данный CLI инструмент записывает .txt файлы перевода в .json файлы игры.".bold(),
            format!(
                "{}: {} {} {}",
                "Использование".bold(),
                "json-writer",
                "команда".purple(),
                "[ОПЦИИ]".gray()
            ),
            "Команды:",
            "Читает и парсит оригинальный текст из файлов игры. (кроме файла plugins.js).",
            "Записывает перевод в файлы игры.",
            "Опции:",
            "Выводит эту справку.".gray(),
            "Отключает компиляцию указанных файлов.".gray(),
            "Включает логирование.".gray(),
        )
    } else {
        (
            "This CLI tool writes .txt translation files to .json game files.".bold(),
            format!(
                "{}: {} {} {}",
                "Usage".bold(),
                "json-writer",
                "command".purple(),
                "[OPTIONS]".gray()
            ),
            "Commands:",
            "Reads and parses the original text from game files. (except plugins.js).",
            "Writes the translation to game files.",
            "Options:",
            "Prints this help message.".gray(),
            "Disables compilation of the specified files.".gray(),
            "Enables logging.".gray(),
        )
    };

    let read_command: ColoredString = "read".bold();
    let write_command: ColoredString = "write".bold();
    let help_command: String = format!("{}, {}", "-h".bold(), "--help".gray());
    let no_command: ColoredString = "-no={maps,other,system,plugins}".bold();
    let log_command: ColoredString = "--log".bold();

    let mode: String = match args[1].as_str() {
        "-h" | "--help" => {
            println!("\n{desc}\n\n{usage}\n\n{commands}");
            println!(
                "{read_command} {}{}",
                " ".repeat(SPACES - read_command.len() - 1),
                read_command_text.gray()
            );
            println!(
                "{write_command} {}{}",
                " ".repeat(SPACES - write_command.len() - 1),
                write_command_text.gray()
            );
            println!("\n{options}");
            println!(
                "{help_command} {}{}",
                " ".repeat(SPACES - 10 - 1),
                help_command_text
            );
            println!(
                "{no_command} {}{}",
                " ".repeat(SPACES - no_command.len() - 1),
                no_command_text
            );
            println!(
                "{log_command} {}{}",
                " ".repeat(SPACES - log_command.len() - 1),
                log_command_text
            );
            exit(0);
        }
        "write" => "write".to_string(),
        "read" => "read".to_string(),
        _ => {
            if language == "ru" {
                println!("Неверное значение аргумента.\nДопустимые значения: write, read.");
            } else {
                println!("Incorrect argument value.\nAvailable values: write, read.");
            }
            exit(1);
        }
    };

    for arg in args.iter().skip(2) {
        match arg.as_str() {
            "-h" | "--help" => {
                if mode == "read" {
                    let read_no_command = no_command.replace(",plugins}", "}");
                    println!("\n{}", read_command_text.trim().bold());
                    println!("\n{options}");
                    println!(
                        "{help_command} {}{}",
                        " ".repeat(SPACES - 10 - 1),
                        help_command_text
                    );
                    println!(
                        "{} {}{}",
                        read_no_command,
                        " ".repeat(SPACES - read_no_command.len() - 1),
                        no_command_text
                    );
                } else {
                    println!("\n{}", write_command_text.trim().bold());
                    println!("\n{options}");
                    println!(
                        "{help_command} {}{}",
                        " ".repeat(SPACES - 10 - 1),
                        help_command_text
                    );
                    println!(
                        "{no_command} {}{}",
                        " ".repeat(SPACES - no_command.len() - 1),
                        no_command_text
                    );
                }
                println!(
                    "{log_command} {}{}",
                    " ".repeat(SPACES - log_command.len() - 1),
                    log_command_text
                );
                exit(0);
            }

            arg if arg.starts_with("-no=") => {
                for opt in arg[4..].split(',') {
                    match opt {
                        "maps" => write_options.0 = false,
                        "other" => write_options.1 = false,
                        "system" => write_options.2 = false,
                        "plugins" => write_options.3 = false,
                        _ => {
                            if language == "ru" {
                                println!("\nНеверные значения аргумента -no.\nДопустимые значения: maps, other, system, plugins.");
                            } else {
                                println!("\nIncorrect -no argument values.\nAvailable values: maps, other, system, plugins.");
                            }
                            exit(1);
                        }
                    }
                }
            }
            "--log" => write_options.4 = true,
            _ => {}
        }
    }

    (write_options, mode)
}

fn main() {
    let start_time: Instant = Instant::now();

    let args: Vec<String> = args().collect();

    let locale: String = get_locale().unwrap_or_else(|| String::from("en_US"));

    const RU_LOCALES: [&str; 3] = ["ru", "uk", "be"];

    let language: &str = if RU_LOCALES.iter().any(|&x| locale.starts_with(x)) {
        "ru"
    } else {
        "en"
    };

    let settings: ((bool, bool, bool, bool, bool), String) = handle_args(args, language);

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

                write::write_system(
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

                write::write_plugins(
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
                    "Все файлы были записаны успешно.\nПотрачено {} секунд.",
                    start_time.elapsed().as_secs_f64()
                );
            } else {
                println!(
                    "All files were successfully written.\nTime spent: {} seconds.",
                    start_time.elapsed().as_secs_f64()
                );
            }
        }

        "read" => {
            const INPUT_DIR: &str = "../original";
            const OUTPUT_DIR: &str = "./parsed";

            create_dir_all(OUTPUT_DIR).unwrap();

            if write_options.0 {
                read::read_map(INPUT_DIR, OUTPUT_DIR, write_options.4, language);
            }

            if write_options.1 {
                read::read_other(INPUT_DIR, OUTPUT_DIR, write_options.4, language);
            }

            if write_options.2 {
                read::read_system(INPUT_DIR, OUTPUT_DIR, write_options.4, language);
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
