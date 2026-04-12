use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Save base64-encoded image (from clipboard paste) to a temp file, return the path
#[tauri::command]
pub async fn save_clipboard_image(image_b64: String) -> Result<String, String> {
    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&image_b64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    let tmp_dir = std::env::temp_dir();
    let file_path = tmp_dir.join("todo-menubar-clipboard.png");
    std::fs::write(&file_path, &image_data)
        .map_err(|e| format!("Failed to save clipboard image: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

/// Save an image attached to a todo description. Persists to app data dir with unique name.
#[tauri::command]
pub async fn save_todo_image(
    app_handle: tauri::AppHandle,
    image_b64: String,
    todo_id: i64,
) -> Result<String, String> {
    use tauri::Manager;
    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&image_b64)
        .map_err(|e| format!("Failed to decode: {}", e))?;

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {}", e))?;
    let img_dir = app_dir.join("images");
    std::fs::create_dir_all(&img_dir).ok();

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let filename = format!("todo-{}-{}.png", todo_id, ts);
    let file_path = img_dir.join(&filename);
    std::fs::write(&file_path, &image_data)
        .map_err(|e| format!("Failed to save: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[derive(Serialize)]
struct ClaudeMessage {
    role: String,
    content: Vec<ClaudeContent>,
}

#[derive(Serialize)]
#[serde(tag = "type")]
enum ClaudeContent {
    #[serde(rename = "image")]
    Image {
        source: ImageSource,
    },
    #[serde(rename = "text")]
    Text {
        text: String,
    },
}

#[derive(Serialize)]
struct ImageSource {
    #[serde(rename = "type")]
    source_type: String,
    media_type: String,
    data: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeResponseContent>,
}

#[derive(Deserialize)]
struct ClaudeResponseContent {
    text: Option<String>,
}

fn detect_media_type(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "heic" => "image/heic",
        _ => "image/png",
    }
    .to_string()
}

/// Extract todos from image using Claude API
#[tauri::command]
pub async fn extract_todos_claude(
    image_path: String,
    api_key: String,
) -> Result<Vec<String>, String> {
    let image_data = std::fs::read(&image_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&image_data);
    let media_type = detect_media_type(&image_path);

    let request = ClaudeRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens: 1024,
        messages: vec![ClaudeMessage {
            role: "user".to_string(),
            content: vec![
                ClaudeContent::Image {
                    source: ImageSource {
                        source_type: "base64".to_string(),
                        media_type,
                        data: b64,
                    },
                },
                ClaudeContent::Text {
                    text: "Extract all to-do items, tasks, or action items from this image. Return ONLY a JSON array of strings, each string being one task. Example: [\"Task 1\", \"Task 2\"]. If no tasks found, return [].".to_string(),
                },
            ],
        }],
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }

    let claude_resp: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let text = claude_resp
        .content
        .first()
        .and_then(|c| c.text.as_ref())
        .ok_or("No text in response")?;

    // Parse JSON array from response (handle markdown code blocks)
    let cleaned = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let todos: Vec<String> =
        serde_json::from_str(cleaned).map_err(|e| format!("Failed to parse todos: {} - raw: {}", e, text))?;

    Ok(todos)
}

/// Extract text from image using macOS Apple Vision framework
#[tauri::command]
pub async fn extract_text_vision(image_path: String) -> Result<Vec<String>, String> {
    // Bug 5 fix: pass path as CLI argument, not string interpolation
    let swift_code = r#"
import Vision
import AppKit

let path = CommandLine.arguments.last!
guard let image = NSImage(contentsOfFile: path),
      let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let cgImage = bitmap.cgImage else {
    fputs("ERROR: Cannot load image\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en"]
let handler = VNImageRequestHandler(cgImage: cgImage)
try handler.perform([request])

guard let observations = request.results else { exit(0) }
for observation in observations {
    if let text = observation.topCandidates(1).first?.string {
        print(text)
    }
}
"#;

    let output = std::process::Command::new("swift")
        .arg("-e")
        .arg(swift_code)
        .arg(&image_path)
        .output()
        .map_err(|e| format!("Vision OCR failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Vision OCR error: {}", stderr));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<String> = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(lines)
}
