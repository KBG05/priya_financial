"""ASGI entrypoint for running from app/ directory.

Allows:
    uvicorn main:app --reload
from /app while backend code lives in /app/backend.
"""

from backend.main import app
