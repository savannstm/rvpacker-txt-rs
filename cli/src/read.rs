use indexmap::IndexSet;
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::{
    collections::HashMap,
    fs::{read_dir, read_to_string, write, DirEntry},
};

pub fn read_map(input_dir: &str, output_dir: &str, logging: bool, log_string: &str) {
    let files: Vec<DirEntry> = read_dir(input_dir)
        .unwrap()
        .flatten()
        .filter(|entry: &DirEntry| entry.file_name().into_string().unwrap().starts_with("Map"))
        .collect();

    let obj_map: HashMap<String, Value> = files
        .iter()
        .map(|entry: &DirEntry| {
            (
                entry.file_name().into_string().unwrap(),
                from_str(&read_to_string(entry.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    let mut lines: IndexSet<String> = IndexSet::new();
    let mut names_lines: IndexSet<String> = IndexSet::new();

    for (filename, obj) in obj_map {
        if let Some(display_name) = obj["displayName"].as_str() {
            if !display_name.is_empty() {
                names_lines.insert(display_name.to_string());
            }
        }

        for event in obj["events"].as_array().unwrap().iter().skip(1) {
            if !event["pages"].is_array() {
                continue;
            }

            for page in event["pages"].as_array().unwrap().iter() {
                let mut in_seq: bool = false;
                let mut line: Vec<String> = Vec::new();

                for list in page["list"].as_array().unwrap() {
                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                    for parameter_value in list["parameters"].as_array().unwrap() {
                        if code == 401 {
                            in_seq = true;

                            if parameter_value.is_string() {
                                let parameter: &str = parameter_value.as_str().unwrap();
                                line.push(parameter.to_string());
                            }
                        } else {
                            if in_seq {
                                let line_joined: String = line.join("/#");
                                lines.insert(line_joined);
                                line.clear();
                                in_seq = false;
                            }

                            match code {
                                102 => {
                                    if parameter_value.is_array() {
                                        for param_value in parameter_value.as_array().unwrap() {
                                            if param_value.is_string() {
                                                let param: &str = param_value.as_str().unwrap();
                                                lines.insert(param.to_string());
                                            }
                                        }
                                    }
                                }

                                356 => {
                                    if parameter_value.is_string() {
                                        let parameter: &str = parameter_value.as_str().unwrap();

                                        if parameter.starts_with("GabText")
                                            && (parameter.starts_with("choice_text")
                                                && !parameter.ends_with("????"))
                                        {
                                            lines.insert(parameter.to_string());
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
            println!("{log_string} {filename}.");
        }
    }

    write(
        format!("{output_dir}/maps.txt"),
        lines.iter().cloned().collect::<Vec<String>>().join("\n"),
    )
    .unwrap();

    write(
        format!("{output_dir}/names.txt"),
        names_lines
            .iter()
            .cloned()
            .collect::<Vec<String>>()
            .join("\n"),
    )
    .unwrap();

    write(
        format!("{output_dir}/maps_trans.txt"),
        "\n".repeat(lines.len() - 1),
    )
    .unwrap();

    write(
        format!("{output_dir}/names_trans.txt"),
        "\n".repeat(names_lines.len() - 1),
    )
    .unwrap();
}

pub fn read_other(input_dir: &str, output_dir: &str, logging: bool, log_string: &str) {
    let files: Vec<DirEntry> = read_dir(input_dir)
        .unwrap()
        .flatten()
        .filter(|entry: &DirEntry| {
            const FILENAMES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];
            for filename in FILENAMES {
                if entry
                    .file_name()
                    .into_string()
                    .unwrap()
                    .starts_with(filename)
                {
                    return false;
                }
            }

            true
        })
        .collect();

    let obj_arr_map: HashMap<String, Vec<Value>> = files
        .par_iter()
        .map(|entry: &DirEntry| {
            (
                entry.file_name().into_string().unwrap(),
                from_str(&read_to_string(entry.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    for (filename, obj_arr) in obj_arr_map {
        let mut lines: IndexSet<String> = IndexSet::new();

        if !filename.to_lowercase().starts_with("commonevents") && !filename.starts_with("Troops") {
            for obj in obj_arr {
                if obj["name"].is_string() {
                    let name: &str = obj["name"].as_str().unwrap();

                    if !name.is_empty() {
                        lines.insert(name.to_string());
                    }
                }

                if obj["description"].is_string() {
                    let description: &str = obj["description"].as_str().unwrap();

                    if !description.is_empty() {
                        lines.insert(description.replace('\n', "/#"));
                    }
                }

                if obj["note"].is_string() {
                    let note: &str = obj["note"].as_str().unwrap();

                    if !note.is_empty() {
                        lines.insert(note.replace('\n', "/#"));
                    }
                }
            }

            write(
                format!(
                    "{output_dir}/{}.txt",
                    filename[0..filename.rfind('.').unwrap()].to_lowercase()
                ),
                lines.iter().cloned().collect::<Vec<String>>().join("\n"),
            )
            .unwrap();
            write(
                format!(
                    "{output_dir}/{}_trans.txt",
                    filename[0..filename.rfind('.').unwrap()].to_lowercase()
                ),
                "\n".repeat(lines.len() - 1),
            )
            .unwrap();
            continue;
        }

        for obj in obj_arr.iter().skip(1) {
            let pages_length: usize = if filename.starts_with("Troops") {
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

                let mut in_seq: bool = false;
                let mut line: Vec<String> = Vec::new();

                for list in iterable_object.as_array().unwrap() {
                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                    for parameter_value in list["parameters"].as_array().unwrap() {
                        if code == 401 || code == 405 {
                            in_seq = true;

                            if parameter_value.is_string() {
                                let parameter: &str = parameter_value.as_str().unwrap();
                                line.push(parameter.to_string());
                            }
                        } else {
                            if in_seq {
                                let line_joined: String = line.join("/#");
                                lines.insert(line_joined);

                                line.clear();
                                in_seq = false;
                            }

                            match code {
                                102 => {
                                    if parameter_value.is_array() {
                                        for param_value in parameter_value.as_array().unwrap() {
                                            if param_value.is_string() {
                                                let param: &str = param_value.as_str().unwrap();
                                                lines.insert(param.to_string());
                                            }
                                        }
                                    }
                                }

                                356 => {
                                    if parameter_value.is_string() {
                                        let parameter: &str = parameter_value.as_str().unwrap();

                                        if parameter.starts_with("GabText")
                                            && (parameter.starts_with("choice_text")
                                                && !parameter.ends_with("????"))
                                        {
                                            lines.insert(parameter.to_string());
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
                "{output_dir}/{}.txt",
                filename[0..filename.rfind('.').unwrap()].to_lowercase()
            ),
            lines.iter().cloned().collect::<Vec<String>>().join("\n"),
        )
        .unwrap();
        write(
            format!(
                "{output_dir}/{}_trans.txt",
                filename[0..filename.rfind('.').unwrap()].to_lowercase()
            ),
            "\n".repeat(lines.len() - 1),
        )
        .unwrap();

        if logging {
            println!("{log_string} {filename}");
        }
    }
}

pub fn read_system(input_dir: &str, output_dir: &str, logging: bool, log_string: &str) {
    let system_file: String = format!("{input_dir}/System.json");

    let obj: Value = from_str(&read_to_string(system_file).unwrap()).unwrap();

    let mut lines: IndexSet<String> = IndexSet::new();

    for string in obj["equipTypes"].as_array().unwrap() {
        if string.is_string() {
            let element_str: &str = string.as_str().unwrap();

            if !element_str.is_empty() {
                lines.insert(element_str.to_string());
            }
        }
    }

    for string in obj["skillTypes"].as_array().unwrap() {
        if string.is_string() {
            let element_str: &str = string.as_str().unwrap();

            if !element_str.is_empty() {
                lines.insert(string.as_str().unwrap().to_string());
            }
        }
    }

    for (key, value) in obj["terms"].as_object().unwrap() {
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
        format!("{output_dir}/system.txt"),
        lines.iter().cloned().collect::<Vec<String>>().join("\n"),
    )
    .unwrap();
    write(
        format!("{output_dir}/system_trans.txt"),
        "\n".repeat(lines.len() - 1),
    )
    .unwrap();

    if logging {
        println!("{log_string} System.json.");
    }
}
