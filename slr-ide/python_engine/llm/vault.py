import base64
import os
import bcrypt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

# Configuration Constants
PBKDF2_ITERATIONS = 600000

def hash_master_password(password: str) -> str:
    """Hashes the master password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_master_password(password: str, hashed_password: str) -> bool:
    """Verifies a master password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def derive_key(password: str, salt: bytes) -> bytes:
    """Derives a 256-bit AES key from password and salt using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS
    )
    return kdf.derive(password.encode('utf-8'))

def encrypt_key(plain_key: str, password: str) -> dict:
    """Encrypts a plaintext key using AES-256-GCM derived from the password.
    Returns base64 encoded ciphertext, salt, iv, and tag.
    """
    salt = os.urandom(32)
    iv = os.urandom(12)
    derived_aes_key = derive_key(password, salt)
    
    aesgcm = AESGCM(derived_aes_key)
    # The encrypt method in cryptography's AESGCM combines ciphertext and tag
    ciphertext_and_tag = aesgcm.encrypt(iv, plain_key.encode('utf-8'), None)
    
    # Separate ciphertext and tag (tag is the last 16 bytes in cryptography AESGCM)
    ciphertext = ciphertext_and_tag[:-16]
    tag = ciphertext_and_tag[-16:]
    
    return {
        "ciphertext": base64.b64encode(ciphertext).decode('utf-8'),
        "salt": base64.b64encode(salt).decode('utf-8'),
        "iv": base64.b64encode(iv).decode('utf-8'),
        "tag": base64.b64encode(tag).decode('utf-8')
    }

def decrypt_key(encrypted_data: dict, password: str) -> str:
    """Decrypts AES-256-GCM data using the password."""
    ciphertext = base64.b64decode(encrypted_data["ciphertext"])
    salt = base64.b64decode(encrypted_data["salt"])
    iv = base64.b64decode(encrypted_data["iv"])
    tag = base64.b64decode(encrypted_data["tag"])
    
    derived_aes_key = derive_key(password, salt)
    aesgcm = AESGCM(derived_aes_key)
    
    # Combine ciphertext and tag for decryption
    ciphertext_and_tag = ciphertext + tag
    decrypted_bytes = aesgcm.decrypt(iv, ciphertext_and_tag, None)
    
    return decrypted_bytes.decode('utf-8')
