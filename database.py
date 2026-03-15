import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "chatbot.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'recruiting',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS custom_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_type TEXT NOT NULL DEFAULT 'recruiting',
            prompt_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


def create_conversation(title, mode):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    cursor = conn.execute(
        "INSERT INTO conversations (title, mode, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (title, mode, now, now),
    )
    conn.commit()
    conv_id = cursor.lastrowid
    conn.close()
    return conv_id


def add_message(conversation_id, role, content):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (conversation_id, role, content, now),
    )
    conn.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (now, conversation_id),
    )
    conn.commit()
    conn.close()


def update_conversation_title(conversation_id, title):
    conn = get_db()
    conn.execute(
        "UPDATE conversations SET title = ? WHERE id = ?",
        (title, conversation_id),
    )
    conn.commit()
    conn.close()


def get_conversations():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, mode, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_conversation(conversation_id):
    conn = get_db()
    conv = conn.execute(
        "SELECT id, title, mode, created_at, updated_at FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    if not conv:
        conn.close()
        return None
    messages = conn.execute(
        "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    conn.close()
    result = dict(conv)
    result["messages"] = [dict(msg) for msg in messages]
    return result


def delete_conversation(conversation_id):
    conn = get_db()
    conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()


def get_custom_prompt(prompt_type="recruiting"):
    conn = get_db()
    row = conn.execute(
        "SELECT prompt_text FROM custom_prompts WHERE prompt_type = ? ORDER BY updated_at DESC LIMIT 1",
        (prompt_type,),
    ).fetchone()
    conn.close()
    return row["prompt_text"] if row else None


def save_custom_prompt(prompt_type, prompt_text):
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    existing = conn.execute(
        "SELECT id FROM custom_prompts WHERE prompt_type = ?", (prompt_type,)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE custom_prompts SET prompt_text = ?, updated_at = ? WHERE id = ?",
            (prompt_text, now, existing["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO custom_prompts (prompt_type, prompt_text, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (prompt_type, prompt_text, now, now),
        )
    conn.commit()
    conn.close()
