mod command;
mod ocr;
mod tray;

use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#007AFF',
                icon TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                completed INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
                due_date TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#FF9500'
            );
            CREATE TABLE IF NOT EXISTS todo_tags (
                todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (todo_id, tag_id)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT INTO projects (name, color, icon, position) VALUES ('Inbox', '#007AFF', '📥', 0);
        ",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "add_completed_at",
        sql: "
            ALTER TABLE todos ADD COLUMN completed_at TEXT;
            UPDATE todos SET completed_at = updated_at WHERE completed = 1;
        ",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "add_archived",
        sql: "
            ALTER TABLE todos ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
        ",
        kind: MigrationKind::Up,
    }];

    // Cmd+Shift+T to toggle panel
    let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            command::init_menubar_panel,
            command::show_menubar_panel,
            ocr::extract_todos_claude,
            ocr::extract_text_vision,
            ocr::save_clipboard_image,
            ocr::save_todo_image,
        ])
        .plugin(tauri_nspanel::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:todos.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app_handle, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        use tauri_nspanel::ManagerExt;
                        if let Ok(panel) = app_handle.get_webview_panel("main") {
                            if panel.is_visible() {
                                panel.hide();
                            } else {
                                command::position_menubar_panel(app_handle);
                                panel.show();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Hide from Dock and Cmd+Tab
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Create tray icon
            tray::create(app.handle())?;

            // Register global shortcut
            app.handle().global_shortcut().register(shortcut).ok();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
