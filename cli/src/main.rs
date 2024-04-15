use rayon::prelude::*;
use serde_json::{from_str, to_string, to_value, Value, Value::Array};
use std::collections::{HashMap, HashSet};
use std::fs::{create_dir_all, read_dir, read_to_string, write};
use std::time::Instant;

struct Paths {
    original: String,
    output: String,
    maps: String,
    maps_trans: String,
    names: String,
    names_trans: String,
    other: String,
    plugins: String,
    plugins_output: String,
}

fn merge_401(mut json: Vec<Value>) -> Vec<Value> {
    let mut first: i16 = -1;
    let mut number: i8 = -1;
    let mut prev: bool = false;
    let mut string_vec: Vec<String> = Vec::new();

    let mut i: usize = 0;
    while i < json.len() {
        let object: &Value = &json[i as usize];
        let code: i16 = object["code"].as_i64().unwrap() as i16;

        if code == 401 {
            if first == -1 {
                first = i as i16;
            }

            number += 1;
            string_vec.push(object["parameters"][0].as_str().unwrap().to_string());
            prev = true;
        } else if i > 0 && prev && first != -1 && number != -1 {
            json[first as usize]["parameters"][0] = to_value(&string_vec.join("\n")).unwrap();

            let start_index: usize = first as usize + 1;
            let items_to_delete: usize = start_index + number as usize;
            json.par_drain(start_index..items_to_delete);

            string_vec.clear();
            i -= number as usize;
            number = -1;
            first = -1;
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
        .for_each(|event| {
            if event.is_null() || event["pages"].is_null() {
                return;
            }

            event["pages"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|page| {
                    page["list"] = Array(merge_401(page["list"].as_array().unwrap().to_vec()))
                });
        });

    json
}

fn merge_other(mut json: Value) -> Value {
    json.as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element| {
            if !element["pages"].is_null() {
                element["pages"]
                    .as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .for_each(|page| {
                        page["list"] = Array(merge_401(page["list"].as_array().unwrap().to_vec()));
                    });
            } else {
                if !element["list"].is_null() {
                    element["list"] =
                        Array(merge_401(element["list"].as_array().unwrap().to_vec()));
                }
            }
        });
    json
}

fn write_maps(
    json: &mut HashMap<String, Value>,
    output_dir: &String,
    original_text_vec: &Vec<String>,
    translated_text_vec: &Vec<String>,
    original_names_vec: &Vec<String>,
    translated_names_vec: &Vec<String>,
) {
    let text_hashmap: HashMap<&str, &str> = original_text_vec
        .par_iter()
        .zip(translated_text_vec.par_iter())
        .fold(
            || HashMap::new(),
            |mut hashmap, (key, value)| {
                hashmap.insert(key.as_str(), value.as_str());
                hashmap
            },
        )
        .reduce(
            || HashMap::new(),
            |mut a, b| {
                a.extend(b);
                a
            },
        );

    let names_hashmap: HashMap<&str, &str> = original_names_vec
        .par_iter()
        .zip(translated_names_vec.par_iter())
        .fold(
            || HashMap::new(),
            |mut hashmap, (key, value)| {
                hashmap.insert(key.as_str(), value.as_str());
                hashmap
            },
        )
        .reduce(
            || HashMap::new(),
            |mut a, b| {
                a.extend(b);
                a
            },
        );

    json.par_iter_mut().for_each(|(f, file)| {
        let output_path: String = format!("{}/{}", output_dir, f).to_string();
        let location_name: Option<&str> = match file["locationName"].as_str() {
            Some(name) => Some(name),
            None => None,
        };

        if location_name.is_some() {
            if names_hashmap.get(location_name.as_ref().unwrap()).is_some() {
                file["displayName"] = to_value(&names_hashmap[&location_name.unwrap()]).unwrap();
            }
        }

        file["events"]
            .as_array_mut()
            .unwrap()
            .par_iter_mut()
            .for_each(|event| {
                if event["pages"].is_null() {
                    return;
                }

                event["pages"]
                    .as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .for_each(|page| {
                        if page["list"].is_null() {
                            return;
                        }

                        page["list"]
                            .as_array_mut()
                            .unwrap()
                            .par_iter_mut()
                            .for_each(|item| {
                                if item["parameters"].is_null()
                                    || item["parameters"].as_array().is_none()
                                {
                                    return;
                                }

                                let code: i16 = item["code"].as_i64().unwrap() as i16;

                                item["parameters"]
                                    .as_array_mut()
                                    .unwrap()
                                    .par_iter_mut()
                                    .for_each(|parameter| {
                                        let mut parameter_text: Option<String> = None;

                                        if parameter.is_string() {
                                            parameter_text = Some(
                                                parameter.as_str().unwrap().replace("\\n[", "\\N["),
                                            );
                                        }

                                        match parameter_text {
                                            None => {
                                                if code == 102 && parameter.is_array() {
                                                    parameter
                                                        .as_array_mut()
                                                        .unwrap()
                                                        .par_iter_mut()
                                                        .for_each(|param| {
                                                            if param.is_string() {
                                                                let param_text: String = param
                                                                    .as_str()
                                                                    .unwrap()
                                                                    .replace("\\n[", "\\N[");

                                                                if text_hashmap
                                                                    .get(&param_text.as_str())
                                                                    .is_some()
                                                                {
                                                                    *param = to_value(
                                                                        &text_hashmap
                                                                            [&param_text.as_str()],
                                                                    )
                                                                    .unwrap();
                                                                }
                                                            }
                                                        });
                                                }
                                            }
                                            Some(_) => {
                                                if code == 401
                                                    || code == 402
                                                    || code == 324
                                                    || (code == 356
                                                        && (parameter_text
                                                            .as_ref()
                                                            .unwrap()
                                                            .starts_with("GabText")
                                                            || (parameter_text
                                                                .as_ref()
                                                                .unwrap()
                                                                .starts_with("choice_text")
                                                                && !parameter_text
                                                                    .as_ref()
                                                                    .unwrap()
                                                                    .ends_with("????"))))
                                                {
                                                    if text_hashmap
                                                        .get(
                                                            &parameter_text
                                                                .as_ref()
                                                                .unwrap()
                                                                .as_str(),
                                                        )
                                                        .is_some()
                                                    {
                                                        *parameter = to_value(
                                                            &text_hashmap
                                                                [&parameter_text.unwrap().as_str()],
                                                        )
                                                        .unwrap();
                                                    }
                                                }
                                            }
                                        }
                                    });
                            });
                    });
            });
        write(output_path, file.to_string()).unwrap();
        println!("Записан файл {}", f);
    });
}

fn write_other(json: &mut HashMap<String, Value>, output_dir: &String, other_dir: &String) {
    json.par_iter_mut().for_each(|(f, file)| {
        let output_path: String = format!("{}/{}", output_dir, &f).to_string();

        let other_original_text: Vec<String> =
            read_to_string(format!("{}/{}.txt", &other_dir, &f[..f.len() - 5]))
                .unwrap()
                .split("\n")
                .map(|x| x.to_string().replace("\\n", "\n"))
                .collect();

        let other_translated_text: Vec<String> =
            read_to_string(format!("{}/{}_trans.txt", &other_dir, &f[..f.len() - 5]))
                .unwrap()
                .split("\n")
                .map(|x| x.to_string().replace("\\n", "\n"))
                .collect();

        let hashmap: HashMap<&str, &str> = other_original_text
            .iter()
            .zip(other_translated_text.iter())
            .par_bridge()
            .fold(
                || HashMap::new(),
                |mut hashmap, (key, value)| {
                    hashmap.insert(key.as_str(), value.as_str());
                    hashmap
                },
            )
            .reduce(
                || HashMap::new(),
                |mut a, b| {
                    a.extend(b);
                    a
                },
            );

        file.as_array_mut()
            .unwrap()
            .par_iter_mut()
            .for_each(|element| {
                if element.is_null() {
                    return;
                }

                if element["pages"].is_null() {
                    if element["list"].is_null() {
                        const ATTRS: [&str; 3] = ["name", "description", "note"];

                        for (key, value) in element.as_object_mut().unwrap().iter_mut() {
                            if !ATTRS.contains(&key.as_str()) {
                                continue;
                            }

                            if !value.is_null() && value.as_str().unwrap().len() != 0 {
                                if hashmap.get(&value.as_str().unwrap()).is_some() {
                                    *value = to_value(
                                        &hashmap.get(&value.as_str().unwrap()).unwrap().to_string(),
                                    )
                                    .unwrap();
                                }
                            }
                        }
                    } else {
                        let name: &str = element["name"].as_str().unwrap();

                        if name.len() != 0 {
                            if hashmap.get(&name).is_some() {
                                element["name"] = to_value(&hashmap.get(&name).unwrap()).unwrap();
                            }
                        }
                    }
                }

                let mut pages_length: Option<usize> = None;

                if !element["pages"].is_null() {
                    pages_length = Some(element["pages"].as_array().unwrap().len());
                }

                for i in 0..(pages_length.unwrap_or(0)) {
                    let mut iterable_object: Option<&mut Value> = None;

                    if pages_length.unwrap() != 1 {
                        iterable_object = Some(&mut element["pages"][i]);
                    } else {
                        iterable_object = Some(element);
                    }

                    if iterable_object.as_ref().unwrap()["list"].is_null() {
                        continue;
                    }

                    iterable_object.unwrap()["list"]
                        .as_array_mut()
                        .unwrap()
                        .iter_mut()
                        .for_each(|list| {
                            let code: i16 = list["code"].as_i64().unwrap() as i16;

                            list["parameters"]
                                .as_array_mut()
                                .unwrap()
                                .iter_mut()
                                .for_each(|parameter| {
                                    let mut parameter_text: Option<&str> = None;

                                    if parameter.is_string() {
                                        parameter_text = Some(parameter.as_str().unwrap());
                                    }

                                    match parameter_text {
                                        None => {
                                            if code == 102 && parameter.is_array() {
                                                parameter
                                                    .as_array_mut()
                                                    .unwrap()
                                                    .par_iter_mut()
                                                    .for_each(|param| {
                                                        if param.is_string() {
                                                            let param_text: String = param
                                                                .as_str()
                                                                .unwrap()
                                                                .replace("\\n[", "\\N[");

                                                            if hashmap
                                                                .get(&param_text.as_str())
                                                                .is_some()
                                                            {
                                                                *param = to_value(
                                                                    &hashmap[&param_text.as_str()]
                                                                        .to_string(),
                                                                )
                                                                .unwrap();
                                                            }
                                                        }
                                                    });
                                            }
                                        }
                                        Some(_) => {
                                            if code == 401
                                                || code == 402
                                                || code == 324
                                                || (code == 356
                                                    && (parameter_text
                                                        .as_ref()
                                                        .unwrap()
                                                        .starts_with("GabText")
                                                        || (parameter_text
                                                            .as_ref()
                                                            .unwrap()
                                                            .starts_with("choice_text")
                                                            && !parameter_text
                                                                .as_ref()
                                                                .unwrap()
                                                                .ends_with("????"))))
                                            {
                                                if hashmap
                                                    .get(parameter_text.as_ref().unwrap())
                                                    .is_some()
                                                {
                                                    *parameter = to_value(
                                                        &hashmap[parameter_text.as_ref().unwrap()]
                                                            .to_string(),
                                                    )
                                                    .unwrap();
                                                }
                                            }
                                        }
                                    }
                                });
                        });
                }
            });
        write(output_path, file.to_string()).unwrap();
        println!("Записан файл {}", &f);
    });
}

fn write_system(json: &mut Value, output_path: &String, system_text_hashmap: &HashMap<&str, &str>) {
    json["equipTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element| {
            if !element.is_null()
                && system_text_hashmap
                    .get(&element.as_str().unwrap())
                    .is_some()
            {
                *element = to_value(&system_text_hashmap[&element.as_str().unwrap()]).unwrap();
            }
        });

    json["skillTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element| {
            if !element.is_null()
                && system_text_hashmap
                    .get(&element.as_str().unwrap())
                    .is_some()
            {
                *element = to_value(&system_text_hashmap[&element.as_str().unwrap()]).unwrap();
            }
        });

    json["variables"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element| {
            if element.as_str().unwrap().ends_with("phobia") {
                if system_text_hashmap
                    .get(&element.as_str().unwrap())
                    .is_some()
                {
                    *element = to_value(&system_text_hashmap[&element.as_str().unwrap()]).unwrap();
                }

                if element.as_str().unwrap().starts_with("Pan") {
                    return;
                }
            }
        });

    json["terms"]
        .as_object_mut()
        .unwrap()
        .iter_mut()
        .par_bridge()
        .for_each(|(key, value)| {
            if key != "messages" {
                value
                    .as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .for_each(|string| {
                        if !string.is_null()
                            && system_text_hashmap.get(&string.as_str().unwrap()).is_some()
                        {
                            *string =
                                to_value(&system_text_hashmap[&string.as_str().unwrap()]).unwrap();
                        }
                    });
            } else {
                if value["messages"].is_null() {
                    return;
                }

                value["messages"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|message_value| {
                        if !message_value.is_null()
                            && system_text_hashmap
                                .get(&message_value.as_str().unwrap())
                                .is_some()
                        {
                            *message_value =
                                to_value(&system_text_hashmap[&message_value.as_str().unwrap()])
                                    .unwrap();
                        }
                    });
            }
        });

    write(
        format!("{}/System.json", &output_path),
        &to_string(&json).unwrap(),
    )
    .unwrap();
    println!("Записан файл System.json");
}

