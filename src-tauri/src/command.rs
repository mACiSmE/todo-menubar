use std::sync::Once;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
};

// Define the panel type using the v2.1 macro
tauri_panel! {
    panel!(MenubarPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false
        }
    })

    panel_event!(MenubarPanelEventHandler {
        window_did_resign_key(notification: &NSNotification) -> (),
    })
}

static INIT: Once = Once::new();

#[tauri::command]
pub fn init_menubar_panel(app_handle: AppHandle) {
    INIT.call_once(|| {
        let window: WebviewWindow = app_handle.get_webview_window("main").unwrap();

        // Convert window to NSPanel
        let panel = window.to_panel::<MenubarPanel>().unwrap();

        // Configure panel for menu bar behavior
        panel.set_level(PanelLevel::MainMenu.value() + 1);
        panel.set_style_mask(
            (StyleMask::empty()
                .borderless()
                .nonactivating_panel()
                .resizable())
            .value(),
        );
        panel.set_collection_behavior(
            (CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .transient())
            .value(),
        );
        panel.set_corner_radius(13.0);
        panel.set_hides_on_deactivate(false);

        // Setup event handler: hide panel when it loses focus
        let handler = MenubarPanelEventHandler::new();
        let handle = app_handle.clone();

        handler.window_did_resign_key(move |_notification| {
            if let Ok(p) = handle.get_webview_panel("main") {
                p.hide();
            }
        });

        panel.set_event_handler(Some(handler.as_ref()));
    });
}

#[tauri::command]
pub fn show_menubar_panel(app_handle: AppHandle) {
    if let Ok(panel) = app_handle.get_webview_panel("main") {
        position_menubar_panel(&app_handle);
        panel.show();
    }
}

/// Position the panel centered under the mouse cursor (tray icon area)
pub fn position_menubar_panel(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        let panel_size = window.outer_size().unwrap();
        let panel_width = panel_size.width as f64 / scale_factor;

        #[cfg(target_os = "macos")]
        {
            use tauri_nspanel::objc2_app_kit::{NSEvent, NSScreen};
            use tauri_nspanel::objc2_foundation::MainThreadMarker;

            {
                let mouse_location = NSEvent::mouseLocation();
                let mtm = MainThreadMarker::new().unwrap();
                let screens = NSScreen::screens(mtm);

                let mut screen_frame = tauri_nspanel::NSRect::ZERO;
                for screen in &screens {
                    let frame: tauri_nspanel::NSRect = screen.frame();
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
                        let f: tauri_nspanel::NSRect = main_screen.frame();
                        screen_frame = f;
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
}
