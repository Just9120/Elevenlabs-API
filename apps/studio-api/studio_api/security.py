import base64, hashlib, hmac, secrets
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher, Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ph = PasswordHasher(type=Type.ID)
def hash_password(p: str) -> str: return ph.hash(p)
def verify_password(h: str, p: str) -> bool:
    try: return ph.verify(h, p)
    except Exception: return False

def new_token() -> str: return secrets.token_urlsafe(32)
def token_hash(t: str) -> str: return hashlib.sha256(t.encode()).hexdigest()
def safe_eq(a: str, b: str) -> bool: return hmac.compare_digest(a, b)
def utcnow(): return datetime.now(timezone.utc)
def expires(days=14): return utcnow()+timedelta(days=days)
def normalize_email(e: str) -> str: return e.strip().lower()
def rate_key_part(value: str) -> str: return hashlib.sha256(normalize_email(value).encode()).hexdigest()[:24]
def mask_secret(raw: str) -> str:
    s=raw.strip(); return ("•"*8 + s[-4:]) if len(s)>=4 else "•"*8

def fingerprint(raw: str) -> str: return hashlib.sha256(raw.encode()).hexdigest()
def master_key_from_b64(v: str) -> bytes:
    k=base64.b64decode(v)
    if len(k)!=32: raise ValueError("credential master key must decode to 32 bytes")
    return k
def aad(user_id: str, credential_id: str, version_id: str, provider: str) -> bytes:
    return f"user={user_id};credential={credential_id};version={version_id};provider={provider}".encode()
def encrypt(raw: str, key: bytes, aad_bytes: bytes) -> tuple[bytes, bytes]:
    nonce=secrets.token_bytes(12)
    return AESGCM(key).encrypt(nonce, raw.encode(), aad_bytes), nonce
def decrypt(ciphertext: bytes, nonce: bytes, key: bytes, aad_bytes: bytes) -> str:
    return AESGCM(key).decrypt(nonce, ciphertext, aad_bytes).decode()
