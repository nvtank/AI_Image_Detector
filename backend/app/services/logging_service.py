import sqlite3
from typing import List, Dict, Any
from app.config import settings

class LoggingService:
    def __init__(self):
        self.db_path = settings.DATABASE_PATH
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS prediction_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_type TEXT NOT NULL,
                    image_name TEXT,
                    image_url TEXT,
                    predicted_label TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    fake_probability REAL NOT NULL,
                    real_probability REAL NOT NULL,
                    model_name TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    processing_time_ms INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()

    def log_prediction(self, source_type: str, image_name: str | None, image_url: str | None, 
                       predicted_label: str, confidence: float, 
                       fake_probability: float, real_probability: float, 
                       model_name: str, model_version: str, processing_time_ms: int):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO prediction_logs (
                    source_type, image_name, image_url, predicted_label, 
                    confidence, fake_probability, real_probability, 
                    model_name, model_version, processing_time_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                source_type, image_name, image_url, predicted_label,
                confidence, fake_probability, real_probability,
                model_name, model_version, processing_time_ms
            ))
            conn.commit()

    def get_history(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    id, source_type, image_name, image_url, 
                    predicted_label as label, confidence, 
                    fake_probability, real_probability, 
                    model_name, model_version, processing_time_ms, created_at
                FROM prediction_logs
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

logging_service = LoggingService()
