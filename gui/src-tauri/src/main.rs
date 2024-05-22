#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::escape;
use std::fs::remove_file;
use std::io::Cursor;
use std::path::Path;
use tauri::{generate_context, App, Builder, Event, Manager};
use zip_extract::extract;
mod writer;

#[tauri::command]
fn unescape_text(text: String, option: String) -> String {
    let re: String = match option.as_str() {
        "regex" => text,
        "whole" => format!("\\b{}\\b", &escape(&text)),
        "none" => escape(&text),
        _ => String::new(),
    };

    re
}

#[tauri::command]
fn unzip(path: &str, dest: &str) {
    let bytes: Vec<u8> = std::fs::read(path).unwrap();
    extract(Cursor::new(bytes), Path::new(dest), false).unwrap();
    remove_file(path).unwrap();
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![unescape_text, unzip])
        .setup(|app: &mut App| {
            let main_window: tauri::Window = app.get_window("main").unwrap();
            let resource_path: String = app
                .path_resolver()
                .resource_dir()
                .unwrap()
                .to_str()
                .unwrap()
                .replace('\\', "/");

            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
            }

            app.get_window("main")
                .unwrap()
                .listen("compile", move |_event: Event| {
                    let result: String =
                        writer::main(&resource_path, tauri::api::os::locale().unwrap().as_str());
                    main_window.emit("compile-finished", result).unwrap();
                });

            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
