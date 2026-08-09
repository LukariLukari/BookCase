import os
import sys

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from auth import get_password_hash

def create_default_admin():
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing_admin = db.query(models.User).filter(models.User.username == "admin").first()
        if existing_admin:
            print("Admin user already exists.")
            return

        # Create admin user
        hashed_password = get_password_hash("admin123")
        admin_user = models.User(
            username="admin",
            password_hash=hashed_password,
            role="admin"
        )
        db.add(admin_user)
        db.commit()
        print("Default admin user created successfully!")
        print("Username: admin")
        print("Password: admin123")
    except Exception as e:
        print(f"Error creating admin user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_default_admin()
