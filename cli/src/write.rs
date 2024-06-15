use rand::{rngs::ThreadRng, seq::SliceRandom, thread_rng};
use rayon::prelude::*;
use serde_json::{to_string, to_value, Value};
use std::{
    collections::{HashMap, HashSet},
    fs::{read_to_string, write},
};

fn merge_401(json: &mut Value) {
    let mut first: Option<usize> = None;
    let mut number: i8 = -1;
    let mut prev: bool = false;
    let mut string_vec: Vec<String> = Vec::new();

    let mut i: usize = 0;

    let json_array: &mut Vec<Value> = json.as_array_mut().unwrap();

    while i < json_array.len() {
        let object: &Value = &json_array[i];
        let code: u16 = object["code"].as_u64().unwrap() as u16;

        if code == 401 {
            if first.is_none() {
                first = Some(i);
            }

            number += 1;
            string_vec.push(object["parameters"][0].as_str().unwrap().to_string());
            prev = true;
        } else if i > 0 && prev && first.is_some() && number != -1 {
            json_array[first.unwrap()]["parameters"][0] = to_value(string_vec.join("\n")).unwrap();

            let start_index: usize = first.unwrap() + 1;
            let items_to_delete: usize = start_index + number as usize;
            json_array.par_drain(start_index..items_to_delete);

            string_vec.clear();
            i -= number as usize;
            number = -1;
            first = None;
            prev = false;
        }

        i += 1;
    }
}

pub fn merge_map(mut obj: Value) -> Value {
    obj["events"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .skip(1)
        .for_each(|event: &mut Value| {
            if !event["pages"].is_array() {
                return;
            }

            event["pages"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|page: &mut Value| merge_401(&mut page["list"]));
        });

    obj
}

pub fn merge_other(mut obj_arr: Vec<Value>) -> Vec<Value> {
    obj_arr.par_iter_mut().for_each(|obj: &mut Value| {
        if obj["pages"].is_array() {
            obj["pages"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|page: &mut Value| {
                    merge_401(&mut page["list"]);
                });
        } else if obj["list"].is_array() {
            merge_401(&mut obj["list"]);
        }
    });

    obj_arr
}

pub fn write_maps(
    mut obj_map: HashMap<String, Value>,
    output_dir: &str,
    text_hashmap: HashMap<&str, &str>,
    names_hashmap: HashMap<&str, &str>,
    logging: bool,
    log_string: &str,
) {
    obj_map
        .par_iter_mut()
        .for_each(|(filename, obj): (&String, &mut Value)| {
            if let Some(location_name) = names_hashmap.get(obj["displayName"].as_str().unwrap()) {
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
                            page["list"]
                                .as_array_mut()
                                .unwrap()
                                .par_iter_mut()
                                .for_each(|item: &mut Value| {
                                    let code: u16 = item["code"].as_u64().unwrap() as u16;

                                    item["parameters"]
                                        .as_array_mut()
                                        .unwrap()
                                        .par_iter_mut()
                                        .for_each(|parameter_value: &mut Value| {
                                            if parameter_value.is_string() {
                                                let parameter: &str =
                                                    parameter_value.as_str().unwrap();

                                                if code == 401
                                                    || code == 402
                                                    || code == 324
                                                    || (code == 356
                                                        && (parameter.starts_with("GabText")
                                                            || (parameter
                                                                .starts_with("choice_text")
                                                                && !parameter.ends_with("????"))))
                                                {
                                                    if let Some(text) = text_hashmap.get(parameter)
                                                    {
                                                        *parameter_value = to_value(text).unwrap();
                                                    }
                                                }
                                            } else if code == 102 && parameter_value.is_array() {
                                                parameter_value
                                                    .as_array_mut()
                                                    .unwrap()
                                                    .par_iter_mut()
                                                    .for_each(|param: &mut Value| {
                                                        if param.is_string() {
                                                            if let Some(text) = text_hashmap
                                                                .get(param.as_str().unwrap())
                                                            {
                                                                *param = to_value(text).unwrap();
                                                            }
                                                        }
                                                    });
                                            }
                                        });
                                });
                        });
                });
            write(format!("{output_dir}/{filename}"), obj.to_string()).unwrap();

            if logging {
                println!("{log_string} {filename}");
            }
        });
}