fn write_plugins(
    json: &mut Vec<Value>,
    output_path: &String,
    original_text_vec: &Vec<String>,
    translated_text_vec: &Vec<String>,
) {
    let hashmap: HashMap<&str, &str> = original_text_vec
        .par_iter()
        .zip(translated_text_vec.par_iter())
        .fold(
            || HashMap::new(),
            |mut hashmap, (key, value)| {
                hashmap.insert(key.as_str(), value.as_str());
                hashmap
            },
        )
        .reduce(
            || HashMap::new(),
            |mut a, b| {
                a.extend(b);
                a
            },
        );

    json.par_iter_mut().for_each(|obj| {
        let name: &str = obj["name"].as_str().unwrap();
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

        if plugin_names.contains(name) {
            if name == "YEP_OptionsCore" {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .iter_mut()
                    .par_bridge()
                    .for_each(|(key, value)| {
                        if key == "OptionsCategories" {
                            let mut param: String = value.as_str().unwrap().to_string();

                            for (text, translated_text) in
                                original_text_vec.iter().zip(translated_text_vec.iter())
                            {
                                param = param.replacen(text, translated_text.as_str(), 1);
                            }

                            *value = to_value(&param).unwrap();
                        } else {
                            let param: &str = value.as_str().unwrap();

                            if hashmap.get(&param).is_some() {
                                *value = to_value(&hashmap[&param]).unwrap();
                            }
                        }
                    });
            } else {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|value| {
                        let param: &str = value.as_str().unwrap();

                        if hashmap.get(&param).is_some() {
                            *value = to_value(&hashmap[&param]).unwrap();
                        }
                    });
            }
        }
    });

    const PREFIX: &str =
        "// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =";

    write(
        format!("{}/plugins.js", &output_path),
        format!("{}\n{}", PREFIX, &to_string(&json).unwrap()),
    )
    .unwrap();
    println!("Записан файл plugins.js");
}

