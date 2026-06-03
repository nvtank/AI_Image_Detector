import os
import sqlite3
import logging
import json
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class LoggingService:
    def __init__(self):
        self.db_path = settings.DATABASE_PATH
        self._init_db()
        self._migrate_db()

    def _get_connection(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Create tables if they don't exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    tokens INTEGER DEFAULT 5,
                    subscription_tier TEXT DEFAULT 'free',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Prediction logs table (base schema)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS prediction_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    source_type TEXT NOT NULL,
                    image_name TEXT,
                    image_url TEXT,
                    thumbnail_url TEXT,
                    cloudinary_public_id TEXT,
                    image_format TEXT,
                    image_width INTEGER,
                    image_height INTEGER,
                    image_bytes INTEGER,
                    predicted_label TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    fake_probability REAL NOT NULL,
                    real_probability REAL NOT NULL,
                    model_name TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    processing_time_ms INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')
            # Refresh tokens table (Dual-Token auth system)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    revoked INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_refresh_token_hash
                ON refresh_tokens(token_hash)
            ''')

            # Password resets table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    token TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    used INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_password_reset_token
                ON password_resets(token)
            ''')
            conn.commit()

    def _migrate_db(self):
        """Safe migration: add missing columns to existing tables without data loss."""
        new_columns = {
            "users": [
                ("role", "TEXT DEFAULT 'user'"),
                ("tokens", "INTEGER DEFAULT 5"),
                ("subscription_tier", "TEXT DEFAULT 'free'"),
            ],
            "prediction_logs": [
                ("user_id", "INTEGER"),
                ("thumbnail_url", "TEXT"),
                ("cloudinary_public_id", "TEXT"),
                ("image_format", "TEXT"),
                ("image_width", "INTEGER"),
                ("image_height", "INTEGER"),
                ("image_bytes", "INTEGER"),
                ("local_predicted_label", "TEXT"),
                ("local_confidence", "REAL"),
                ("gemini_predicted_label", "TEXT"),
                ("gemini_confidence_level", "TEXT"),
                ("gemini_reasoning_summary", "TEXT"),
                ("gemini_visual_signals", "TEXT"),
                ("gemini_limitations", "TEXT"),
                ("agreement_status", "TEXT"),
                ("final_decision", "TEXT"),
                ("used_gemini", "INTEGER"),
            ]
        }
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for table, columns in new_columns.items():
                cursor.execute(f"PRAGMA table_info({table})")
                existing = {row["name"] for row in cursor.fetchall()}
                for col_name, col_type in columns:
                    if col_name not in existing:
                        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
                        logger.info(f"Migration: added column {col_name} to {table}")
            conn.commit()

    def log_prediction(
        self,
        source_type: str,
        image_name: Optional[str],
        image_url: Optional[str],
        predicted_label: str,
        confidence: float,
        fake_probability: float,
        real_probability: float,
        model_name: str,
        model_version: str,
        processing_time_ms: int,
        user_id: Optional[int] = None,
        thumbnail_url: Optional[str] = None,
        cloudinary_public_id: Optional[str] = None,
        image_format: Optional[str] = None,
        image_width: Optional[int] = None,
        image_height: Optional[int] = None,
        image_bytes: Optional[int] = None,
        local_predicted_label: Optional[str] = None,
        local_confidence: Optional[float] = None,
        gemini_predicted_label: Optional[str] = None,
        gemini_confidence_level: Optional[str] = None,
        gemini_reasoning_summary: Optional[str] = None,
        gemini_visual_signals: Optional[List[str]] = None,
        gemini_limitations: Optional[str] = None,
        agreement_status: Optional[str] = None,
        final_decision: Optional[str] = None,
        used_gemini: Optional[bool] = None,
    ):
        signals_json = json.dumps(gemini_visual_signals) if gemini_visual_signals is not None else None
        used_gemini_val = 1 if used_gemini else (0 if used_gemini is not None else None)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO prediction_logs (
                    user_id, source_type, image_name, image_url, thumbnail_url,
                    cloudinary_public_id, image_format, image_width, image_height, image_bytes,
                    predicted_label, confidence, fake_probability, real_probability,
                    model_name, model_version, processing_time_ms,
                    local_predicted_label, local_confidence, gemini_predicted_label,
                    gemini_confidence_level, gemini_reasoning_summary, gemini_visual_signals,
                    gemini_limitations, agreement_status, final_decision, used_gemini
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id, source_type, image_name, image_url, thumbnail_url,
                cloudinary_public_id, image_format, image_width, image_height, image_bytes,
                predicted_label, confidence, fake_probability, real_probability,
                model_name, model_version, processing_time_ms,
                local_predicted_label, local_confidence, gemini_predicted_label,
                gemini_confidence_level, gemini_reasoning_summary, signals_json,
                gemini_limitations, agreement_status, final_decision, used_gemini_val
            ))
            conn.commit()

    def get_history(
        self,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[int] = None,
        label_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()

            conditions = []
            params: list = []

            if user_id is not None:
                conditions.append("user_id = ?")
                params.append(user_id)

            if label_filter:
                conditions.append("predicted_label = ?")
                params.append(label_filter.upper())

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            cursor.execute(f'''
                SELECT
                    id, source_type, image_name, image_url, thumbnail_url,
                    predicted_label as label, confidence,
                    fake_probability, real_probability,
                    model_name, model_version, processing_time_ms, created_at,
                    local_predicted_label, local_confidence, gemini_predicted_label,
                    gemini_confidence_level, gemini_reasoning_summary, gemini_visual_signals,
                    gemini_limitations, agreement_status, final_decision, used_gemini
                FROM prediction_logs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (*params, limit, offset))
            rows = cursor.fetchall()
            
            history = []
            for row in rows:
                item = dict(row)
                
                # Deserialize gemini_visual_signals if it exists
                signals_str = item.get("gemini_visual_signals")
                if signals_str:
                    try:
                        item["gemini_visual_signals"] = json.loads(signals_str)
                    except Exception:
                        item["gemini_visual_signals"] = [signals_str]
                else:
                    item["gemini_visual_signals"] = None
                
                # Convert used_gemini from INTEGER (0/1) to bool/None
                ug = item.get("used_gemini")
                if ug is not None:
                    item["used_gemini"] = bool(ug)
                
                history.append(item)
                
            return history


logging_service = LoggingService()
