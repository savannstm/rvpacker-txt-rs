use rayon::prelude::*;
use serde_json::{from_str, to_string, to_value, Value, Value::Array};
use std::collections::{HashMap, HashSet};
use std::fs::{create_dir_all, read_dir, read_to_string, write};
use std::time::Instant;

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

fn merge_map(mut json: Value) -> Value {
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

fn merge_other(mut json: Value) -> Value {
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

fn write_maps(
    mut json: HashMap<String, Value>,
    output_dir: &str,
    text_hashmap: HashMap<&str, &str>,
    names_hashmap: HashMap<&str, &str>,
) {
    json.par_iter_mut()
        .for_each(|(f, file): (&String, &mut Value)| {
            if file["displayName"].is_string() {
                if let Some(location_name) =
                    names_hashmap.get(file["displayName"].as_str().unwrap())
                {
                    file["displayName"] = to_value(location_name).unwrap();
                }
            }

            file["events"]
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
                            if !page["list"].is_array() {
                                return;
                            }

                            page["list"]
                                .as_array_mut()
                                .unwrap()
                                .par_iter_mut()
                                .for_each(|item: &mut Value| {
                                    if !item["parameters"].is_array() {
                                        return;
                                    }

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
        });
}

fn write_other(mut json: HashMap<String, Value>, output_dir: &str, other_dir: &str) {
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

            file.as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|element: &mut Value| {
                    if !element.is_object() {
                        return;
                    }

                    if f != "CommonEvents.json" && f != "Troops.json" {
                        element
                            .as_object_mut()
                            .unwrap()
                            .iter_mut()
                            .par_bridge()
                            .for_each_with(
                                ["name", "description", "note"],
                                |attrs: &mut [&str; 3], (key, value): (&String, &mut Value)| {
                                    if !attrs.contains(&key.as_str()) {
                                        return;
                                    }

                                    if value.is_string() {
                                        if let Some(text) = hashmap.get(value.as_str().unwrap()) {
                                            *value = to_value(text).unwrap();
                                        }
                                    }
                                },
                            );
                        return;
                    }

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

                        iterable_object
                            .as_array_mut()
                            .unwrap()
                            .par_iter_mut()
                            .for_each(|list: &mut Value| {
                                if !list["parameters"].is_array() {
                                    return;
                                }

                                let code: u16 = list["code"].as_u64().unwrap() as u16;

                                list["parameters"]
                                    .as_array_mut()
                                    .unwrap()
                                    .par_iter_mut()
                                    .for_each(|parameter: &mut Value| {
                                        if parameter.is_string() {
                                            let parameter_str: &str = parameter.as_str().unwrap();

                                            if code == 401
                                                || code == 402
                                                || code == 324
                                                || (code == 356
                                                    && (parameter_str.starts_with("GabText")
                                                        || (parameter_str
                                                            .starts_with("choice_text")
                                                            && !parameter_str.ends_with("????"))))
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
            write(format!("{}/{}", output_dir, f), file.to_string()).unwrap();
        });
}

fn write_system(mut json: Value, output_path: &str, system_text_hashmap: HashMap<&str, &str>) {
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
                if !value["messages"].is_object() {
                    return;
                }

                value["messages"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|message_value: &mut Value| {
                        if message_value.is_string() {
                            if let Some(text) =
                                system_text_hashmap.get(message_value.as_str().unwrap())
                            {
                                *message_value = to_value(text).unwrap();
                            }
                        }
                    });
            }
        });

    write(
        format!("{}/System.json", output_path),
        to_string(&json).unwrap(),
    )
    .unwrap();
}

fn write_plugins(
    mut json: Vec<Value>,
    output_path: &str,
    original_text_vec: Vec<String>,
    translated_text_vec: Vec<String>,
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

    const PREFIX: &str = "var $plugins =";

    write(
        format!("{}/plugins.js", output_path),
        format!("{}\n{}", PREFIX, to_string(&json).unwrap()),
    )
    .unwrap();
}

pub fn main() -> String {
    let start_time: Instant = Instant::now();

    let dir_paths: Paths = Paths {
        original: "./res/original",
        output: "./res/data",
        maps: "./res/copies/maps/maps.txt",
        maps_trans: "./res/copies/maps/maps_trans.txt",
        names: "./res/copies/maps/names.txt",
        names_trans: "./res/copies/maps/names_trans.txt",
        other: "./res/copies/other",
        plugins: "./res/copies/plugins",
        plugins_output: "./res/js",
    };

    create_dir_all(dir_paths.output).unwrap();
    create_dir_all(dir_paths.plugins_output).unwrap();

    let maps_hashmap: HashMap<String, Value> = read_dir(dir_paths.original)
        .unwrap()
        .par_bridge()
        .fold(
            HashMap::new,
            |mut hashmap: HashMap<String, Value>,
             path: Result<std::fs::DirEntry, std::io::Error>| {
                let filename: String = path.as_ref().unwrap().file_name().into_string().unwrap();

                if filename.starts_with("Map") {
                    hashmap.insert(
                        filename,
                        merge_map(
                            from_str(&read_to_string(path.unwrap().path()).unwrap()).unwrap(),
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
    );

    const PREFIXES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];

    let other_hashmap: HashMap<String, Value> = read_dir(dir_paths.original)
        .unwrap()
        .par_bridge()
        .fold(
            HashMap::new,
            |mut hashmap: HashMap<String, Value>,
             path: Result<std::fs::DirEntry, std::io::Error>| {
                let filename: String = path.as_ref().unwrap().file_name().into_string().unwrap();

                if !PREFIXES.par_iter().any(|x: &&str| filename.starts_with(x)) {
                    hashmap.insert(
                        filename,
                        merge_other(
                            from_str(&read_to_string(path.unwrap().path()).unwrap()).unwrap(),
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

    write_other(other_hashmap, dir_paths.output, dir_paths.other);

    let system_json: Value =
        from_str(&read_to_string(format!("{}/System.json", dir_paths.original)).unwrap()).unwrap();

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

    write_system(system_json, dir_paths.output, system_text_hashmap);

    let plugins_json: Vec<Value> =
        from_str(&read_to_string(format!("{}/plugins.json", dir_paths.plugins)).unwrap()).unwrap();

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
    );

    format!(
        "Все файлы записаны успешно.\nПотрачено {} секунд.",
        Instant::now().duration_since(start_time).as_secs_f64()
    )
}
