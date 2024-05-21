use rayon::prelude::*;
use serde_json::{to_string, to_value, Value, Value::Array};
use std::collections::{HashMap, HashSet};
use std::fs::{read_to_string, write};

fn merge_401(mut json: Vec<Value>) -> Vec<Value> {
    let mut first: Option<u16> = None;
    let mut number: i8 = -1;
    let mut prev: bool = false;
    let mut string_vec: Vec<String> = Vec::new();

    let mut i: usize = 0;
    while i < json.len() {
        let object: &Value = &json[i];
        let code: u16 = object["code"].as_u64().unwrap() as u16;

        if code == 401 {
            if first.is_none() {
                first = Some(i as u16);
            }

            number += 1;
            string_vec.push(object["parameters"][0].as_str().unwrap().to_string());
            prev = true;
        } else if i > 0 && prev && first.is_some() && number != -1 {
            json[first.unwrap() as usize]["parameters"][0] =
                to_value(string_vec.join("\n")).unwrap();

            let start_index: usize = first.unwrap() as usize + 1;
            let items_to_delete: usize = start_index + number as usize;
            json.par_drain(start_index..items_to_delete);

            string_vec.clear();
            i -= number as usize;
            number = -1;
            first = None;
            prev = false;
        }

        i += 1;
    }
    json
}

pub fn merge_map(mut json: Value) -> Value {
    json["events"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|event: &mut Value| {
            if !event["pages"].is_array() {
                return;
            }

            event["pages"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|page: &mut Value| {
                    page["list"] = Array(merge_401(page["list"].as_array().unwrap().to_vec()))
                });
        });

    json
}

pub fn merge_other(mut json: Value) -> Value {
    json.as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if element["pages"].is_array() {
                element["pages"]
                    .as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .for_each(|page: &mut Value| {
                        page["list"] = Array(merge_401(page["list"].as_array().unwrap().to_vec()));
                    });
            } else if element["list"].is_array() {
                element["list"] = Array(merge_401(element["list"].as_array().unwrap().to_vec()));
            }
        });
    json
}

pub fn write_maps(
    mut json: HashMap<String, Value>,
    output_dir: &str,
    text_hashmap: HashMap<&str, &str>,
    names_hashmap: HashMap<&str, &str>,
    logging: bool,
) {
    json.par_iter_mut()
        .for_each(|(f, file): (&String, &mut Value)| {
            if let Some(location_name) = names_hashmap.get(file["displayName"].as_str().unwrap()) {
                file["displayName"] = to_value(location_name).unwrap();
            }

            file["events"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .skip(1)
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
                                        .for_each(|parameter: &mut Value| {
                                            if parameter.is_string() {
                                                let parameter_str: &str =
                                                    parameter.as_str().unwrap();

                                                if code == 401
                                                    || code == 402
                                                    || code == 324
                                                    || (code == 356
                                                        && (parameter_str.starts_with("GabText")
                                                            || (parameter_str
                                                                .starts_with("choice_text")
                                                                && !parameter_str
                                                                    .ends_with("????"))))
                                                {
                                                    if let Some(text) =
                                                        text_hashmap.get(parameter_str)
                                                    {
                                                        *parameter = to_value(text).unwrap();
                                                    }
                                                }
                                            } else if code == 102 && parameter.is_array() {
                                                parameter
                                                    .as_array_mut()
                                                    .unwrap()
                                                    .par_iter_mut()
                                                    .for_each(|param: &mut Value| {
                                                        if param.is_string() {
                                                            if let Some(text) = text_hashmap.get(
                                                                param
                                                                    .as_str()
                                                                    .unwrap()
                                                                    .replace("\\n[", "\\N[")
                                                                    .as_str(),
                                                            ) {
                                                                *param = to_value(text).unwrap();
                                                            }
                                                        }
                                                    });
                                            }
                                        });
                                });
                        });
                });
            write(format!("{}/{}", output_dir, f), file.to_string()).unwrap();
            if logging {
                println!("Записан файл {}", f);
            }
        });
}

