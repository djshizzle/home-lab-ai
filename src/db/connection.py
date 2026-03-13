"""PostgreSQL connection pool configuration (R15).

Uses SQLAlchemy with bounded pool to prevent DB connection exhaustion.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.environ.get(
    "AVOPS_DATABASE_URL",
    "postgresql://avops:avops@localhost:5432/avops",
)

# R15: Bounded connection pool to prevent DB exhaustion.
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Session:
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db  # type: ignore[misc]
    finally:
        db.close()
