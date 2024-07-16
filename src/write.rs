use fancy_regex::Regex;
use rand::{rngs::ThreadRng, seq::SliceRandom, thread_rng};
use rayon::prelude::*;
use serde_json::{from_str, to_string, to_value, Value};
use std::{
    collections::{HashMap, HashSet},
    fs::{read_dir, read_to_string, write, DirEntry},
    hash::BuildHasherDefault,
    path::Path,
};
use xxhash_rust::xxh3::Xxh3;

use crate::shuffle_words;

pub static mut LOG_MSG: &str = "";

#[allow(clippy::single_match, clippy::match_single_binding, unused_mut)]
fn get_parameter_translated<'a>(
    code: u16,
    mut parameter: &'a str,
    hashmap: &'a HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
    game_type: Option<&str>,
) -> Option<&'a &'a str> {
    if let Some(game_type) = game_type {
        match code {
            401 | 405 => match game_type {
                // Implement custom parsing
                _ => {}
            },
            102 | 402 => match game_type {
                // Implement custom parsing
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
                // Implement custom parsing
                _ => {}
            },
            _ => unreachable!(),
        }
    }

    hashmap.get(parameter)
}

#[allow(clippy::single_match, clippy::match_single_binding, unused_mut)]
fn get_variable_translated(
    mut variable_text: &str,
    variable_name: &str,
    filename: &str,
    hashmap: &HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
    game_type: Option<&str>,
) -> Option<String> {
    if let Some(game_type) = game_type {
        match variable_name {
            "name" => match game_type {
                _ => {}
            },
            "nickname" => match game_type {
                _ => {}
            },
            "description" => match game_type {
                _ => {}
            },
            "note" => match game_type {
                "termina" => {
                    if filename.starts_with("Items") {
                        for string in [
                            "<Menu Category: Items>",
                            "<Menu Category: Food>",
                            "<Menu Category: Healing>",
                            "<Menu Category: Body bag>",
                        ] {
                            if variable_text.contains(string) {
                                return Some(variable_text.replacen(string, hashmap[string], 1));
                            }
                        }
                    }
                }
                _ => {}
            },
            _ => unreachable!(),
        }
    }

    hashmap.get(variable_text).map(|s| s.to_string())
}

