use rayon::prelude::*;
use serde_json::{from_str, to_string, to_value, Value, Value::Array};
use std::collections::{HashMap, HashSet};
use std::env::args;
use std::fs::{create_dir_all, read_dir, read_to_string, write};
use std::process::exit;
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
            if event.is_null() || event["pages"].is_null() {
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
            if !element["pages"].is_null() {
                element["pages"]
                    .as_array_mut()
                    .unwrap()
                    .par_iter_mut()
                    .for_each(|page: &mut Value| {
                        page["list"] = Array(merge_401(page["list"].as_array().unwrap().to_vec()));
                    });
            } else if !element["list"].is_null() {
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
            let output_path: String = format!("{}/{}", output_dir, f);

            if !file["displayName"].is_null() {
                let location_name: &str = file["displayName"].as_str().unwrap();

                if names_hashmap.get(location_name).is_some() {
                    file["displayName"] = to_value(names_hashmap[location_name]).unwrap();
                }
            }

            file["events"]
                .as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|event: &mut Value| {
                    if event["pages"].is_null() {
                        return;
                    }

                    event["pages"]
                        .as_array_mut()
                        .unwrap()
                        .par_iter_mut()
                        .for_each(|page: &mut Value| {
                            if page["list"].is_null() {
                                return;
                            }

                            page["list"]
                                .as_array_mut()
                                .unwrap()
                                .par_iter_mut()
                                .for_each(|item: &mut Value| {
                                    if item["parameters"].is_null()
                                        || item["parameters"].as_array().is_none()
                                    {
                                        return;
                                    }

                                    let code: u16 = item["code"].as_u64().unwrap() as u16;

                                    item["parameters"]
                                        .as_array_mut()
                                        .unwrap()
                                        .par_iter_mut()
                                        .for_each(|parameter: &mut Value| {
                                            let mut parameter_text: Option<String> = None;

                                            if parameter.is_string() {
                                                parameter_text = Some(
                                                    parameter
                                                        .as_str()
                                                        .unwrap()
                                                        .replace("\\n[", "\\N["),
                                                );
                                            }

                                            match parameter_text {
                                                None => {
                                                    if code == 102 && parameter.is_array() {
                                                        parameter
                                                            .as_array_mut()
                                                            .unwrap()
                                                            .par_iter_mut()
                                                            .for_each(|param: &mut Value| {
                                                                if param.is_string() {
                                                                    let param_text: String = param
                                                                        .as_str()
                                                                        .unwrap()
                                                                        .replace("\\n[", "\\N[");

                                                                    if text_hashmap
                                                                        .get(param_text.as_str())
                                                                        .is_some()
                                                                    {
                                                                        *param = to_value(
                                                                            text_hashmap
                                                                                [param_text
                                                                                    .as_str()],
                                                                        )
                                                                        .unwrap();
                                                                    }
                                                                }
                                                            });
                                                    }
                                                }
                                                Some(_) => {
                                                    if (code == 401
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
                                                                        .ends_with("????")))))
                                                        && text_hashmap
                                                            .get(
                                                                parameter_text
                                                                    .as_ref()
                                                                    .unwrap()
                                                                    .as_str(),
                                                            )
                                                            .is_some()
                                                    {
                                                        *parameter = to_value(
                                                            text_hashmap
                                                                [parameter_text.unwrap().as_str()],
                                                        )
                                                        .unwrap();
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

            let output_path: String = format!("{}/{}", output_dir, f);

            file.as_array_mut()
                .unwrap()
                .par_iter_mut()
                .for_each(|element: &mut Value| {
                    if element.is_null() {
                        return;
                    }

                    if element["pages"].is_null() {
                        if element["list"].is_null() {
                            const ATTRS: [&str; 3] = ["name", "description", "note"];

                            element
                                .as_object_mut()
                                .unwrap()
                                .iter_mut()
                                .par_bridge()
                                .for_each_with(ATTRS, |attrs, (key, value)| {
                                    if !attrs.contains(&key.as_str()) {
                                        return;
                                    }

                                    if !value.is_null()
                                        && !value.as_str().unwrap().is_empty()
                                        && hashmap.get(value.as_str().unwrap()).is_some()
                                    {
                                        *value =
                                            to_value(hashmap[value.as_str().unwrap()]).unwrap();
                                    }
                                });
                        } else {
                            let name: &str = element["name"].as_str().unwrap();

                            if !name.is_empty() && hashmap.get(name).is_some() {
                                element["name"] = to_value(hashmap[name]).unwrap();
                            }
                        }
                    }

                    let pages_length: usize = if !element["pages"].is_null() {
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

                        if iterable_object.is_null() {
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
                                    .iter_mut()
                                    .for_each(|parameter: &mut Value| {
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
                                                        .for_each(|param: &mut Value| {
                                                            if param.is_string() {
                                                                let param_text: String = param
                                                                    .as_str()
                                                                    .unwrap()
                                                                    .replace("\\n[", "\\N[");

                                                                if hashmap
                                                                    .get(param_text.as_str())
                                                                    .is_some()
                                                                {
                                                                    *param = to_value(
                                                                        hashmap
                                                                            [param_text.as_str()],
                                                                    )
                                                                    .unwrap();
                                                                }
                                                            }
                                                        });
                                                }
                                            }
                                            Some(_) => {
                                                if (code == 401
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
                                                                    .ends_with("????")))))
                                                    && hashmap
                                                        .get(parameter_text.as_ref().unwrap())
                                                        .is_some()
                                                {
                                                    *parameter =
                                                        to_value(hashmap[parameter_text.unwrap()])
                                                            .unwrap();
                                                }
                                            }
                                        }
                                    });
                            });
                    }
                });
            write(output_path, file.to_string()).unwrap();
            println!("Записан файл {}", f);
        });
}