pub fn write_other(
    mut json: HashMap<String, Value>,
    output_dir: &str,
    other_dir: &str,
    logging: bool,
) {
    json.par_iter_mut()
        .for_each(|(f, file): (&String, &mut Value)| {
            let other_original_text: Vec<String> =
                read_to_string(format!("{}/{}.txt", other_dir, &f[..f.len() - 5]))
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.to_string().replace("\\n", "\n"))
                    .collect();

            let other_translated_text: Vec<String> =
                read_to_string(format!("{}/{}_trans.txt", other_dir, &f[..f.len() - 5]))
                    .unwrap()
                    .par_split('\n')
                    .map(|x: &str| x.to_string().replace("\\n", "\n"))
                    .collect();

            let hashmap: HashMap<&str, &str> = other_original_text
                .par_iter()
                .zip(other_translated_text.par_iter())
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

            if f != "CommonEvents.json" && f != "Troops.json" {
                file.as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .skip(1)
                    .for_each(|element: &mut Value| {
                        if let Some(text) = hashmap.get(element["name"].as_str().unwrap()) {
                            element["name"] = to_value(text).unwrap();

                            if element["description"].is_string() {
                                if let Some(text) =
                                    hashmap.get(element["description"].as_str().unwrap())
                                {
                                    element["description"] = to_value(text).unwrap();
                                }
                            }

                            const TO_REPLACE: [&str; 4] = [
                                "<Menu Category: Items>",
                                "<Menu Category: Food>",
                                "<Menu Category: Healing>",
                                "<Menu Category: Body bag>",
                            ];

                            let note_str: &str = element["note"].as_str().unwrap();

                            if f == "Classes.json" {
                                if let Some(text) = hashmap.get(note_str) {
                                    element["note"] = to_value(text).unwrap();
                                }
                            } else {
                                for text in TO_REPLACE {
                                    if note_str.contains(text) {
                                        element["note"] =
                                            to_value(note_str.replace(text, hashmap[text]))
                                                .unwrap();
                                        break;
                                    }
                                }
                            }
                        }
                    });
            } else {
                file.as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .skip(1)
                    .for_each(|element: &mut Value| {
                        let pages_length: usize = if element["pages"].is_array() {
                            element["pages"].as_array().unwrap().len()
                        } else {
                            1
                        };

                        for i in 0..pages_length {
                            let iterable_object: &mut Value = if pages_length != 1 {
                                &mut element["pages"][i]["list"]
                            } else {
                                &mut element["list"]
                            };

                            if !iterable_object.is_array() {
                                continue;
                            }

                            iterable_object
                                .as_array_mut()
                                .unwrap()
                                .par_iter_mut()
                                .for_each(|list: &mut Value| {
                                    let code: u16 = list["code"].as_u64().unwrap() as u16;

                                    list["parameters"]
                                        .as_array_mut()
                                        .unwrap()
                                        .par_iter_mut()
                                        .for_each(|parameter: &mut Value| {
                                            if parameter.is_string() {
                                                let parameter_str: &str =
                                                    parameter.as_str().unwrap();

                                                if code == 401
                                                    || code == 402
                                                    || code == 324
                                                    || (code == 356
                                                        && (parameter_str.starts_with("GabText")
                                                            || (parameter_str
                                                                .starts_with("choice_text")
                                                                && !parameter_str
                                                                    .ends_with("????"))))
                                                {
                                                    if let Some(text) = hashmap.get(parameter_str) {
                                                        *parameter = to_value(text).unwrap();
                                                    }
                                                }
                                            } else if code == 102 && parameter.is_array() {
                                                parameter
                                                    .as_array_mut()
                                                    .unwrap()
                                                    .par_iter_mut()
                                                    .for_each(|param: &mut Value| {
                                                        if param.is_string() {
                                                            if let Some(text) = hashmap.get(
                                                                param
                                                                    .as_str()
                                                                    .unwrap()
                                                                    .replace("\\n[", "\\N[")
                                                                    .as_str(),
                                                            ) {
                                                                *param = to_value(text).unwrap();
                                                            }
                                                        }
                                                    });
                                            }
                                        });
                                });
                        }
                    });
            }
            write(format!("{}/{}", output_dir, f), file.to_string()).unwrap();

            if logging {
                println!("Записан файл {}", f);
            }
        });
}

pub fn write_system(
    mut json: Value,
    output_path: &str,
    system_text_hashmap: HashMap<&str, &str>,
    logging: bool,
) {
    json["equipTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if element.is_string() {
                if let Some(text) = system_text_hashmap.get(element.as_str().unwrap()) {
                    *element = to_value(text).unwrap();
                }
            }
        });

    json["skillTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if element.is_string() {
                if let Some(text) = system_text_hashmap.get(element.as_str().unwrap()) {
                    *element = to_value(text).unwrap();
                }
            }
        });

    json["variables"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if element.is_string() {
                let element_str: &str = element.as_str().unwrap();

                if element_str.ends_with("phobia") {
                    if let Some(text) = system_text_hashmap.get(element_str) {
                        *element = to_value(text).unwrap();
                    }

                    if element.as_str().unwrap().starts_with("Pan") {}
                }
            }
        });

    json["terms"]
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
                            if let Some(text) = system_text_hashmap.get(string.as_str().unwrap()) {
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
                    .for_each(|message_value: &mut Value| {
                        if let Some(text) = system_text_hashmap.get(message_value.as_str().unwrap())
                        {
                            *message_value = to_value(text).unwrap();
                        }
                    });
            }
        });

    write(
        format!("{}/System.json", output_path),
        to_string(&json).unwrap(),
    )
    .unwrap();
    if logging {
        println!("Записан файл System.json");
    }
}

pub fn write_plugins(
    mut json: Vec<Value>,
    output_path: &str,
    original_text_vec: Vec<String>,
    translated_text_vec: Vec<String>,
    logging: bool,
) {
    let hashmap: HashMap<&str, &str> = original_text_vec
        .par_iter()
        .zip(translated_text_vec.par_iter())
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

    json.par_iter_mut().for_each(|obj: &mut Value| {
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
                    .for_each(|(key, value): (&String, &mut Value)| {
                        if key == "OptionsCategories" {
                            let mut param: String = value.as_str().unwrap().to_string();

                            for (text, translated_text) in
                                original_text_vec.iter().zip(translated_text_vec.iter())
                            {
                                param = param.replacen(text, translated_text.as_str(), 1);
                            }

                            *value = to_value(param).unwrap();
                        } else if let Some(param) = hashmap.get(value.as_str().unwrap()) {
                            *value = to_value(param).unwrap();
                        }
                    });
            } else {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|value: &mut Value| {
                        if value.is_string() {
                            if let Some(param) = hashmap.get(value.as_str().unwrap()) {
                                *value = to_value(param).unwrap();
                            }
                        }
                    });
            }
        }
    });

    const PREFIX: &str =
        "// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =";

    write(
        format!("{}/plugins.js", output_path),
        format!("{}\n{}", PREFIX, to_string(&json).unwrap()),
    )
    .unwrap();

    if logging {
        println!("Записан файл plugins.js");
    }
}
