import argparse, getpass, sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .audit import audit
from .config import get_settings
from .db import SessionLocal
from .models import LocalIdentity, User, UserRole, UserStatus
from .source_cleanup import cleanup_expired_local_uploads
from .security import hash_password, normalize_email

def bootstrap_admin():
    p=argparse.ArgumentParser(); p.add_argument("email"); args=p.parse_args()
    s=get_settings(); db=sessionmaker(bind=create_engine(s.sqlalchemy_url()), expire_on_commit=False)()
    if db.query(User).filter_by(role=UserRole.admin, status=UserStatus.active).first():
        print("Active bootstrap admin already exists", file=sys.stderr); return 2
    pw=getpass.getpass("Admin password: "); pw2=getpass.getpass("Confirm password: ")
    if pw != pw2 or len(pw) < 12: print("Password mismatch or too short", file=sys.stderr); return 2
    u=User(email=normalize_email(args.email), role=UserRole.admin, status=UserStatus.active); db.add(u); db.flush(); db.add(LocalIdentity(user_id=u.id, password_hash=hash_password(pw)))
    audit(db,"admin.bootstrap_created",actor_user_id=u.id,subject_user_id=u.id); db.commit(); print("Bootstrap admin created"); return 0
def cleanup_sources():
    s=get_settings(); db=SessionLocal()
    try:
        count=cleanup_expired_local_uploads(db, s)
    finally:
        db.close()
    print(f"Expired local-upload sources cleaned: {count}")
    return 0

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "cleanup-expired-sources":
        sys.argv.pop(1)
        return cleanup_sources()
    return bootstrap_admin()

if __name__ == "__main__": raise SystemExit(main())
