import { useState, useEffect } from "react";
import { saveApiKey } from "../lib/ocr";
import { getDb } from "../lib/db";

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getDb();
        const rows = await d.select<{ value: string }[]>(
          "SELECT value FROM settings WHERE key = 'claude_api_key'"
        );
        if (rows.length > 0) setApiKey(rows[0].value);
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    await saveApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-panel">
      <div className="screenshot-header">
        <span>Settings</span>
        <button className="screenshot-close" onClick={onClose}>&#xd7;</button>
      </div>
      <div className="settings-body">
        <label className="settings-label">Claude API Key</label>
        <div className="settings-row">
          <input
            type="password"
            className="settings-input"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className="btn-primary btn-sm" onClick={handleSave}>
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
        <p className="settings-hint">
          Used for screenshot AI extraction. Get a key at anthropic.com
        </p>
      </div>
    </div>
  );
}
