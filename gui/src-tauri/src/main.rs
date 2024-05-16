#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::escape;
use std::io::Cursor;
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::{generate_context, App, AppHandle, Builder, Event, Manager};
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

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![unescape_text])
        .setup(|app: &mut App| {
            let handle: AppHandle = app.handle();

            #[cfg(debug_assertions)]
            {
                app.get_window("main").unwrap().open_devtools();
            }

            let handle_clone: AppHandle = handle.clone();
            handle_clone
                .get_window("main")
                .unwrap()
                .listen("download_repo", move |event: Event| {
                    let output_path: String = format!("{}/res", handle_clone.path_resolver().resource_dir().unwrap().to_str().unwrap().replace('\\', "/"));

                    let program: &str;
                    let arg: String;

                    if std::env::consts::OS == "windows" {
                        program = "powershell";
                        arg = format!("cd {}; iwr https://github.com/savannstm/fh-termina-json-writer/archive/refs/heads/main.zip -OutFile main.zip", output_path);
                    } else {
                        program = "sh";
                        arg = format!("cd {}; wget https://github.com/savannstm/fh-termina-json-writer/archive/refs/heads/main.zip -O main.zip", output_path);
                    }

                    Command::new(program).arg(arg).stdout(Stdio::null()).spawn().unwrap().wait().unwrap();

                    let zip_file_bytes: Vec<u8> = std::fs::read(format!("{}/main.zip", output_path)).unwrap();
                    extract(Cursor::new(&zip_file_bytes), Path::new(&format!("{}/main", output_path)), false).unwrap();

                    handle_clone
                        .get_window("main")
                        .unwrap()
                        .emit("progress", "ended")
                        .unwrap();

                    handle_clone
                        .get_window("main")
                        .unwrap()
                        .unlisten(event.id());
                });

            handle
                .get_window("main")
                .unwrap()
                .listen("compile", move |_event: Event| {
                    let result: String = writer::main(
                        handle
                            .path_resolver()
                            .resource_dir()
                            .unwrap()
                            .to_str()
                            .unwrap()
                            .replace('\\', "/")
                            .as_str(),
                    );

                    handle
                        .get_window("main")
                        .unwrap()
                        .emit("compile-finished", result)
                        .unwrap();
                });

            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