/// Writes .txt files from maps folder back to their initial form.
/// # Parameters
/// * `maps_path` - path to the maps directory
/// * `original_path` - path to the original directory
/// * `output_path` - path to the output directory
/// * `shuffle_level` - level of shuffle
/// * `logging` - whether to log or not
/// * `game_type` - game type for custom parsing
pub fn write_maps(
    maps_path: &Path,
    original_path: &Path,
    output_path: &Path,
    shuffle_level: u8,
    logging: bool,
    game_type: Option<&str>,
) {
    let select_maps_re: Regex = Regex::new(r"^Map[0-9].*json$").unwrap();

    let mut maps_obj_map: HashMap<String, Value, BuildHasherDefault<Xxh3>> =
        read_dir(original_path)
            .unwrap()
            .par_bridge()
            .flatten()
            .fold(
                HashMap::default,
                |mut map: HashMap<String, Value, BuildHasherDefault<Xxh3>>, entry: DirEntry| {
                    let filename: String = entry.file_name().into_string().unwrap();

                    if select_maps_re.is_match(&filename).unwrap() {
                        map.insert(
                            filename,
                            from_str(&read_to_string(entry.path()).unwrap()).unwrap(),
                        );
                    }
                    map
                },
            )
            .reduce(
                HashMap::default,
                |mut a: HashMap<String, Value, BuildHasherDefault<Xxh3>>,
                 b: HashMap<String, Value, BuildHasherDefault<Xxh3>>| {
                    a.extend(b);
                    a
                },
            );

    let maps_original_text_vec: Vec<String> = read_to_string(maps_path.join("maps.txt"))
        .unwrap()
        .par_split('\n')
        .map(|line: &str| line.replace(r"\#", "\n").trim().to_string())
        .collect();

    let names_original_text_vec: Vec<String> = read_to_string(maps_path.join("names.txt"))
        .unwrap()
        .par_split('\n')
        .map(|line: &str| line.replace(r"\#", "\n").trim().to_string())
        .collect();

    let mut maps_translated_text_vec: Vec<String> =
        read_to_string(maps_path.join("maps_trans.txt"))
            .unwrap()
            .par_split('\n')
            .map(|line: &str| line.replace(r"\#", "\n").trim().to_string())
            .collect();

    let mut names_translated_text_vec: Vec<String> =
        read_to_string(maps_path.join("names_trans.txt"))
            .unwrap()
            .par_split('\n')
            .map(|line: &str| line.replace(r"\#", "\n").trim().to_string())
            .collect();

    if shuffle_level > 0 {
        let mut rng: ThreadRng = thread_rng();

        maps_translated_text_vec.shuffle(&mut rng);
        names_translated_text_vec.shuffle(&mut rng);

        if shuffle_level == 2 {
            for (text_string, name_string) in maps_translated_text_vec
                .iter_mut()
                .zip(names_translated_text_vec.iter_mut())
            {
                *text_string = shuffle_words(text_string);
                *name_string = shuffle_words(name_string);
            }
        }
    }

    let maps_translation_map: HashMap<&str, &str, BuildHasherDefault<Xxh3>> =
        maps_original_text_vec
            .par_iter()
            .zip(maps_translated_text_vec.par_iter())
            .fold(
                HashMap::default,
                |mut map: HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
                 (key, value): (&String, &String)| {
                    map.insert(key.as_str(), value.as_str());
                    map
                },
            )
            .reduce(
                HashMap::default,
                |mut a: HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
                 b: HashMap<&str, &str, BuildHasherDefault<Xxh3>>| {
                    a.extend(b);
                    a
                },
            );

    let names_translation_map: HashMap<&str, &str, BuildHasherDefault<Xxh3>> =
        names_original_text_vec
            .par_iter()
            .zip(names_translated_text_vec.par_iter())
            .fold(
                HashMap::default,
                |mut map: HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
                 (key, value): (&String, &String)| {
                    map.insert(key.as_str(), value.as_str());
                    map
                },
            )
            .reduce(
                HashMap::default,
                |mut a: HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
                 b: HashMap<&str, &str, BuildHasherDefault<Xxh3>>| {
                    a.extend(b);
                    a
                },
            );

    // 401 - dialogue lines
    // 102 - dialogue choices array
    // 402 - one of the dialogue choices from the array
    // 356 - system lines (special texts)
    const ALLOWED_CODES: [u16; 4] = [401, 102, 402, 356];

    maps_obj_map
        .par_iter_mut()
        .for_each(|(filename, obj): (&String, &mut Value)| {
            if let Some(location_name) =
                names_translation_map.get(obj["displayName"].as_str().unwrap())
            {
                obj["displayName"] = to_value(location_name).unwrap();
            }

            obj["events"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .skip(1) //Skipping first element in array as it is null
                .for_each(|event: &mut Value| {
                    if event.is_null() {
                        return;
                    }

                    event["pages"]
                        .as_array_mut()
                        .unwrap()
                        .par_iter_mut()
                        .for_each(|page: &mut Value| {
                            let mut in_sequence: bool = false;
                            let mut line: Vec<String> = Vec::with_capacity(4);
                            let mut item_indices: Vec<usize> = Vec::with_capacity(4);

                            let list: &mut Vec<Value> = page["list"].as_array_mut().unwrap();
                            let list_len = list.len();

                            for it in 0..list_len {
                                let code: u16 = list[it]["code"].as_u64().unwrap() as u16;

                                if !ALLOWED_CODES.contains(&code) {
                                    if in_sequence {
                                        let joined: String = line.join("\n").trim().into();
                                        let translated: Option<&&str> = get_parameter_translated(
                                            401,
                                            &joined,
                                            &maps_translation_map,
                                            game_type,
                                        );

                                        if let Some(text) = translated {
                                            let split: Vec<&str> = text.split('\n').collect();
                                            let split_length: usize = split.len();
                                            let line_length: usize = line.len();

                                            for (i, &index) in item_indices.iter().enumerate() {
                                                if i < split_length {
                                                    list[index]["parameters"][0] =
                                                        to_value(split[i]).unwrap();
                                                } else {
                                                    list[index]["parameters"][0] =
                                                        to_value("").unwrap();
                                                }
                                            }

                                            if split_length > line_length {
                                                let remaining: String =
                                                    split[line_length..].join("\n");

                                                list[*item_indices.last().unwrap()]["parameters"]
                                                    [0] = to_value(remaining).unwrap();
                                            }
                                        }

                                        line.clear();
                                        item_indices.clear();
                                        in_sequence = false;
                                    }
                                    continue;
                                }

                                if code == 401 {
                                    if let Some(parameter_str) = list[it]["parameters"][0].as_str()
                                    {
                                        line.push(parameter_str.to_string());
                                        item_indices.push(it);
                                        in_sequence = true;
                                    }
                                } else if code == 356 {
                                    if let Some(parameter_str) = list[it]["parameters"][0].as_str()
                                    {
                                        let translated: Option<&&str> = get_parameter_translated(
                                            code,
                                            parameter_str,
                                            &maps_translation_map,
                                            game_type,
                                        );

                                        if let Some(translated) = translated {
                                            list[it]["parameters"][0] =
                                                to_value(translated).unwrap();
                                        }
                                    }
                                } else if code == 402 {
                                    if let Some(parameter_str) = list[it]["parameters"][1].as_str()
                                    {
                                        let translated: Option<&&str> = get_parameter_translated(
                                            code,
                                            parameter_str,
                                            &maps_translation_map,
                                            game_type,
                                        );

                                        if let Some(translated) = translated {
                                            list[it]["parameters"][1] =
                                                to_value(translated).unwrap();
                                        }
                                    }
                                } else if code == 102 && list[it]["parameters"][0].is_array() {
                                    for i in 0..list[it]["parameters"][0].as_array().unwrap().len()
                                    {
                                        if let Some(subparameter_str) =
                                            list[it]["parameters"][0][i].as_str()
                                        {
                                            let translated: Option<&&str> =
                                                get_parameter_translated(
                                                    code,
                                                    subparameter_str,
                                                    &maps_translation_map,
                                                    game_type,
                                                );

                                            if let Some(translated) = translated {
                                                list[it]["parameters"][0][i] =
                                                    to_value(translated).unwrap();
                                            }
                                        }
                                    }
                                }
                            }
                        });
                });

            write(output_path.join(filename), obj.to_string()).unwrap();

            if logging {
                println!("{} {filename}", unsafe { LOG_MSG });
            }
        });
}

/// Writes .txt files from other folder back to their initial form.
/// # Parameters
/// * `other_path` - path to the other directory
/// * `original_path` - path to the original directory
/// * `output_path` - path to the output directory
/// * `shuffle_level` - level of shuffle
/// * `logging` - whether to log or not
/// * `game_type` - game type for custom parsing
pub fn write_other(
    other_path: &Path,
    original_path: &Path,
    output_path: &Path,
    shuffle_level: u8,
    logging: bool,
    game_type: Option<&str>,
) {
    let select_other_re: Regex =
        Regex::new(r"^(?!Map|Tilesets|Animations|States|System).*json$").unwrap();

    let mut other_obj_arr_map: HashMap<String, Vec<Value>> = read_dir(original_path)
        .unwrap()
        .par_bridge()
        .flatten()
        .fold(
            HashMap::default,
            |mut map: HashMap<String, Vec<Value>>, entry: DirEntry| {
                let filename: String = entry.file_name().into_string().unwrap();

                if select_other_re.is_match(&filename).unwrap() {
                    let json: Vec<Value> =
                        from_str(&read_to_string(entry.path()).unwrap()).unwrap();

                    map.insert(filename, json);
                }
                map
            },
        )
        .reduce(
            HashMap::default,
            |mut a: HashMap<String, Vec<Value>>, b: HashMap<String, Vec<Value>>| {
                a.extend(b);
                a
            },
        );

    // 401 - dialogue lines
    // 405 - credits lines
    // 102 - dialogue choices array
    // 402 - one of the dialogue choices from the array
    // 356 - system lines (special texts)
    const ALLOWED_CODES: [u16; 5] = [401, 402, 405, 356, 102];

    other_obj_arr_map
        .par_iter_mut()
        .for_each(|(filename, obj_arr): (&String, &mut Vec<Value>)| {
            let other_processed_filename: &str = &filename[..filename.len() - 5];

            let other_original_text: Vec<String> =
                read_to_string(other_path.join(format!("{other_processed_filename}.txt")))
                    .unwrap()
                    .par_split('\n')
                    .map(|line: &str| line.replace(r"\#", "\n").trim().to_string())
                    .collect();

            let mut other_translated_text: Vec<String> =
                read_to_string(other_path.join(format!("{other_processed_filename}_trans.txt")))
                    .unwrap()
                    .par_split('\n')
                    .map(|line: &str| line.replace(r"\#", "\n").trim().to_string())
                    .collect();

            if shuffle_level > 0 {
                let mut rng: ThreadRng = thread_rng();

                other_translated_text.shuffle(&mut rng);

                if shuffle_level == 2 {
                    for text_string in other_translated_text.iter_mut() {
                        *text_string = shuffle_words(text_string);
                    }
                }
            }

            let other_translation_map: HashMap<&str, &str, BuildHasherDefault<Xxh3>> =
                other_original_text
                    .par_iter()
                    .zip(other_translated_text.par_iter())
                    .fold(
                        HashMap::default,
                        |mut map: HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
                         (key, value): (&String, &String)| {
                            map.insert(key.as_str(), value.as_str());
                            map
                        },
                    )
                    .reduce(
                        HashMap::default,
                        |mut a: HashMap<&str, &str, BuildHasherDefault<Xxh3>>,
                         b: HashMap<&str, &str, BuildHasherDefault<Xxh3>>| {
                            a.extend(b);
                            a
                        },
                    );

            // Other files except CommonEvents.json and Troops.json have the structure that consists
            // of name, nickname, description and note
            if !filename.starts_with("Common") && !filename.starts_with("Troops") {
                obj_arr
                    .par_iter_mut()
                    .skip(1) // Skipping first element in array as it is null
                    .for_each(|obj: &mut Value| {
                        for variable_name in ["name", "nickname", "description", "note"] {
                            if let Some(variable_value) = obj.get(variable_name) {
                                if !variable_value.is_string() {
                                    continue;
                                }

                                if let Some(variable_str) = variable_value.as_str() {
                                    let variable_str: &str = variable_str.trim();

                                    if !variable_str.is_empty() {
                                        let translated: Option<String> = get_variable_translated(
                                            variable_str,
                                            variable_name,
                                            filename,
                                            &other_translation_map,
                                            game_type,
                                        );

                                        if let Some(text) = translated {
                                            obj[variable_name] = to_value(text).unwrap();
                                        }
                                    }
                                }
                            }
                        }
                    });
            } else {
                //Other files have the structure somewhat similar to Maps.json files
                obj_arr
                    .par_iter_mut()
                    .skip(1) //Skipping first element in array as it is null
                    .for_each(|obj: &mut Value| {
                        //CommonEvents doesn't have pages, so we can just check if it's Troops
                        let pages_length: u32 = if filename.starts_with("Troops") {
                            obj["pages"].as_array().unwrap().len() as u32
                        } else {
                            1
                        };

                        for i in 0..pages_length {
                            //If element has pages, then we'll iterate over them
                            //Otherwise we'll just iterate over the list
                            let list: &mut Value = if pages_length != 1 {
                                &mut obj["pages"][i as usize]["list"]
                            } else {
                                &mut obj["list"]
                            };

                            if !list.is_array() {
                                continue;
                            }

                            let list_arr: &mut Vec<Value> = list.as_array_mut().unwrap();
                            let list_len: usize = list_arr.len();

                            let mut in_sequence: bool = false;
                            let mut line: Vec<String> = Vec::with_capacity(4);
                            let mut item_indices: Vec<usize> = Vec::with_capacity(4);

                            for it in 0..list_len {
                                let code: u16 = list_arr[it]["code"].as_u64().unwrap() as u16;

                                if !ALLOWED_CODES.contains(&code) {
                                    if in_sequence {
                                        let joined: String = line.join("\n").trim().into();

                                        let translated: Option<&&str> = get_parameter_translated(
                                            401,
                                            &joined,
                                            &other_translation_map,
                                            game_type,
                                        );

                                        if let Some(text) = translated {
                                            let split: Vec<&str> = text.split('\n').collect();
                                            let split_length: usize = split.len();
                                            let line_length: usize = line.len();

                                            for (i, &index) in item_indices.iter().enumerate() {
                                                if i < split_length {
                                                    list_arr[index]["parameters"][0] =
                                                        to_value(split[i]).unwrap();
                                                } else {
                                                    list_arr[index]["parameters"][0] =
                                                        to_value("").unwrap();
                                                }
                                            }

                                            if split_length > line_length {
                                                let remaining: String =
                                                    split[line_length..].join("\n");

                                                list_arr[*item_indices.last().unwrap()]
                                                    ["parameters"][0] =
                                                    to_value(remaining).unwrap();
                                            }
                                        }

                                        line.clear();
                                        item_indices.clear();
                                        in_sequence = false
                                    }
                                    continue;
                                }

                                if [401, 405].contains(&code) {
                                    if let Some(parameter_str) =
                                        list_arr[it]["parameters"][0].as_str()
                                    {
                                        line.push(parameter_str.to_string());
                                        item_indices.push(it);
                                        in_sequence = true;
                                    }
                                } else if code == 356 {
                                    if let Some(parameter_str) =
                                        list_arr[it]["parameters"][0].as_str()
                                    {
                                        let translated: Option<&&str> = get_parameter_translated(
                                            code,
                                            parameter_str,
                                            &other_translation_map,
                                            game_type,
                                        );

                                        if let Some(translated) = translated {
                                            list_arr[it]["parameters"][0] =
                                                to_value(translated).unwrap();
                                        }
                                    }
                                } else if code == 402 {
                                    if let Some(parameter_str) =
                                        list_arr[it]["parameters"][1].as_str()
                                    {
                                        let translated: Option<&&str> = get_parameter_translated(
                                            code,
                                            parameter_str,
                                            &other_translation_map,
                                            game_type,
                                        );

                                        if let Some(translated) = translated {
                                            list_arr[it]["parameters"][1] =
                                                to_value(translated).unwrap();
                                        }
                                    }
                                } else if code == 102 && list_arr[it]["parameters"][0].is_array() {
                                    for i in
                                        0..list_arr[it]["parameters"][0].as_array().unwrap().len()
                                    {
                                        if let Some(subparameter_str) =
                                            list_arr[it]["parameters"][0][i].as_str()
                                        {
                                            let translated: Option<&&str> =
                                                get_parameter_translated(
                                                    code,
                                                    subparameter_str,
                                                    &other_translation_map,
                                                    game_type,
                                                );

                                            if let Some(translated) = translated {
                                                list_arr[it]["parameters"][0][i] =
                                                    to_value(translated).unwrap();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
            }

            write(output_path.join(filename), to_string(obj_arr).unwrap()).unwrap();

            if logging {
                println!("{} {filename}", unsafe { LOG_MSG });
            }
        });
}

/// Writes system.txt file back to its initial form.
///
/// For inner code documentation, check read_system function.
/// # Parameters
/// * `system_file_path` - path to the original system file
/// * `other_path` - path to the other directory
/// * `output_path` - path to the output directory
/// * `shuffle_level` - level of shuffle
/// * `logging` - whether to log or not
pub fn write_system(
    system_file_path: &Path,
    other_path: &Path,
    output_path: &Path,
    shuffle_level: u8,
    logging: bool,
) {
    let mut system_obj: Value = from_str(&read_to_string(system_file_path).unwrap()).unwrap();

    let system_original_text: Vec<String> = read_to_string(other_path.join("system.txt"))
        .unwrap()
        .par_split('\n')
        .map(|line: &str| line.trim().to_string())
        .collect();

    let mut system_translated_text: Vec<String> =
        read_to_string(other_path.join("system_trans.txt"))
            .unwrap()
            .par_split('\n')
            .map(|line: &str| line.trim().to_string())
            .collect();

    if shuffle_level > 0 {
        let mut rng: ThreadRng = thread_rng();

        system_translated_text.shuffle(&mut rng);

        if shuffle_level == 2 {
            for text_string in system_translated_text.iter_mut() {
                *text_string = shuffle_words(text_string);
            }
        }
    }

    let system_translation_map: HashMap<&str, &str> = system_original_text
        .par_iter()
        .zip(system_translated_text.par_iter())
        .fold(
            HashMap::default,
            |mut map: HashMap<&str, &str>, (key, value): (&String, &String)| {
                map.insert(key.as_str(), value.as_str());
                map
            },
        )
        .reduce(
            HashMap::default,
            |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                a.extend(b);
                a
            },
        );

    system_obj["armorTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if let Some(text) = system_translation_map.get(string.as_str().unwrap().trim()) {
                *string = to_value(text).unwrap();
            }
        });

    system_obj["elements"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if let Some(text) = system_translation_map.get(string.as_str().unwrap().trim()) {
                *string = to_value(text).unwrap();
            }
        });

    system_obj["equipTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if let Some(text) = system_translation_map.get(string.as_str().unwrap().trim()) {
                *string = to_value(text).unwrap();
            }
        });

    system_obj["skillTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if let Some(text) = system_translation_map.get(string.as_str().unwrap().trim()) {
                *string = to_value(text).unwrap();
            }
        });

    system_obj["terms"]
        .as_object_mut()
        .unwrap()
        .iter_mut()
        .par_bridge()
        .for_each(|(key, value): (&String, &mut Value)| {
            if key != "messages" {
                value
                    .as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .for_each(|string: &mut Value| {
                        if string.is_string() {
                            if let Some(text) =
                                system_translation_map.get(string.as_str().unwrap().trim())
                            {
                                *string = to_value(text).unwrap();
                            }
                        }
                    });
            } else {
                if !value.is_object() {
                    return;
                }

                value
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|string: &mut Value| {
                        if let Some(text) =
                            system_translation_map.get(string.as_str().unwrap().trim())
                        {
                            *string = to_value(text).unwrap();
                        }
                    });
            }
        });

    system_obj["weaponTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if let Some(text) = system_translation_map.get(string.as_str().unwrap().trim()) {
                *string = to_value(text).unwrap();
            }
        });

    system_obj["gameTitle"] = to_value(system_translated_text.last().unwrap()).unwrap();

    write(
        output_path.join("System.json"),
        to_string(&system_obj).unwrap(),
    )
    .unwrap();

    if logging {
        println!("{} System.json", unsafe { LOG_MSG });
    }
}

