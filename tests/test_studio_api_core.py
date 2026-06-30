import base64, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("STUDIO_APP_ORIGIN", "https://studio.test")
os.environ.setdefault("STUDIO_COOKIE_SECURE", "false")
keyfile=tempfile.NamedTemporaryFile(delete=False); keyfile.write(base64.b64encode(b"1"*32)); keyfile.close(); os.environ["STUDIO_CREDENTIAL_MASTER_KEY_FILE"]=keyfile.name
from fastapi.testclient import TestClient
from studio_api.db import Base, engine, SessionLocal
from studio_api.models import LocalIdentity, User, UserRole, UserStatus, ProviderCredentialVersion, AuditEvent
from studio_api.security import hash_password, verify_password, token_hash, encrypt, decrypt, aad, master_key_from_b64
from studio_api.main import app

def setup_function():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)

def admin(email="a@example.com", password="correct horse battery"):
    db=SessionLocal(); u=User(email=email, role=UserRole.admin, status=UserStatus.active); db.add(u); db.flush(); db.add(LocalIdentity(user_id=u.id, password_hash=hash_password(password))); db.commit(); db.close(); return password

def login(c, password):
    r=c.post("/api/auth/login-context", headers={"origin":"https://studio.test"}); assert r.status_code==200
    token=r.json()["login_csrf_token"]
    r=c.post("/api/auth/login", json={"email":"a@example.com","password":password,"login_csrf_token":token}, headers={"origin":"https://studio.test"}); assert r.status_code==200
    return r.json()["csrf_token"]

def test_password_hashing_argon2id():
    h=hash_password("secret-password-123"); assert "argon2id" in h; assert verify_password(h,"secret-password-123"); assert not verify_password(h,"bad")

def test_login_csrf_session_cookie_and_logout():
    pw=admin(); c=TestClient(app)
    assert c.post("/api/auth/login", json={"email":"a@example.com","password":pw,"login_csrf_token":"bad"}, headers={"origin":"https://studio.test"}).status_code==403
    csrf=login(c,pw); assert c.get("/api/auth/session").json()["authenticated"] is True
    assert c.post("/api/auth/logout", headers={"origin":"https://studio.test","x-csrf-token":csrf}).status_code==200
    assert c.get("/api/auth/session").status_code==401

def test_same_origin_and_authenticated_csrf_required():
    pw=admin(); c=TestClient(app); csrf=login(c,pw)
    assert c.post("/api/auth/logout", headers={"origin":"https://evil.test","x-csrf-token":csrf}).status_code==403
    assert c.post("/api/auth/logout", headers={"origin":"https://studio.test","x-csrf-token":"bad"}).status_code==403

def test_credential_lifecycle_no_raw_secret_echo_and_audit_safe():
    pw=admin(); c=TestClient(app); csrf=login(c,pw); raw="sk-test-secret-value-123456"
    r=c.post("/api/credentials", json={"provider":"openai","label":"main","raw_value":raw}, headers={"origin":"https://studio.test","x-csrf-token":csrf}); assert r.status_code==200; cid=r.json()["id"]; assert raw not in r.text
    r=c.get("/api/credentials"); assert raw not in r.text and "••••" in r.text
    r=c.post(f"/api/credentials/{cid}/replace", json={"provider":"openai","label":"main","raw_value":"sk-test-new-secret-abcdef"}, headers={"origin":"https://studio.test","x-csrf-token":csrf}); assert r.status_code==200
    r=c.post(f"/api/credentials/{cid}/revoke", headers={"origin":"https://studio.test","x-csrf-token":csrf}); assert r.status_code==200
    r=c.delete(f"/api/credentials/{cid}", headers={"origin":"https://studio.test","x-csrf-token":csrf}); assert r.status_code==200
    db=SessionLocal(); assert raw not in "\n".join(a.metadata_json for a in db.query(AuditEvent).all()); assert all(v.ciphertext is None for v in db.query(ProviderCredentialVersion).all())

def test_aes_gcm_unique_nonce_and_aad_binding():
    key=master_key_from_b64(base64.b64encode(b"2"*32).decode()); a=aad("u","c","v","openai")
    c1,n1=encrypt("secret",key,a); c2,n2=encrypt("secret",key,a); assert n1 != n2 and c1 != c2; assert decrypt(c1,n1,key,a)=="secret"
    import pytest
    with pytest.raises(Exception): decrypt(c1,n1,key,aad("u","c","other","openai"))

def test_bootstrap_status():
    c=TestClient(app); assert c.get("/api/auth/bootstrap-status").json()["bootstrap_required"] is True; admin(); assert c.get("/api/auth/bootstrap-status").json()["bootstrap_required"] is False
