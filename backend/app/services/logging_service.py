import sqlite3
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class LoggingService:
    def __init__(self):
        self.db_path = settings.DATABASE_PATH
        self._init_db()
        self._migrate_db()

    def _get_connection(self):
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
            conn.commit()

    def _migrate_db(self):
        """Safe migration: add missing columns to existing tables without data loss."""
        new_columns = {
            "prediction_logs": [
                ("user_id", "INTEGER"),
                ("thumbnail_url", "TEXT"),
                ("cloudinary_public_id", "TEXT"),
                ("image_format", "TEXT"),
                ("image_width", "INTEGER"),
                ("image_height", "INTEGER"),
                ("image_bytes", "INTEGER"),
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
    ):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO prediction_logs (
                    user_id, source_type, image_name, image_url, thumbnail_url,
                    cloudinary_public_id, image_format, image_width, image_height, image_bytes,
                    predicted_label, confidence, fake_probability, real_probability,
                    model_name, model_version, processing_time_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id, source_type, image_name, image_url, thumbnail_url,
                cloudinary_public_id, image_format, image_width, image_height, image_bytes,
                predicted_label, confidence, fake_probability, real_probability,
                model_name, model_version, processing_time_ms
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
                    model_name, model_version, processing_time_ms, created_at
                FROM prediction_logs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (*params, limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]


logging_service = LoggingService()
