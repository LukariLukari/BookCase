import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "bookshelf.db")

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}").strip().replace("\n", "").replace("\r", "")

if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

def fix_db_url(url: str) -> str:
    """
    Safely handle database URLs where password contains special characters like '@' or '#'
    which cause psycopg2 to mistake host name for abstract socket.
    """
    if not url.startswith("postgresql"):
        return url
    
    try:
        scheme, remainder = url.split("://", 1)
        if "@" in remainder:
            auth, host_path = remainder.rsplit("@", 1)
            if ":" in auth:
                user, password = auth.split(":", 1)
                password_unquoted = urllib.parse.unquote(password)
                password_encoded = urllib.parse.quote(password_unquoted, safe="")
                user_encoded = urllib.parse.quote(urllib.parse.unquote(user), safe="")
                return f"{scheme}://{user_encoded}:{password_encoded}@{host_path}"
    except Exception:
        pass
    return url

SQLALCHEMY_DATABASE_URL = fix_db_url(SQLALCHEMY_DATABASE_URL)

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine_kwargs = {}
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        engine_kwargs["connect_args"] = {"sslmode": "require"}
    engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