pub fn write_other(
    mut obj_arr_map: HashMap<String, Vec<Value>>,
    output_dir: &str,
    other_dir: &str,
    logging: bool,
    log_string: &str,
    drunk: u8,
) {
    obj_arr_map
        .par_iter_mut()
        .for_each(|(filename, obj_arr): (&String, &mut Vec<Value>)| {
            let other_original_text: Vec<String> = read_to_string(format!(
                "{other_dir}/{}.txt",
                &filename[..filename.len() - 5]
            ))
            .unwrap()
            .par_split('\n')
            .map(|line: &str| line.to_string().replace("/#", "\n"))
            .collect();

            let mut other_translated_text: Vec<String> = read_to_string(format!(
                "{other_dir}/{}_trans.txt",
                &filename[..filename.len() - 5]
            ))
            .unwrap()
            .par_split('\n')
            .map(|line: &str| line.to_string().replace("/#", "\n"))
            .collect();

            let mut rng: ThreadRng = thread_rng();

            if drunk > 0 {
                other_translated_text.shuffle(&mut rng);

                if drunk == 2 {
                    for text_string in other_translated_text.iter_mut() {
                        let mut text_string_split: Vec<&str> = text_string.split(' ').collect();
                        text_string_split.shuffle(&mut rng);
                        *text_string = text_string_split.join(" ");
                    }
                }
            }

            let translation_map: HashMap<&str, &str> = other_original_text
                .par_iter()
                .zip(other_translated_text.par_iter())
                .fold(
                    HashMap::new,
                    |mut map: HashMap<&str, &str>, (key, value): (&String, &String)| {
                        map.insert(key.as_str(), value.as_str());
                        map
                    },
                )
                .reduce(
                    HashMap::new,
                    |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                        a.extend(b);
                        a
                    },
                );

            if !filename.starts_with("Common") && !filename.starts_with("Troops") {
                obj_arr
                    .par_iter_mut()
                    .skip(1) //Skipping first element in array as it is null
                    .for_each(|obj: &mut Value| {
                        if let Some(text) = translation_map.get(obj["name"].as_str().unwrap()) {
                            obj["name"] = to_value(text).unwrap();

                            if obj["description"].is_string() {
                                if let Some(text) =
                                    translation_map.get(obj["description"].as_str().unwrap())
                                {
                                    obj["description"] = to_value(text).unwrap();
                                }
                            }

                            const TO_REPLACE: [&str; 4] = [
                                "<Menu Category: Items>",
                                "<Menu Category: Food>",
                                "<Menu Category: Healing>",
                                "<Menu Category: Body bag>",
                            ];

                            let note: &str = obj["note"].as_str().unwrap();

                            if filename == "Classes.json" {
                                // Only in Classes.json note should be replaced entirely with translated text
                                if let Some(text) = translation_map.get(note) {
                                    obj["note"] = to_value(text).unwrap();
                                }
                            } else if filename == "Items.json" {
                                for string in TO_REPLACE {
                                    if note.contains(string) {
                                        // In Items.json note contains Menu Category that should be replaced with translated text
                                        obj["note"] =
                                            to_value(note.replace(string, translation_map[string]))
                                                .unwrap();
                                        break;
                                    }
                                }
                            }
                        }
                    });
            } else {
                //Other files have the structure similar to Maps.json files
                obj_arr
                    .par_iter_mut()
                    .skip(1) //Skipping first element in array as it is null
                    .for_each(|obj: &mut Value| {
                        //CommonEvents doesn't have pages, so we can just check if it Troops
                        let pages_length: usize = if filename == "Troops.json" {
                            obj["pages"].as_array().unwrap().len()
                        } else {
                            1
                        };

                        for i in 0..pages_length {
                            //If element has pages, then we'll iterate over them
                            //Otherwise we'll just iterate over the list
                            let list: &mut Value = if pages_length != 1 {
                                &mut obj["pages"][i]["list"]
                            } else {
                                &mut obj["list"]
                            };

                            if !list.is_array() {
                                continue;
                            }

                            list.as_array_mut().unwrap().par_iter_mut().for_each(
                                |list: &mut Value| {
                                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                                    list["parameters"]
                                        .as_array_mut()
                                        .unwrap()
                                        .par_iter_mut()
                                        .for_each(|parameter_value: &mut Value| {
                                            if parameter_value.is_string() {
                                                let parameter: &str =
                                                    parameter_value.as_str().unwrap();

                                                if code == 401
                                                    || code == 402
                                                    || code == 324
                                                    || (code == 356
                                                        && (parameter.starts_with("GabText")
                                                            || (parameter
                                                                .starts_with("choice_text")
                                                                && !parameter.ends_with("????"))))
                                                {
                                                    if let Some(text) =
                                                        translation_map.get(parameter)
                                                    {
                                                        *parameter_value = to_value(text).unwrap();
                                                    }
                                                }
                                            } else if code == 102 && parameter_value.is_array() {
                                                parameter_value
                                                    .as_array_mut()
                                                    .unwrap()
                                                    .par_iter_mut()
                                                    .for_each(|param: &mut Value| {
                                                        if param.is_string() {
                                                            if let Some(text) = translation_map
                                                                .get(param.as_str().unwrap())
                                                            {
                                                                *param = to_value(text).unwrap();
                                                            }
                                                        }
                                                    });
                                            }
                                        });
                                },
                            );
                        }
                    });
            }
            write(
                format!("{output_dir}/{filename}"),
                to_string(obj_arr).unwrap(),
            )
            .unwrap();

            if logging {
                println!("{log_string} {filename}");
            }
        });
}