fn write_system(mut json: Value, output_path: &str, system_text_hashmap: HashMap<&str, &str>) {
    json["equipTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if !element.is_null() && system_text_hashmap.get(element.as_str().unwrap()).is_some() {
                *element = to_value(system_text_hashmap[element.as_str().unwrap()]).unwrap();
            }
        });

    json["skillTypes"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if !element.is_null() && system_text_hashmap.get(element.as_str().unwrap()).is_some() {
                *element = to_value(system_text_hashmap[element.as_str().unwrap()]).unwrap();
            }
        });

    json["variables"]
        .as_array_mut()
        .unwrap()
        .par_iter_mut()
        .for_each(|element: &mut Value| {
            if element.as_str().unwrap().ends_with("phobia") {
                if system_text_hashmap.get(element.as_str().unwrap()).is_some() {
                    *element = to_value(system_text_hashmap[element.as_str().unwrap()]).unwrap();
                }

                if element.as_str().unwrap().starts_with("Pan") {}
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
                        if !string.is_null()
                            && system_text_hashmap.get(string.as_str().unwrap()).is_some()
                        {
                            *string =
                                to_value(system_text_hashmap[string.as_str().unwrap()]).unwrap();
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
                    .for_each(|message_value: &mut Value| {
                        if !message_value.is_null()
                            && system_text_hashmap
                                .get(message_value.as_str().unwrap())
                                .is_some()
                        {
                            *message_value =
                                to_value(system_text_hashmap[message_value.as_str().unwrap()])
                                    .unwrap();
                        }
                    });
            }
        });

    write(
        format!("{}/System.json", output_path),
        to_string(&json).unwrap(),
    )
    .unwrap();
    println!("Записан файл System.json");
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
                    .for_each(|(key, value): (&String, &mut Value)| {
                        if key == "OptionsCategories" {
                            let mut param: String = value.as_str().unwrap().to_string();

                            for (text, translated_text) in
                                original_text_vec.iter().zip(translated_text_vec.iter())
                            {
                                param = param.replacen(text, translated_text.as_str(), 1);
                            }

                            *value = to_value(param).unwrap();
                        } else {
                            let param: &str = value.as_str().unwrap();

                            if hashmap.get(param).is_some() {
                                *value = to_value(hashmap[param]).unwrap();
                            }
                        }
                    });
            } else {
                obj["parameters"]
                    .as_object_mut()
                    .unwrap()
                    .values_mut()
                    .par_bridge()
                    .for_each(|value: &mut Value| {
                        let param: &str = value.as_str().unwrap();

                        if hashmap.get(param).is_some() {
                            *value = to_value(hashmap[param]).unwrap();
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
    println!("Записан файл plugins.js");
}

fn handle_args(args: Vec<String>) -> (bool, bool, bool, bool) {
    let mut to_write: (bool, bool, bool, bool) = (true, true, true, true);

    if args.len() >= 2 {
        if args[1] == "-h" || args[1] == "--help" {
            println!("\nДанный CLI инструмент записывает .txt файлы перевода в .json файлы игры.\nИспользование:\njson-writer [-h|--help] [-no={{maps,other,system,plugins}}\n\nЕсли аргументы не переданы, программа запишет все файлы.\n\n-h, --help: Выводит эту справку и завершает работу.\n\n-no={{maps,other,system,plugins}}: В зависимости от слов, которые переданы в аргумент -no, будет отключена запись тех или иных файлов.\nПример: -no=maps,other - программа не будет записывать файлы maps и other.");
            exit(0);
        } else if args[1].starts_with("-no=") {
            for arg in args[1][4..].split(',') {
                match arg {
                    "maps" => to_write.0 = false,
                    "other" => to_write.1 = false,
                    "system" => to_write.2 = false,
                    "plugins" => to_write.3 = false,
                    _ => {
                        println!("\nНеверные значения аргумента -no.\nДопустимые значения: maps, other, system, plugins.");
                        exit(1);
                    }
                }
            }
        }
    }

    to_write
}

fn main() {
    let start_time: Instant = Instant::now();

    let args: Vec<String> = args().collect();
    let to_write: (bool, bool, bool, bool) = handle_args(args);

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

    if to_write.0 {
        let maps_hashmap: HashMap<String, Value> = read_dir(dir_paths.original)
            .unwrap()
            .par_bridge()
            .fold(HashMap::new, |mut hashmap: HashMap<String, Value>, path| {
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
            })
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
    }

    if to_write.1 {
        const PREFIXES: [&str; 5] = ["Map", "Tilesets", "Animations", "States", "System"];

        let other_hashmap: HashMap<String, Value> = read_dir(dir_paths.original)
            .unwrap()
            .par_bridge()
            .fold(HashMap::new, |mut hashmap: HashMap<String, Value>, path| {
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
            })
            .reduce(
                HashMap::new,
                |mut a: HashMap<String, Value>, b: HashMap<String, Value>| {
                    a.extend(b);
                    a
                },
            );

        write_other(other_hashmap, dir_paths.output, dir_paths.other);
    }

    if to_write.2 {
        let system_json: Value =
            from_str(&read_to_string(format!("{}/System.json", dir_paths.original)).unwrap())
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

        write_system(system_json, dir_paths.output, system_text_hashmap);
    }

    if to_write.3 {
        let plugins_json: Vec<Value> =
            from_str(&read_to_string(format!("{}/plugins.json", dir_paths.plugins)).unwrap())
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

        write_plugins(
            plugins_json,
            dir_paths.plugins_output,
            plugins_original_text_vec,
            plugins_translated_text_vec,
        );
    }

    println!(
        "Все файлы записаны успешно.\nПотрачено {} секунд.",
        Instant::now().duration_since(start_time).as_secs_f64()
    );
}
