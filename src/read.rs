use fancy_regex::Regex;
use fnv::{FnvBuildHasher, FnvHashMap};
use indexmap::IndexSet;
use rayon::prelude::*;
use serde_json::{from_str, Value};
use std::{
    fs::{read_dir, read_to_string, write, DirEntry},
    path::Path,
};

#[allow(clippy::single_match, unused_mut)]
fn parse_parameter(code: u16, mut parameter: &str, game_type: &str) -> Option<String> {
    match code {
        401 | 405 => match game_type {
            "termina" => {}
            // Implement custom parsing for other games
            _ => {}
        },
        102 => match game_type {
            "termina" => {}
            // Implement custom parsing for other games
            _ => {}
        },
        356 => match game_type {
            "termina" => {
                if !parameter.starts_with("GabText")
                    && (!parameter.starts_with("choice_text") || parameter.ends_with("????"))
                {
                    return None;
                }
            }
            // Implement custom parsing for other games
            _ => return None,
        },
        _ => return None,
    }

    Some(parameter.to_string())
}

#[allow(clippy::single_match, unused_mut)]
fn parse_variable(
    mut variable: &str,
    name: &str,
    filename: &str,
    game_type: &str,
) -> Option<String> {
    match name {
        "name" => match game_type {
            "termina" => {}
            _ => {}
        },
        "nickname" => match game_type {
            "termina" => {}
            _ => {}
        },
        "description" => match game_type {
            "termina" => {}
            _ => {}
        },
        "note" => match game_type {
            "termina" => {
                if !filename.starts_with("Common") && !filename.starts_with("Troops") {
                    if filename.starts_with("Items") {
                        for string in [
                            "<Menu Category: Items>",
                            "<Menu Category: Food>",
                            "<Menu Category: Healing>",
                            "<Menu Category: Body bag>",
                        ] {
                            if variable.contains(string) {
                                return Some(string.to_string());
                            }
                        }
                    }

                    if filename.starts_with("Classes") {
                        return Some(variable.to_string());
                    }

                    if filename.starts_with("Armors") && !variable.starts_with("///") {
                        return Some(variable.to_string());
                    }

                    return None;
                }
            }
            _ => {}
        },
        _ => return None,
    }

    Some(variable.to_string())
}

