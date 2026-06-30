import argparse, getpass, sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .audit import audit
from .config import get_settings
from .models import LocalIdentity, User, UserRole, UserStatus
from .security import hash_password, normalize_email

def bootstrap_admin():
    p=argparse.ArgumentParser(); p.add_argument("email"); args=p.parse_args()
    s=get_settings(); db=sessionmaker(bind=create_engine(s.database_url), expire_on_commit=False)()
    if db.query(User).filter_by(role=UserRole.admin, status=UserStatus.active).first():
        print("Active bootstrap admin already exists", file=sys.stderr); return 2
    pw=getpass.getpass("Admin password: "); pw2=getpass.getpass("Confirm password: ")
    if pw != pw2 or len(pw) < 12: print("Password mismatch or too short", file=sys.stderr); return 2
    u=User(email=normalize_email(args.email), role=UserRole.admin, status=UserStatus.active); db.add(u); db.flush(); db.add(LocalIdentity(user_id=u.id, password_hash=hash_password(pw)))
    audit(db,"admin.bootstrap_created",actor_user_id=u.id,subject_user_id=u.id); db.commit(); print("Bootstrap admin created"); return 0
if __name__ == "__main__": raise SystemExit(bootstrap_admin())
