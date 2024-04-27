#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use git2::build::RepoBuilder;
use git2::{FetchOptions, Progress, RemoteCallbacks};
use std::path::PathBuf;
use tauri::{generate_context, App, AppHandle, Builder, Event, Manager};
mod writer;

fn spawn_compiler(handle: AppHandle, resource_path: PathBuf) {
    handle
        .get_window("main")
        .unwrap()
        .listen("compile", move |_event: Event| {
            let result: String = writer::main(resource_path.to_str().unwrap());

            handle
                .get_window("main")
                .unwrap()
                .emit("compile-finished", result)
                .unwrap();
        });
}

fn clone_repository(handle: AppHandle, clone_path: PathBuf) {
    handle
        .get_window("main")
        .unwrap()
        .listen("clone", move |event: Event| {
            let mut cb: RemoteCallbacks<'_> = RemoteCallbacks::new();
            cb.transfer_progress(|stats: Progress<'_>| {
                let progress: usize = stats.received_bytes() / 1024;
                handle
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
                    clone_path.as_path(),
                )
                .unwrap();

            handle
                .get_window("main")
                .unwrap()
                .emit("progress", "ended")
                .unwrap();

            handle.get_window("main").unwrap().unlisten(event.id());
        });
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .setup(|app: &mut App| {
            let handle: AppHandle = app.handle();
            #[cfg(debug_assertions)]
            {
                app.get_window("main").unwrap().open_devtools();
            }

            let path_to_clone: PathBuf =
                handle.path_resolver().resolve_resource("res/repo").unwrap();

            clone_repository(handle.clone(), path_to_clone);

            let path_to_resource: PathBuf = handle.path_resolver().resolve_resource("res").unwrap();

            spawn_compiler(handle, path_to_resource);

            Ok(())
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
