import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./db";

async function getApiKey(): Promise<string | null> {
  try {
    const d = await getDb();
    const rows = await d.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = 'claude_api_key'"
    );
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

export async function saveApiKey(key: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('claude_api_key', $1)",
    [key]
  );
}

export async function extractTodosFromImage(
  imagePath: string
): Promise<{ todos: string[]; method: string }> {
  const apiKey = await getApiKey();
  if (apiKey) {
    try {
      const todos = await invoke<string[]>("extract_todos_claude", {
        imagePath,
        apiKey,
      });
      return { todos, method: "claude" };
    } catch (e) {
      console.warn("Claude API failed, falling back to Vision:", e);
    }
  }

  const lines = await invoke<string[]>("extract_text_vision", { imagePath });
  return { todos: lines, method: "vision" };
}

/** Save pasted image to temp file and run OCR */
export async function extractTodosFromClipboard(
  imageBytes: Uint8Array
): Promise<{ todos: string[]; method: string }> {
  // Convert to base64 for reliable transfer to Rust
  let binary = "";
  for (let i = 0; i < imageBytes.length; i++) {
    binary += String.fromCharCode(imageBytes[i]);
  }
  const imageB64 = btoa(binary);

  const imagePath = await invoke<string>("save_clipboard_image", { imageB64 });
  return extractTodosFromImage(imagePath);
}