/// Reads all Map .json files of map_path and parses them into .txt files in output_path.
/// # Parameters
/// * `map_path` - path to directory than contains .json files
/// * `output_path` - path to output directory
/// * `logging` - whether to log or not
/// * `log_msg` - message to log
/// * `game_type` - game type for custom parsing
pub fn read_map(
    maps_path: &Path,
    output_path: &Path,
    logging: bool,
    log_msg: &str,
    game_type: &str,
) {
    let select_maps_re: Regex = Regex::new(r"^Map[0-9].*json$").unwrap();

    let maps_files: Vec<DirEntry> = read_dir(maps_path)
        .unwrap()
        .flatten()
        .filter(|entry: &DirEntry| {
            let filename: String = entry.file_name().into_string().unwrap();
            select_maps_re.is_match(&filename).unwrap()
        })
        .collect();

    let maps_obj_map: FnvHashMap<String, Value> = maps_files
        .iter()
        .map(|entry: &DirEntry| {
            (
                entry.file_name().into_string().unwrap(),
                from_str(&read_to_string(entry.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    let mut maps_lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();
    let mut names_lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();

    for (filename, obj) in maps_obj_map {
        if let Some(display_name) = obj["displayName"].as_str() {
            if !display_name.is_empty() {
                names_lines.insert(display_name.to_string());
            }
        }

        //Skipping first element in array as it is null
        for event in obj["events"].as_array().unwrap().iter().skip(1) {
            if !event["pages"].is_array() {
                continue;
            }

            for page in event["pages"].as_array().unwrap().iter() {
                let mut in_sequence: bool = false;
                let mut line: Vec<String> = Vec::new();

                for list in page["list"].as_array().unwrap() {
                    //401 - dialogue lines
                    //102 - dialogue choices
                    //356 - system lines (special texts)
                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                    for parameter_value in list["parameters"].as_array().unwrap() {
                        if code == 401 {
                            in_sequence = true;

                            if parameter_value.is_string() {
                                let parameter_string: &str = parameter_value.as_str().unwrap();

                                if !parameter_string.is_empty() {
                                    let parsed: Option<String> =
                                        parse_parameter(code, parameter_string, game_type);

                                    if let Some(parsed) = parsed {
                                        line.push(parsed);
                                    }
                                }
                            }
                        } else {
                            if in_sequence {
                                maps_lines.insert(line.join(r"\#"));
                                line.clear();
                                in_sequence = false;
                            }

                            match code {
                                102 => {
                                    if parameter_value.is_array() {
                                        for subparameter_value in
                                            parameter_value.as_array().unwrap()
                                        {
                                            if subparameter_value.is_string() {
                                                let subparameter_string: &str =
                                                    subparameter_value.as_str().unwrap();

                                                if !subparameter_string.is_empty() {
                                                    let parsed: Option<String> = parse_parameter(
                                                        code,
                                                        subparameter_string,
                                                        game_type,
                                                    );

                                                    if let Some(parsed) = parsed {
                                                        maps_lines.insert(parsed);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                356 => {
                                    if parameter_value.is_string() {
                                        let parameter_string: &str =
                                            parameter_value.as_str().unwrap();

                                        if !parameter_string.is_empty() {
                                            let parsed: Option<String> =
                                                parse_parameter(code, parameter_string, game_type);

                                            if let Some(parsed) = parsed {
                                                maps_lines.insert(parsed);
                                            }
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
            println!("{log_msg} {filename}.");
        }
    }

    write(
        output_path.join("maps.txt"),
        maps_lines
            .iter()
            .cloned()
            .collect::<Vec<String>>()
            .join("\n"),
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
        "\n".repeat(maps_lines.len() - 1),
    )
    .unwrap();

    write(
        output_path.join("names_trans.txt"),
        "\n".repeat(names_lines.len() - 1),
    )
    .unwrap();
}

/// Reads all Other .json files of other_path and parses them into .txt files in output_path.
/// # Parameters
/// * `other_path` - path to directory than contains .json files
/// * `output_path` - path to output directory
/// * `logging` - whether to log or not
/// * `log_msg` - message to log
/// * `game_type` - game type for custom parsing
pub fn read_other(
    other_path: &Path,
    output_path: &Path,
    logging: bool,
    log_msg: &str,
    game_type: &str,
) {
    let select_other_re: Regex =
        Regex::new(r"^(?!Map|Tilesets|Animations|States|System).*json$").unwrap();

    let other_files: Vec<DirEntry> = read_dir(other_path)
        .unwrap()
        .flatten()
        .filter(|entry: &DirEntry| {
            select_other_re
                .is_match(&entry.file_name().into_string().unwrap())
                .unwrap()
        })
        .collect();

    let other_obj_arr_map: FnvHashMap<String, Vec<Value>> = other_files
        .par_iter()
        .map(|entry: &DirEntry| {
            (
                entry.file_name().into_string().unwrap(),
                from_str(&read_to_string(entry.path()).unwrap()).unwrap(),
            )
        })
        .collect();

    for (filename, obj_arr) in other_obj_arr_map {
        let other_processed_filename: String =
            filename[0..filename.rfind('.').unwrap()].to_lowercase();
        let mut other_lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();

        // Other files except CommonEvents.json and Troops.json have the structure that consists
        // of name, nickname, description and note
        if !filename.starts_with("Common") && !filename.starts_with("Troops") {
            for obj in obj_arr {
                for (variable, name) in [
                    (obj["name"].as_str(), "name"),
                    (obj["nickname"].as_str(), "nickname"),
                    (obj["description"].as_str(), "description"),
                    (obj["note"].as_str(), "note"),
                ] {
                    if variable.is_none() {
                        continue;
                    }

                    let variable_string: &str = variable.unwrap();

                    if !variable_string.is_empty() {
                        let parsed: Option<String> =
                            parse_variable(variable_string, name, &filename, game_type);

                        if let Some(parsed) = parsed {
                            other_lines.insert(parsed.replace('\n', r"\#"));
                        }
                    }
                }
            }
        }
        //Other files have the structure somewhat similar to Maps.json files
        else {
            //Skipping first element in array as it is null
            for obj in obj_arr.iter().skip(1) {
                //CommonEvents doesn't have pages, so we can just check if it's Troops
                let pages_length: u32 = if filename.starts_with("Troops") {
                    obj["pages"].as_array().unwrap().len() as u32
                } else {
                    1
                };

                for i in 0..pages_length {
                    let list: &Value = if pages_length != 1 {
                        &obj["pages"][i as usize]["list"]
                    } else {
                        &obj["list"]
                    };

                    if !list.is_array() {
                        continue;
                    }

                    let mut in_sequence: bool = false;
                    let mut line: Vec<String> = Vec::with_capacity(256);

                    for list in list.as_array().unwrap() {
                        //401 - dialogue lines
                        //102 - dialogue choices
                        //356 - system lines (special texts)
                        //405 - credits lines
                        let code: u16 = list["code"].as_u64().unwrap() as u16;

                        for parameter_value in list["parameters"].as_array().unwrap() {
                            if code == 401 || code == 405 {
                                in_sequence = true;

                                if parameter_value.is_string() {
                                    let parameter_string: &str = parameter_value.as_str().unwrap();

                                    if !parameter_string.is_empty() {
                                        let parsed: Option<String> =
                                            parse_parameter(code, parameter_string, game_type);

                                        if let Some(parsed) = parsed {
                                            line.push(parsed);
                                        }
                                    }
                                }
                            } else {
                                if in_sequence {
                                    other_lines.insert(line.join(r"\#"));
                                    line.clear();
                                    in_sequence = false;
                                }

                                match code {
                                    102 => {
                                        if parameter_value.is_array() {
                                            for subparameter_value in
                                                parameter_value.as_array().unwrap()
                                            {
                                                if subparameter_value.is_string() {
                                                    let subparameter_string: &str =
                                                        subparameter_value.as_str().unwrap();

                                                    if !subparameter_string.is_empty() {
                                                        let parsed: Option<String> =
                                                            parse_parameter(
                                                                code,
                                                                subparameter_string,
                                                                game_type,
                                                            );

                                                        if let Some(parsed) = parsed {
                                                            other_lines.insert(parsed);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    356 => {
                                        if parameter_value.is_string() {
                                            let parameter_string: &str =
                                                parameter_value.as_str().unwrap();

                                            if !parameter_string.is_empty() {
                                                let parsed: Option<String> = parse_parameter(
                                                    code,
                                                    parameter_string,
                                                    game_type,
                                                );

                                                if let Some(parsed) = parsed {
                                                    other_lines.insert(parsed);
                                                }
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
            output_path.join(format!("{other_processed_filename}.txt")),
            other_lines
                .iter()
                .cloned()
                .collect::<Vec<String>>()
                .join("\n"),
        )
        .unwrap();
        write(
            output_path.join(format!("{other_processed_filename}_trans.txt")),
            "\n".repeat(other_lines.len() - 1),
        )
        .unwrap();

        if logging {
            println!("{log_msg} {filename}");
        }
    }
}

/// Reads System .json file of other_path and parses it into .txt file in output_path.
/// # Parameters
/// * `other_path` - path to directory than contains .json files
/// * `output_path` - path to output directory
/// * `logging` - whether to log or not
/// * `log_msg` - message to log
pub fn read_system(system_file_path: &Path, output_path: &Path, logging: bool, log_msg: &str) {
    let system_obj: Value = from_str(&read_to_string(system_file_path).unwrap()).unwrap();

    let mut system_lines: IndexSet<String, FnvBuildHasher> = IndexSet::default();

    // Armor types names
    // Normally it's system strings, but might be needed for some purposes
    for string in system_obj["armorTypes"].as_array().unwrap() {
        let slice_ref: &str = string.as_str().unwrap();

        if !slice_ref.is_empty() {
            system_lines.insert(slice_ref.to_string());
        }
    }

    // Element types names
    // Normally it's system strings, but might be needed for some purposes
    for string in system_obj["elements"].as_array().unwrap() {
        let slice_ref: &str = string.as_str().unwrap();

        if !slice_ref.is_empty() {
            system_lines.insert(slice_ref.to_string());
        }
    }

    // Names of equipment slots
    for string in system_obj["equipTypes"].as_array().unwrap() {
        let slice_ref: &str = string.as_str().unwrap();

        if !slice_ref.is_empty() {
            system_lines.insert(slice_ref.to_string());
        }
    }

    // Game title, parsed just for fun
    // Translators may add something like "ELFISH TRANSLATION v1.0.0" to the title
    system_lines.insert(system_obj["gameTitle"].as_str().unwrap().to_string());

    // Names of battle options
    for string in system_obj["skillTypes"].as_array().unwrap() {
        let slice_ref: &str = string.as_str().unwrap();

        if !slice_ref.is_empty() {
            system_lines.insert(string.to_string());
        }
    }

    // Game terms vocabulary
    for (key, value) in system_obj["terms"].as_object().unwrap() {
        if key != "messages" {
            for string in value.as_array().unwrap() {
                if string.is_string() {
                    let slice_ref: &str = string.as_str().unwrap();

                    if !slice_ref.is_empty() {
                        system_lines.insert(slice_ref.to_string());
                    }
                }
            }
        } else {
            if !value.is_object() {
                continue;
            }

            for message_string in value.as_object().unwrap().values() {
                let slice_ref: &str = message_string.as_str().unwrap();

                if !slice_ref.is_empty() {
                    system_lines.insert(slice_ref.to_string());
                }
            }
        }
    }

    // Weapon types names
    // Normally it's system strings, but might be needed for some purposes
    for string in system_obj["weaponTypes"].as_array().unwrap() {
        let slice_ref: &str = string.as_str().unwrap();

        if !slice_ref.is_empty() {
            system_lines.insert(slice_ref.to_string());
        }
    }

    write(
        output_path.join("system.txt"),
        system_lines
            .iter()
            .cloned()
            .collect::<Vec<String>>()
            .join("\n"),
    )
    .unwrap();

    write(
        output_path.join("system_trans.txt"),
        "\n".repeat(system_lines.len() - 1),
    )
    .unwrap();

    if logging {
        println!("{log_msg} System.json.");
    }
}

// read_plugins is not implemented and will NEVER be, as plugins can differ from each other incredibly.
// Change plugins.js with your own hands.
