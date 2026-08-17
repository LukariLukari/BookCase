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

# Log connection info (with password masked) for easy debugging on Render logs
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    try:
        masked_url = SQLALCHEMY_DATABASE_URL
        if "@" in masked_url and ":" in masked_url.split("@")[0]:
            prefix, rest = masked_url.rsplit("@", 1)
            scheme_user, _ = prefix.rsplit(":", 1)
            masked_url = f"{scheme_user}:****@{rest}"
        print(f"[Database] Connecting to Postgres: {masked_url}")
        
        # Check if connecting to Supabase Pooler with missing project ref in username
        if "pooler.supabase.com" in SQLALCHEMY_DATABASE_URL:
            auth_part = SQLALCHEMY_DATABASE_URL.split("://", 1)[1].split("@", 1)[0]
            db_user = auth_part.split(":", 1)[0]
            if "." not in urllib.parse.unquote(db_user):
                print("[Database WARNING] Host is Supabase Pooler (6543) but username is missing project ref (e.g., 'postgres.ref'). This will fail authentication!")
    except Exception:
        pass


if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    connect_args = {"connect_timeout": 10}
    if "sslmode" not in SQLALCHEMY_DATABASE_URL:
        connect_args["sslmode"] = "require"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
