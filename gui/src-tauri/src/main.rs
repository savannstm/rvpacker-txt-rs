#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::escape;
use std::path::PathBuf;
use tauri::{api::os::locale, generate_context, App, Builder, Event, Manager};
mod writer;

#[tauri::command]
fn escape_text(text: String) -> String {
    escape(&text)
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![escape_text])
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
                        locale().unwrap().as_str(),
                    );

                    main_window.emit("compile-finished", "").unwrap();
                });

            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
