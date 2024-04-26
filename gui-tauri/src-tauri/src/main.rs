#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use git2::build::RepoBuilder;
use git2::{FetchOptions, Progress, RemoteCallbacks};
use std::path::PathBuf;
use tauri::{generate_context, App, AppHandle, Builder, Event, EventHandler, Manager, Window};
mod writer;

fn spawn_compiler(handle: AppHandle, resource_path: PathBuf) {
    let window: Window = handle.get_window("main").unwrap();

    window.to_owned().listen("compile", move |_event: Event| {
        let result: String = writer::main(resource_path.to_str().unwrap());
        window.emit("compile", result).unwrap();
    });
}

fn clone_repository(handle: AppHandle, clone_path: PathBuf) {
    let window: Window = handle.get_window("main").unwrap();
    let window_clone: Window = window.clone();

    let unlisten_clone: EventHandler =
        window_clone
            .to_owned()
            .listen("clone_repository", move |_event: Event| {
                let mut cb: RemoteCallbacks<'_> = RemoteCallbacks::new();
                cb.transfer_progress(|stats: Progress<'_>| {
                    let progress: usize = stats.received_bytes() / 1024;
                    window_clone.emit("progress", progress).unwrap();
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

                window_clone.emit("progress", "ended").unwrap();
            });

    window.unlisten(unlisten_clone);
}

fn main() {
    Builder::default()
        .setup(|app: &mut App| {
            let handle: AppHandle = app.handle();
            let main_window: Window = app.get_window("main").unwrap();
            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
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
