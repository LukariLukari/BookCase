import os
import sqlite3
from sqlalchemy.orm import Session
from database import SessionLocal, BASE_DIR
import models

SQLITE_DB_PATH = os.path.join(BASE_DIR, "bookshelf.db")

def migrate_sqlite_to_target_db():
    if not os.path.exists(SQLITE_DB_PATH):
        print("[Migrate] SQLite bookshelf.db not found, skipping migration.")
        return

    db: Session = SessionLocal()
    try:
        book_count = db.query(models.Book).count()
        if book_count > 0:
            print(f"[Migrate] Target DB already contains {book_count} books, skipping auto-migration.")
            return

        print("[Migrate] Target DB is empty. Starting auto-migration from bookshelf.db...")
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Migrate Users
        try:
            cursor.execute("SELECT * FROM users")
            for row in cursor.fetchall():
                row_dict = dict(row)
                existing = db.query(models.User).filter(models.User.id == row_dict['id']).first()
                if not existing:
                    user = models.User(
                        id=row_dict['id'],
                        username=row_dict['username'],
                        email=row_dict.get('email'),
                        password_hash=row_dict['password_hash'],
                        role=row_dict.get('role', 'user')
                    )
                    db.add(user)
            db.commit()
        except Exception as u_err:
            print(f"[Migrate] Users migration warning: {u_err}")
            db.rollback()

        # 2. Migrate Books
        try:
            cursor.execute("SELECT * FROM books")
            for row in cursor.fetchall():
                row_dict = dict(row)
                existing = db.query(models.Book).filter(models.Book.id == row_dict['id']).first()
                if not existing:
                    book = models.Book(
                        id=row_dict['id'],
                        title=row_dict['title'],
                        author=row_dict.get('author'),
                        genre=row_dict.get('genre'),
                        summary=row_dict.get('summary'),
                        cover_url=row_dict.get('cover_url'),
                        drive_file_id=row_dict.get('drive_file_id'),
                        external_url=row_dict.get('external_url'),
                        mime_type=row_dict.get('mime_type'),
                        file_size=row_dict.get('file_size'),
                        progress=row_dict.get('progress', 0)
                    )
                    db.add(book)
            db.commit()
        except Exception as b_err:
            print(f"[Migrate] Books migration warning: {b_err}")
            db.rollback()

        # 3. Migrate Collections
        try:
            cursor.execute("SELECT * FROM collections")
            for row in cursor.fetchall():
                row_dict = dict(row)
                existing = db.query(models.Collection).filter(models.Collection.id == row_dict['id']).first()
                if not existing:
                    c = models.Collection(
                        id=row_dict['id'],
                        name=row_dict['name'],
                        description=row_dict.get('description')
                    )
                    db.add(c)
            db.commit()
        except Exception as c_err:
            print(f"[Migrate] Collections migration warning: {c_err}")
            db.rollback()

        # 4. Migrate CollectionBooks
        try:
            cursor.execute("SELECT * FROM collection_books")
            for row in cursor.fetchall():
                row_dict = dict(row)
                existing = db.query(models.CollectionBook).filter_by(
                    collection_id=row_dict['collection_id'],
                    book_id=row_dict['book_id']
                ).first()
                if not existing:
                    cb = models.CollectionBook(
                        id=row_dict['id'],
                        collection_id=row_dict['collection_id'],
                        book_id=row_dict['book_id']
                    )
                    db.add(cb)
            db.commit()
        except Exception as cb_err:
            print(f"[Migrate] CollectionBooks migration warning: {cb_err}")
            db.rollback()

        # 5. Migrate RegistrationCodes
        try:
            cursor.execute("SELECT * FROM registration_codes")
            for row in cursor.fetchall():
                row_dict = dict(row)
                existing = db.query(models.RegistrationCode).filter(models.RegistrationCode.id == row_dict['id']).first()
                if not existing:
                    rc = models.RegistrationCode(
                        id=row_dict['id'],
                        code=row_dict['code'],
                        is_used=bool(row_dict.get('is_used', 0)),
                        used_by_username=row_dict.get('used_by_username'),
                        created_by=row_dict.get('created_by')
                    )
                    db.add(rc)
            db.commit()
        except Exception as rc_err:
            print(f"[Migrate] RegistrationCodes migration warning: {rc_err}")
            db.rollback()

        print("[Migrate] Successfully completed auto-migration to target database!")

    except Exception as e:
        print(f"[Migrate ERROR] Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_sqlite_to_target_db()
