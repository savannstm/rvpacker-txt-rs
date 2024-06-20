use fancy_regex::Regex;
use fnv::{FnvBuildHasher, FnvHashMap};
use indexmap::IndexSet;
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::{
    fs::{read_dir, read_to_string, write, DirEntry},
    path::{Path, PathBuf},
};

pub fn read_map(original_path: &Path, output_path: &Path) {
    let re: Regex = Regex::new(r"^Map[0-9].*.json$").unwrap();

    let files: Vec<DirEntry> = read_dir(original_path)
        .unwrap()
        .flatten()
        .filter(|entry: &DirEntry| {
            let filename: String = entry.file_name().into_string().unwrap();
            re.is_match(&filename).unwrap()
        })
        .collect();

    let maps_obj_map: Vec<Value> = files
        .iter()
        .map(|entry: &DirEntry| from_str(&read_to_string(entry.path()).unwrap()).unwrap())
        .collect();

    let mut lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();
    let mut names_lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();

    for obj in maps_obj_map {
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
                                lines.insert(line.join(r"\#"));
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
    }

    write(
        output_path.join("maps.txt"),
        lines.iter().cloned().collect::<Vec<String>>().join("\n"),
    )
    .unwrap();

    write(
        output_path.join("names.txt"),
        names_lines
            .iter()
            .cloned()
            .collect::<Vec<String>>()
            .join("\n"),
    )
    .unwrap();

    write(
        output_path.join("maps_trans.txt"),
        "\n".repeat(lines.len() - 1),
    )
    .unwrap();

    write(
        output_path.join("names_trans.txt"),
        "\n".repeat(names_lines.len() - 1),
    )
    .unwrap();
}

pub fn read_other(original_path: &Path, output_path: &Path) {
    let re: Regex = Regex::new(r"^(?!Map|Tilesets|Animations|States|System).*json$").unwrap();

    let files: Vec<DirEntry> = read_dir(original_path)
        .unwrap()
        .flatten()
        .filter(|entry: &DirEntry| {
            re.is_match(&entry.file_name().into_string().unwrap())
                .unwrap()
        })
        .collect();

    let obj_arr_map: FnvHashMap<String, Vec<Value>> = files
        .par_iter()
        .map(|entry: &DirEntry| {
            (
                entry.file_name().into_string().unwrap(),
                from_str(&read_to_string(entry.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    for (filename, obj_arr) in obj_arr_map {
        let processed_filename: String = filename[0..filename.rfind('.').unwrap()].to_lowercase();
        let mut lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();

        if !filename.starts_with("Common") && !filename.starts_with("Troops") {
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
                        lines.insert(description.replace('\n', r"\#"));
                    }
                }

                if obj["note"].is_string() {
                    let note: &str = obj["note"].as_str().unwrap();

                    if !note.is_empty() {
                        lines.insert(note.replace('\n', r"\#"));
                    }
                }
            }

            write(
                output_path.join(format!("{processed_filename}.txt",)),
                lines.iter().cloned().collect::<Vec<String>>().join("\n"),
            )
            .unwrap();
            write(
                output_path.join(format!("{processed_filename}_trans.txt",)),
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
                let list: &Value = if pages_length != 1 {
                    &obj["pages"][i]["list"]
                } else {
                    &obj["list"]
                };

                if !list.is_array() {
                    continue;
                }

                let mut in_seq: bool = false;
                let mut line: Vec<String> = Vec::new();

                for list in list.as_array().unwrap() {
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
                                lines.insert(line.join(r"\#"));
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
            output_path.join(format!("{processed_filename}.txt")),
            lines.iter().cloned().collect::<Vec<String>>().join("\n"),
        )
        .unwrap();

        write(
            output_path.join(format!("{processed_filename}_trans.txt")),
            "\n".repeat(lines.len() - 1),
        )
        .unwrap();
    }
}

pub fn read_system(original_path: &Path, output_path: &Path) {
    let system_file: PathBuf = original_path.join("System.json");

    let obj: Value = from_str(&read_to_string(system_file).unwrap()).unwrap();

    let mut lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();

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
        output_path.join("system.txt"),
        lines.iter().cloned().collect::<Vec<String>>().join("\n"),
    )
    .unwrap();
    write(
        output_path.join("system_trans.txt"),
        "\n".repeat(lines.len() - 1),
    )
    .unwrap();
}
