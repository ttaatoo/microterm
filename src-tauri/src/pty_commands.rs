use crate::pty::PtyManager;
use std::sync::Arc;
use tauri::{command, AppHandle, State};

#[command]
pub async fn create_pty_session(
    app: AppHandle,
    pty_manager: State<'_, Arc<PtyManager>>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    pty_manager.create_session(app, cols, rows)
}

#[command]
pub async fn write_to_pty(
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    pty_manager.write_to_session(&session_id, &data)
}

#[command]
pub async fn resize_pty(
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty_manager.resize_session(&session_id, cols, rows)
}

#[command]
pub async fn close_pty_session(
    pty_manager: State<'_, Arc<PtyManager>>,
    session_id: String,
) -> Result<(), String> {
    pty_manager.close_session(&session_id)
}
