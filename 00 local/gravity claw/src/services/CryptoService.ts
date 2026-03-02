import * as crypto from 'crypto';

export class CryptoService {
    private static readonly ALGORITHM = 'aes-256-gcm';
    private static readonly IV_LENGTH = 12;
    private static readonly SALT_LENGTH = 32;

    /**
     * Generate a random salt
     */
    static generateSalt(): string {
        return crypto.randomBytes(this.SALT_LENGTH).toString('hex');
    }

    /**
     * Hash a value with a salt using SHA-256
     */
    static hash(value: string, salt: string): string {
        return crypto.createHmac('sha256', salt).update(value).digest('hex');
    }

    /**
     * Encrypt a JSON object with a master password
     */
    static encrypt(data: any, password: string): { encrypted: string; iv: string } {
        const iv = crypto.randomBytes(this.IV_LENGTH);
        const salt = crypto.randomBytes(this.SALT_LENGTH);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

        const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        // Final format includes salt for key derivation and authTag for GCM
        return {
            encrypted: `${salt.toString('hex')}:${authTag}:${encrypted}`,
            iv: iv.toString('hex')
        };
    }

    /**
     * Decrypt a string with a master password
     */
    static decrypt(encryptedData: string, ivHex: string, password: string): any {
        try {
            const [saltHex, authTagHex, encrypted] = encryptedData.split(':');
            const salt = Buffer.from(saltHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const iv = Buffer.from(ivHex, 'hex');
            const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }
}
