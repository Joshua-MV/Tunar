//! The standalone tuner app. Everything happens in the window (the microphone is read with the
//! Web Audio API), so the native side is just the window itself.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while starting the tuner");
}
