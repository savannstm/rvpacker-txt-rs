#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use git2::build::RepoBuilder;
use git2::{FetchOptions, Progress, RemoteCallbacks};
use regex::{escape, Regex};
use std::path::PathBuf;
use tauri::{generate_context, App, AppHandle, Builder, Event, Manager};
mod writer;

#[tauri::command]
fn create_regex(text: String) -> String {
    let escaped_text = escape(&text);
    let re = Regex::new(&escaped_text);

    if let Ok(re) = re {
        re.to_string()
    } else {
        String::new()
    }
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![create_regex])
        .setup(|app: &mut App| {
            let handle: AppHandle = app.handle();

            #[cfg(debug_assertions)]
            {
                app.get_window("main").unwrap().open_devtools();
            }

            let path_to_clone: PathBuf =
                handle.path_resolver().resolve_resource("res/repo").unwrap();

            let path_to_resource: PathBuf = handle.path_resolver().resolve_resource("res").unwrap();

            let handle_clone: AppHandle = handle.clone();
            handle_clone
                .get_window("main")
                .unwrap()
                .listen("clone", move |event: Event| {
                    let mut cb: RemoteCallbacks<'_> = RemoteCallbacks::new();
                    cb.transfer_progress(|stats: Progress<'_>| {
                        let progress: usize = stats.received_bytes() / 1024;
                        (handle_clone)
                            .get_window("main")
                            .unwrap()
                            .emit("progress", progress)
                            .unwrap();
                        true
                    });

                    let mut fo: FetchOptions<'_> = FetchOptions::new();
                    fo.remote_callbacks(cb);

                    RepoBuilder::new()
                        .fetch_options(fo)
                        .clone(
                            "https://github.com/savannstm/fh-termina-json-writer",
                            path_to_clone.as_path(),
                        )
                        .unwrap();

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
                    let result: String = writer::main(path_to_resource.to_str().unwrap());

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
