use indexmap::IndexSet;
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::{
    collections::HashMap,
    fs::{read_dir, read_to_string, write, DirEntry},
};

pub fn read_map(input_dir: &str, output_dir: &str, logging: bool, language: &str) {
    let files: Vec<DirEntry> = read_dir(input_dir)
        .unwrap()
        .flatten()
        .filter(|f: &DirEntry| f.file_name().into_string().unwrap().starts_with("Map"))
        .collect();

    let json_data: HashMap<String, Value> = files
        .iter()
        .map(|f: &DirEntry| {
            (
                f.file_name().into_string().unwrap(),
                from_str(&read_to_string(f.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    let mut lines: IndexSet<String> = IndexSet::new();

    for (filename, json) in json_data {
        for event in json["events"].as_array().unwrap().iter().skip(1) {
            if !event["pages"].is_array() {
                continue;
            }

            for page in event["pages"].as_array().unwrap().iter() {
                let mut in_401_seq: bool = false;
                let mut line: Vec<String> = Vec::new();

                for list in page["list"].as_array().unwrap() {
                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                    for parameter in list["parameters"].as_array().unwrap() {
                        if code == 401 {
                            in_401_seq = true;

                            if parameter.is_string() {
                                let parameter_str: &str = parameter.as_str().unwrap();
                                line.push(parameter_str.to_string());
                            }
                        } else {
                            if in_401_seq {
                                let line_joined: String = line.join("\\n");
                                lines.insert(line_joined);
                                line.clear();
                                in_401_seq = false;
                            }

                            match code {
                                102 => {
                                    if parameter.is_array() {
                                        for param in parameter.as_array().unwrap() {
                                            if param.is_string() {
                                                let param_str: &str = param.as_str().unwrap();
                                                lines.insert(param_str.to_string());
                                            }
                                        }
                                    }
                                }

                                356 => {
                                    if parameter.is_string() {
                                        let parameter_str: &str = parameter.as_str().unwrap();

                                        if parameter_str.starts_with("GabText")
                                            && (parameter_str.starts_with("choice_text")
                                                && !parameter_str.ends_with("????"))
                                        {
                                            lines.insert(parameter_str.to_string());
                                        }
                                    }
                                }

                                _ => {}
                            }
                        }
                    }
                }
            }
        }

        if logging {
            if language == "ru" {
                println!("Распарсен файл {filename}.");
            } else {
                println!("Parsed file {filename}.");
            }
        }
    }

    write(
        format!("{}/maps.txt", output_dir),
        lines.iter().cloned().collect::<Vec<String>>().join("\n"),
    )
    .unwrap();
}

pub fn read_other(input_dir: &str, output_dir: &str, logging: bool, language: &str) {
    let files: Vec<DirEntry> = read_dir(input_dir)
        .unwrap()
        .flatten()
        .filter(|f| {
            const FILENAMES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];
            for filename in FILENAMES {
                if f.file_name().into_string().unwrap().starts_with(filename) {
                    return false;
                }
            }

            true
        })
        .collect();

    let json_data: HashMap<String, Value> = files
        .par_iter()
        .map(|f: &DirEntry| {
            (
                f.file_name().into_string().unwrap(),
                from_str(&read_to_string(f.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    for (filename, json) in json_data {
        let mut lines: IndexSet<String> = IndexSet::new();

        if filename != "CommonEvents.json" && filename != "Troops.json" {
            for obj in json.as_array().unwrap() {
                if obj["name"].is_string() {
                    let name: &str = obj["name"].as_str().unwrap();

                    if !name.is_empty() {
                        lines.insert(name.to_string());
                    }
                }

                if obj["description"].is_string() {
                    let description: &str = obj["description"].as_str().unwrap();

                    if !description.is_empty() {
                        lines.insert(description.replace('\n', "\\n"));
                    }
                }

                if obj["note"].is_string() {
                    let note: &str = obj["note"].as_str().unwrap();

                    if !note.is_empty() {
                        lines.insert(note.replace('\n', "\\n"));
                    }
                }
            }

            write(
                format!(
                    "{}/{}",
                    output_dir,
                    filename.replace(".json", ".txt").to_lowercase()
                ),
                lines.iter().cloned().collect::<Vec<String>>().join("\n"),
            )
            .unwrap();

            continue;
        }

        for obj in json.as_array().unwrap().iter().skip(1) {
            let pages_length: usize = if obj["pages"].is_array() {
                obj["pages"].as_array().unwrap().len()
            } else {
                1
            };

            for i in 0..pages_length {
                let iterable_object: &Value = if pages_length != 1 {
                    &obj["pages"][i]["list"]
                } else {
                    &obj["list"]
                };

                if !iterable_object.is_array() {
                    continue;
                }

                let mut in_401_seq: bool = false;
                let mut line: Vec<String> = Vec::new();

                for list in iterable_object.as_array().unwrap() {
                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                    for parameter in list["parameters"].as_array().unwrap() {
                        if code == 401 {
                            in_401_seq = true;

                            if parameter.is_string() {
                                let parameter_str: &str = parameter.as_str().unwrap();
                                line.push(parameter_str.to_string());
                            }
                        } else {
                            if in_401_seq {
                                let line_joined: String = line.join("\\n");
                                lines.insert(line_joined);

                                line.clear();
                                in_401_seq = false;
                            }

                            match code {
                                102 => {
                                    if parameter.is_array() {
                                        for param in parameter.as_array().unwrap() {
                                            if param.is_string() {
                                                let param_str: &str = param.as_str().unwrap();
                                                lines.insert(param_str.to_string());
                                            }
                                        }
                                    }
                                }

                                356 => {
                                    if parameter.is_string() {
                                        let parameter_str: &str = parameter.as_str().unwrap();

                                        if parameter_str.starts_with("GabText")
                                            && (parameter_str.starts_with("choice_text")
                                                && !parameter_str.ends_with("????"))
                                        {
                                            lines.insert(parameter_str.to_string());
                                        }
                                    }
                                }

                                _ => {}
                            }
                        }
                    }
                }
            }
        }

        write(
            format!(
                "{}/{}",
                output_dir,
                filename.replace(".json", ".txt").to_lowercase()
            ),
            lines.iter().cloned().collect::<Vec<String>>().join("\n"),
        )
        .unwrap();

        if logging {
            if language == "ru" {
                println!("Распарсен файл {filename}");
            } else {
                println!("Parsed file {filename}");
            }
        }
    }
}

pub fn read_system(input_dir: &str, output_dir: &str, logging: bool, language: &str) {
    let system_file: String = format!("{}/System.json", input_dir);

    let json: Value = from_str(&read_to_string(system_file).unwrap()).unwrap();

    let mut lines: IndexSet<String> = IndexSet::new();

    for element in json["equipTypes"].as_array().unwrap() {
        if element.is_string() {
            let element_str: &str = element.as_str().unwrap();

            if !element_str.is_empty() {
                lines.insert(element_str.to_string());
            }
        }
    }

    for element in json["skillTypes"].as_array().unwrap() {
        if element.is_string() {
            let element_str: &str = element.as_str().unwrap();

            if !element_str.is_empty() {
                lines.insert(element.as_str().unwrap().to_string());
            }
        }
    }

    for (key, value) in json["terms"].as_object().unwrap() {
        if key != "messages" {
            for string in value.as_array().unwrap() {
                if string.is_string() {
                    let string_str: &str = string.as_str().unwrap();

                    if !string_str.is_empty() {
                        lines.insert(string_str.to_string());
                    }
                }
            }
        } else {
            if !value.is_object() {
                return;
            }

            for message_value in value.as_object().unwrap().values() {
                if message_value.is_string() {
                    let message_str: &str = message_value.as_str().unwrap();

                    if !message_str.is_empty() {
                        lines.insert(message_str.to_string());
                    }
                }
            }
        }
    }

    write(
        format!("{}/system.txt", output_dir),
        lines.iter().cloned().collect::<Vec<String>>().join("\n"),
    )
    .unwrap();

    if logging {
        if language == "ru" {
            println!("Распарсен файл System.json.");
        } else {
            println!("Parsed file System.json.");
        }
    }
}