pub fn write_system(
    mut obj: Value,
    output_path: &str,
    translation_map: HashMap<&str, &str>,
    logging: bool,
    log_string: &str,
) {
    obj["equipTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if string.is_string() {
                if let Some(text) = translation_map.get(string.as_str().unwrap()) {
                    *string = to_value(text).unwrap();
                }
            }
        });

    obj["skillTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|string: &mut Value| {
            if string.is_string() {
                if let Some(text) = translation_map.get(string.as_str().unwrap()) {
                    *string = to_value(text).unwrap();
                }
            }
        });

    obj["terms"]
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
                            if let Some(text) = translation_map.get(string.as_str().unwrap()) {
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
                        if let Some(text) = translation_map.get(string.as_str().unwrap()) {
                            *string = to_value(text).unwrap();
                        }
                    });
            }
        });

    write(
        format!("{output_path}/System.json"),
        to_string(&obj).unwrap(),
    )
    .unwrap();

    if logging {
        println!("{log_string} System.json");
    }
}

pub fn write_plugins(
    mut obj_arr: Vec<Value>,
    output_path: &str,
    original_text_vec: Vec<String>,
    translated_text_vec: Vec<String>,
    logging: bool,
    log_string: &str,
) {
    let translation_map: HashMap<&str, &str> = original_text_vec
        .par_iter()
        .zip(translated_text_vec.par_iter())
        .fold(
            HashMap::new,
            |mut map: HashMap<&str, &str>, (key, value): (&String, &String)| {
                map.insert(key.as_str(), value.as_str());
                map
            },
        )
        .reduce(
            HashMap::new,
            |mut a: HashMap<&str, &str>, b: HashMap<&str, &str>| {
                a.extend(b);
                a
            },
        );

    obj_arr.par_iter_mut().for_each(|obj: &mut Value| {
        let plugin_names: HashSet<&str> = HashSet::from([
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
        if plugin_names.contains(name) {
            if name == "YEP_OptionsCore" {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .iter_mut()
                    .par_bridge()
                    .for_each(|(key, string): (&String, &mut Value)| {
                        if key == "OptionsCategories" {
                            let mut param: String = string.as_str().unwrap().to_string();

                            for (text, translated_text) in
                                original_text_vec.iter().zip(translated_text_vec.iter())
                            {
                                param = param.replacen(text, translated_text.as_str(), 1);
                            }

                            *string = to_value(param).unwrap();
                        } else if let Some(param) = translation_map.get(string.as_str().unwrap()) {
                            *string = to_value(param).unwrap();
                        }
                    });
            } else {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|string: &mut Value| {
                        if string.is_string() {
                            if let Some(param) = translation_map.get(string.as_str().unwrap()) {
                                *string = to_value(param).unwrap();
                            }
                        }
                    });
            }
        }
    });

    const PREFIX: &str = "var $plugins =";

    write(
        format!("{output_path}/plugins.js"),
        format!("{PREFIX}\n{}", to_string(&obj_arr).unwrap()),
    )
    .unwrap();

    if logging {
        println!("{log_string} plugins.js");
    }
}
