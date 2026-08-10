import os
import sys

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models
from auth import get_password_hash

def create_default_admin():
    # Ensure tables are created
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check and create lukari
        existing_lukari = db.query(models.User).filter(models.User.username == "lukari").first()
        if not existing_lukari:
            hashed_password = get_password_hash("12345678")
            admin_user = models.User(username="lukari", password_hash=hashed_password, role="admin")
            db.add(admin_user)
            print("Default admin user 'lukari' created successfully!")

        # Check and create admin
        existing_admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not existing_admin:
            hashed_password = get_password_hash("admin123")
            admin_user2 = models.User(username="admin", password_hash=hashed_password, role="admin")
            db.add(admin_user2)
            print("Default admin user 'admin' created successfully!")

        db.commit()
    except Exception as e:
        print(f"Error creating admin users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_admin()
