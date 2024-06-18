#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::escape;
use std::io::Cursor;
use std::path::Path;
use std::{fs::remove_file, path::PathBuf};
use tauri::{generate_context, App, Builder, Event, Manager};
use zip_extract::extract;
mod writer;

#[tauri::command]
fn escape_text(text: String) -> String {
    escape(&text)
}

#[tauri::command]
fn unzip(path: &str, dest: &str) {
    let bytes: Vec<u8> = std::fs::read(path).unwrap();
    extract(Cursor::new(bytes), Path::new(dest), false).unwrap();
    remove_file(path).unwrap();
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![escape_text, unzip])
        .setup(|app: &mut App| {
            let main_window: tauri::Window = app.get_window("main").unwrap();
            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
            }

            app.get_window("main")
                .unwrap()
                .listen("compile", move |event: Event| {
                    writer::main(
                        PathBuf::from(event.payload().unwrap().replace('"', "")),
                        tauri::api::os::locale().unwrap().as_str(),
                    );

                    main_window.emit("compile-finished", "").unwrap();
                });

            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
