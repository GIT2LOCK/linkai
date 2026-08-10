use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command]
fn invoke_backend(action: String, payload: Value) -> Result<Value, String> {
    let project_root = find_project_root().ok_or_else(|| {
        String::from("Nao foi possivel localizar a raiz do projeto LinkAI.")
    })?;
    let script_path = project_root.join("backend").join("api").join("desktop_bridge.py");

    if !script_path.is_file() {
        return Err(format!(
            "Bridge Python nao encontrado: {}",
            script_path.display()
        ));
    }

    let python = find_python(&project_root);
    let payload_text = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let output = Command::new(python)
        .arg(script_path)
        .arg(action)
        .arg(payload_text)
        .current_dir(&project_root)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim()).map_err(|error| error.to_string())
}

fn find_project_root() -> Option<PathBuf> {
    let mut current = std::env::current_dir().ok()?;

    loop {
        if current.join("backend").join("api").join("desktop_bridge.py").is_file() {
            return Some(current);
        }

        if !current.pop() {
            break;
        }
    }

    None
}

fn find_python(project_root: &Path) -> PathBuf {
    if let Ok(value) = std::env::var("LINKAI_PYTHON") {
        let path = PathBuf::from(value);

        if path.is_file() {
            return path;
        }
    }

    let venv_python = project_root
        .join("lumina_bot")
        .join(".venv")
        .join("Scripts")
        .join("python.exe");

    if venv_python.is_file() {
        return venv_python;
    }

    PathBuf::from("python")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![invoke_backend])
        .run(tauri::generate_context!())
        .expect("error while running LinkAI");
}
