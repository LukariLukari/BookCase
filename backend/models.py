from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
import uuid
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Book(Base):
    __tablename__ = "books"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    title = Column(String, index=True)
    author = Column(String, index=True, nullable=True)
    genre = Column(String, index=True, nullable=True)
    summary = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)
    drive_file_id = Column(String, nullable=True)
    external_url = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    progress = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="user") # "admin" or "user"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
