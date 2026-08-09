from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BookBase(BaseModel):
    title: str
    author: Optional[str] = None
    genre: Optional[str] = None
    summary: Optional[str] = None
    cover_url: Optional[str] = None
    drive_file_id: Optional[str] = None
    external_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    progress: Optional[int] = 0

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    summary: Optional[str] = None
    cover_url: Optional[str] = None
    external_url: Optional[str] = None

class BookLinkCreate(BaseModel):
    title: str
    author: Optional[str] = "Unknown Author"
    genre: Optional[str] = None
    cover_url: Optional[str] = None
    external_url: str

class BookCreate(BookBase):
    pass

class BookResponse(BookBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