fn main() {
    let start_time: Instant = Instant::now();

    let dir_paths: Paths = Paths {
        original: String::from("../original"),
        output: String::from("./data"),
        maps: String::from("../translation/maps/maps.txt"),
        maps_trans: String::from("../translation/maps/maps_trans.txt"),
        names: String::from("../translation/maps/names.txt"),
        names_trans: String::from("../translation/maps/names_trans.txt"),
        other: String::from("../translation/other"),
        plugins: String::from("../translation/plugins"),
        plugins_output: String::from("./js"),
    };

    create_dir_all(&dir_paths.output).unwrap();
    create_dir_all(&dir_paths.plugins_output).unwrap();

    let mut maps_hashmap = read_dir(&dir_paths.original)
        .unwrap()
        .par_bridge()
        .fold(
            || HashMap::new(),
            |mut hashmap, path| {
                let filename: String = path
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_str()
                    .unwrap()
                    .to_string();

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
            || HashMap::new(),
            |mut a, b| {
                a.extend(b);
                a
            },
        );

    const PREFIXES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];

    let mut other_hashmap: HashMap<String, Value> = read_dir(&dir_paths.original)
        .unwrap()
        .par_bridge()
        .fold(
            || HashMap::new(),
            |mut hashmap, path| {
                let filename: String = path
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_str()
                    .unwrap()
                    .to_string();

                if !PREFIXES.iter().any(|x| filename.starts_with(x)) {
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
            || HashMap::new(),
            |mut a, b| {
                a.extend(b);
                a
            },
        );

    let mut system_json: Value =
        from_str(&read_to_string(&format!("{}/System.json", &dir_paths.original)).unwrap())
            .unwrap();

    let mut plugins_json: Vec<Value> =
        from_str(&read_to_string(&format!("{}/plugins.json", &dir_paths.plugins)).unwrap())
            .unwrap();

    let maps_original_text_vec: Vec<String> = read_to_string(&dir_paths.maps)
        .unwrap()
        .split("\n")
        .map(|x| x.to_string().replace("\\n[", "\\N[").replace("\\n", "\n"))
        .collect();

    let maps_translated_text_vec: Vec<String> = read_to_string(&dir_paths.maps_trans)
        .unwrap()
        .split("\n")
        .map(|x| x.to_string().replace("\\n", "\n").trim().to_string())
        .collect();

    let maps_original_names_vec: Vec<String> = read_to_string(&dir_paths.names)
        .unwrap()
        .split("\n")
        .map(|x| x.to_string().replace("\\n[", "\\N[").replace("\\n", "\n"))
        .collect();

    let maps_translated_names_vec: Vec<String> = read_to_string(&dir_paths.names_trans)
        .unwrap()
        .split("\n")
        .map(|x| x.to_string().replace("\\n", "\n").trim().to_string())
        .collect();

    let system_original_text: Vec<String> =
        read_to_string(format!("{}/System.txt", &dir_paths.other))
            .unwrap()
            .split("\n")
            .map(|x| x.to_string())
            .collect();

    let system_translated_text: Vec<String> =
        read_to_string(format!("{}/System_trans.txt", &dir_paths.other))
            .unwrap()
            .split("\n")
            .map(|x| x.to_string())
            .collect();

    let system_text_hashmap: HashMap<&str, &str> = system_original_text
        .iter()
        .zip(system_translated_text.iter())
        .par_bridge()
        .fold(
            || HashMap::new(),
            |mut hashmap, (key, value)| {
                hashmap.insert(key.as_str(), value.as_str());
                hashmap
            },
        )
        .reduce(
            || HashMap::new(),
            |mut a, b| {
                a.extend(b);
                a
            },
        );

    let plugins_original_text_vec: Vec<String> =
        read_to_string(format!("{}/plugins.txt", &dir_paths.plugins))
            .unwrap()
            .split("\n")
            .map(|x| x.to_string())
            .collect();

    let plugins_translated_text_vec: Vec<String> =
        read_to_string(format!("{}/plugins_trans.txt", &dir_paths.plugins))
            .unwrap()
            .split("\n")
            .map(|x| x.to_string())
            .collect();

    write_maps(
        &mut maps_hashmap,
        &dir_paths.output,
        &maps_original_text_vec,
        &maps_translated_text_vec,
        &maps_original_names_vec,
        &maps_translated_names_vec,
    );

    drop(maps_hashmap);
    drop(maps_original_text_vec);
    drop(maps_translated_text_vec);
    drop(maps_original_names_vec);
    drop(maps_translated_names_vec);

    write_other(&mut other_hashmap, &dir_paths.output, &dir_paths.other);

    drop(other_hashmap);

    write_system(&mut system_json, &dir_paths.output, &system_text_hashmap);

    drop(system_json);

    write_plugins(
        &mut plugins_json,
        &dir_paths.plugins_output,
        &plugins_original_text_vec,
        &plugins_translated_text_vec,
    );

    drop(plugins_json);
    drop(plugins_original_text_vec);
    drop(plugins_translated_text_vec);
    drop(dir_paths);

    println!(
        "Потрачено {} секунд",
        Instant::now().duration_since(start_time).as_secs_f64()
    );
    println!("Все файлы записаны успешно.");
}
