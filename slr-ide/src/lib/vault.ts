import crypto from 'crypto';

const PBKDF2_ITERATIONS = 600000;

/**
 * Derives a 256-bit AES key from a password and salt using PBKDF2.
 */
export function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

interface EncryptedData {
  ciphertext: string;
  salt: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts a key using AES-256-GCM.
 */
export async function encryptKey(plainKey: string, password: string): Promise<EncryptedData> {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = await deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plainKey, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypts a key using AES-256-GCM.
 */
export async function decryptKey(encrypted: EncryptedData, password: string): Promise<string> {
  const salt = Buffer.from(encrypted.salt, 'base64');
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const key = await deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
