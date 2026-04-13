use tauri::{AppHandle, Manager};

/// Position the window centered under the mouse cursor (tray icon area)
pub fn position_menubar_panel(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        let panel_size = window.outer_size().unwrap();
        let panel_width = panel_size.width as f64 / scale_factor;

        #[cfg(target_os = "macos")]
        {
            use objc2_app_kit::{NSEvent, NSScreen};
            use objc2_foundation::{MainThreadMarker, NSRect};

            let mouse_location = NSEvent::mouseLocation();
            let mtm = MainThreadMarker::new().unwrap();
            let screens = NSScreen::screens(mtm);

            let mut screen_frame = NSRect::ZERO;
            for screen in &screens {
                let frame: NSRect = screen.frame();
                if mouse_location.x >= frame.origin.x
                    && mouse_location.x <= frame.origin.x + frame.size.width
                    && mouse_location.y >= frame.origin.y
                    && mouse_location.y <= frame.origin.y + frame.size.height
                {
                    screen_frame = frame;
                    break;
                }
            }

            if screen_frame.size.width == 0.0 {
                if let Some(main_screen) = NSScreen::mainScreen(mtm) {
                    screen_frame = main_screen.frame();
                }
            }

            let menu_bar_height = 24.0;
            let panel_height = panel_size.height as f64 / scale_factor;

            let x = (mouse_location.x - panel_width / 2.0)
                .max(screen_frame.origin.x + 4.0)
                .min(screen_frame.origin.x + screen_frame.size.width - panel_width - 4.0);

            let y = screen_frame.origin.y + screen_frame.size.height
                - menu_bar_height
                - panel_height;

            let _ = window.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition {
                    x: (x * scale_factor) as i32,
                    y: ((screen_frame.origin.y + screen_frame.size.height - y - panel_height)
                        * scale_factor) as i32,
                },
            ));
        }
    }
}

pub fn show_panel(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
        position_menubar_panel(app_handle);
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide_panel(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
}

#[tauri::command]
pub fn show_menubar_panel(app_handle: AppHandle) {
    show_panel(&app_handle);
}

#[tauri::command]
pub fn hide_menubar_panel(app_handle: AppHandle) {
    hide_panel(&app_handle);
}
