from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
import uuid
from database import Base
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

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
    collections = relationship("CollectionBook", back_populates="book", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String)
    role = Column(String, default="user") # "admin" or "user"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OTP(Base):
    __tablename__ = "otps"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    email = Column(String, index=True)
    otp_code = Column(String)
    purpose = Column(String) # "register" or "reset_password"
    expires_at = Column(DateTime(timezone=True))
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    books = relationship("CollectionBook", back_populates="collection", cascade="all, delete-orphan")

class CollectionBook(Base):
    __tablename__ = "collection_books"

    collection_id = Column(String, ForeignKey("collections.id"), primary_key=True)
    book_id = Column(String, ForeignKey("books.id"), primary_key=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    collection = relationship("Collection", back_populates="books")
    book = relationship("Book", back_populates="collections")
