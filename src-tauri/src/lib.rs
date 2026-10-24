#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;

/// Результат операции с файлом.
#[derive(Serialize)]
struct OpResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl OpResult {
    fn ok(path: String) -> Self {
        Self { ok: true, path: Some(path), error: None }
    }
    fn err(e: String) -> Self {
        Self { ok: false, path: None, error: Some(e) }
    }
}

/// Валидация пути: без `..`, без абсолютных путей, без не-UTF-8.
/// Путь трактуется относительно приватной директории данных приложения.
fn validate_rel_path(p: &str) -> Result<PathBuf, String> {
    let path = Path::new(p);
    if path.is_absolute() {
        return Err("абсолютные пути запрещены".into());
    }
    let mut has_component = false;
    for c in path.components() {
        match c {
            Component::Normal(_) => has_component = true,
            Component::CurDir => {}
            _ => return Err("путь содержит запрещённые компоненты (.., /, корень)".into()),
        }
    }
    if !has_component {
        return Err("пустой путь".into());
    }
    Ok(path.to_path_buf())
}

/// Резолв пути внутри приватной AppData-директории приложения.
fn resolve_in_app_data(app: &tauri::AppHandle, rel: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("нет app_data_dir: {e}"))?;
    let full = base.join(validate_rel_path(rel)?);
    // Финальная проверка: итоговый путь обязан лежать внутри base
    let canonical_base = base.canonicalize().map_err(|e| e.to_string())?;
    if let Some(parent) = full.parent() {
        let _ = fs::create_dir_all(parent);
    }
    // full может ещё не существовать — канонизируем ближайшего существующего родителя
    let mut probe = full.clone();
    let mut to_canon = Vec::new();
    while !probe.exists() {
        to_canon.push(probe.clone());
        if !probe.pop() {
            return Err("не удалось канонизировать путь".into());
        }
    }
    let canon = probe.canonicalize().map_err(|e| e.to_string())?;
    if !canon.starts_with(&canonical_base) {
        return Err("путь выходит за пределы директории приложения".into());
    }
    for p in to_canon.iter().rev() {
        let c = p.canonicalize().map_err(|e| e.to_string())?;
        if !c.starts_with(&canonical_base) {
            return Err("путь выходит за пределы директории приложения".into());
        }
    }
    Ok(full)
}

/// Прочитать текстовый файл из AppData приложения (песочница).
#[tauri::command]
fn read_data_file(app: tauri::AppHandle, rel_path: String) -> Result<String, String> {
    let full = resolve_in_app_data(&app, &rel_path)?;
    fs::read_to_string(&full).map_err(|e| format!("read: {e}"))
}

/// Записать текстовый файл в AppData приложения (песочница).
#[tauri::command]
fn write_data_file(app: tauri::AppHandle, rel_path: String, contents: String) -> OpResult {
    match resolve_in_app_data(&app, &rel_path) {
        Ok(full) => match fs::File::create(&full) {
            Ok(mut f) => match f.write_all(contents.as_bytes()) {
                Ok(_) => OpResult::ok(full.to_string_lossy().into_owned()),
                Err(e) => OpResult::err(format!("write: {e}")),
            },
            Err(e) => OpResult::err(format!("create: {e}")),
        },
        Err(e) => OpResult::err(e),
    }
}

/// Удалить файл из AppData приложения (песочница).
#[tauri::command]
fn delete_data_file(app: tauri::AppHandle, rel_path: String) -> OpResult {
    match resolve_in_app_data(&app, &rel_path) {
        Ok(full) => match fs::remove_file(&full) {
            Ok(_) => OpResult::ok(full.to_string_lossy().into_owned()),
            Err(e) => OpResult::err(format!("remove: {e}")),
        },
        Err(e) => OpResult::err(e),
    }
}

/// Список файлов в подпапке AppData (нерекурсивный, только имена).
#[tauri::command]
fn list_data_files(app: tauri::AppHandle, rel_dir: String) -> Result<Vec<String>, String> {
    let dir = resolve_in_app_data(&app, &rel_dir)?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| format!("readdir: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_file() {
            out.push(entry.file_name().to_string_lossy().into_owned());
        }
    }
    out.sort();
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Workaround: webkit2gtk падает с «Error 71 (Protocol error)» на некоторых
    // Wayland-композиторах. Отключаем DMA-BUF compositing (проверено: убирает
    // и protocol error, и «Failed to create GBM buffer»). На Windows игнорируется.
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    if std::env::var("GDK_BACKEND").is_err() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_data_file,
            write_data_file,
            delete_data_file,
            list_data_files
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска nd-true-journal");
}
