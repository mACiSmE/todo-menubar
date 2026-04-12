use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_nspanel::ManagerExt;

use crate::command::position_menubar_panel;

pub fn create(app_handle: &AppHandle) -> tauri::Result<TrayIcon> {
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;

    // Build right-click context menu
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Todo Menubar").build(app_handle)?;
    let menu = MenuBuilder::new(app_handle).item(&quit_item).build()?;

    TrayIconBuilder::with_id("tray")
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Todo Menubar")
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app_handle, event| {
            if event.id() == "quit" {
                app_handle.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            let app_handle = tray.app_handle();

            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Ok(panel) = app_handle.get_webview_panel("main") {
                    if panel.is_visible() {
                        panel.hide();
                        return;
                    }

                    position_menubar_panel(app_handle);
                    panel.show();
                }
            }
        })
        .build(app_handle)
}
