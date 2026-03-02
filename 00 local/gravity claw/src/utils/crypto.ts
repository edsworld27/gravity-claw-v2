import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM.
 * @param text The plain text to encrypt.
 * @param masterKey A 32-byte key (hex string or Buffer).
 * @returns Encrypted string in format: iv:authTag:encryptedText
 */
export function encrypt(text: string, masterKey: string): string {
    const key = Buffer.from(masterKey, 'hex');
    if (key.length !== 32) throw new Error('Master key must be 32 bytes (64 hex characters).');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM.
 * @param encryptedData format: iv:authTag:encryptedText
 * @param masterKey A 32-byte key (hex string or Buffer).
 */
export function decrypt(encryptedData: string, masterKey: string): string {
    const key = Buffer.from(masterKey, 'hex');
    if (key.length !== 32) throw new Error('Master key must be 32 bytes (64 hex characters).');

    const parts = encryptedData.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted data format.');

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