/// Writes plugins.txt file back to its initial form.
/// # Parameters
/// * `plugins_file_path` - path to the original plugins file
/// * `plugins_path` - path to the plugins directory
/// * `output_path` - path to the output directory
/// * `shuffle_level` - level of shuffle
/// * `logging` - whether to log or not
/// * `game_type` - game type, currently function executes only if it's `termina`
pub fn write_plugins(
    pluigns_file_path: &Path,
    plugins_path: &Path,
    output_path: &Path,
    shuffle_level: u8,
    logging: bool,
) {
    let mut obj_arr: Vec<Value> = from_str(&read_to_string(pluigns_file_path).unwrap()).unwrap();

    let plugins_original_text_vec: Vec<String> = read_to_string(plugins_path.join("plugins.txt"))
        .unwrap()
        .par_split('\n')
        .map(|line: &str| line.to_string())
        .collect();

    let mut plugins_translated_text_vec: Vec<String> =
        read_to_string(plugins_path.join("plugins_trans.txt"))
            .unwrap()
            .par_split('\n')
            .map(|line: &str| line.to_string())
            .collect();

    if shuffle_level > 0 {
        let mut rng: ThreadRng = thread_rng();

        plugins_translated_text_vec.shuffle(&mut rng);

        if shuffle_level == 2 {
            for text_string in plugins_translated_text_vec.iter_mut() {
                *text_string = shuffle_words(text_string);
            }
        }
    }

    let plugins_translation_map: HashMap<&str, &str> = plugins_original_text_vec
        .par_iter()
        .zip(plugins_translated_text_vec.par_iter())
        .fold(
            HashMap::default,
            |mut map: HashMap<&str, &str>, (key, value): (&String, &String)| {
                map.insert(key.as_str(), value.as_str());
                map
            },
        )
        .reduce(
            HashMap::default,
            |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                a.extend(b);
                a
            },
        );

    obj_arr.par_iter_mut().for_each(|obj: &mut Value| {
        // For now, plugins writing only implemented for Fear & Hunger: Termina, so you should manually translate the plugins.js file if it's not Termina

        // Plugins with needed text
        let plugin_names: HashSet<&str, BuildHasherDefault<Xxh3>> = HashSet::from_iter([
            "YEP_BattleEngineCore",
            "YEP_OptionsCore",
            "SRD_NameInputUpgrade",
            "YEP_KeyboardConfig",
            "YEP_ItemCore",
            "YEP_X_ItemDiscard",
            "YEP_EquipCore",
            "YEP_ItemSynthesis",
            "ARP_CommandIcons",
            "YEP_X_ItemCategories",
            "Olivia_OctoBattle",
        ]);

        let name: &str = obj["name"].as_str().unwrap();

        // It it's a plugin with the needed text, proceed
        if plugin_names.contains(name) {
            //YEP_OptionsCore should be processed differently, as its parameters is a mess, that can't even be parsed to json
            if name == "YEP_OptionsCore" {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .iter_mut()
                    .par_bridge()
                    .for_each(|(key, string): (&String, &mut Value)| {
                        if key == "OptionsCategories" {
                            let mut subparameter: String = string.as_str().unwrap().to_string();

                            for (text, translated_text) in plugins_original_text_vec
                                .iter()
                                .zip(plugins_translated_text_vec.iter())
                            {
                                subparameter =
                                    subparameter.replacen(text, translated_text.as_str(), 1);
                            }

                            *string = to_value(subparameter).unwrap();
                        } else if let Some(param) =
                            plugins_translation_map.get(string.as_str().unwrap())
                        {
                            *string = to_value(param).unwrap();
                        }
                    });
            }
            // Everything else is an easy walk
            else {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|string: &mut Value| {
                        if string.is_string() {
                            if let Some(param) =
                                plugins_translation_map.get(string.as_str().unwrap())
                            {
                                *string = to_value(param).unwrap();
                            }
                        }
                    });
            }
        }
    });

    write(
        output_path.join("plugins.js"),
        format!("var $plugins =\n{}", to_string(&obj_arr).unwrap()),
    )
    .unwrap();

    if logging {
        println!("{} plugins.js", unsafe { LOG_MSG });
    }
}
