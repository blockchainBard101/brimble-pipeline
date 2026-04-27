import { Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService implements OnModuleInit {
  private key!: Buffer;

  onModuleInit() {
    const k = process.env.ENCRYPTION_KEY ?? '';
    if (!k || k.length < 32) {
      throw new Error('ENCRYPTION_KEY env var must be at least 32 characters');
    }
    this.key = Buffer.from(k.slice(0, 32));
  }

  encrypt(plaintext: string): { encryptedValue: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      encryptedValue: `${authTag.toString('hex')}:${encrypted.toString('hex')}`,
    };
  }

  decrypt(encryptedValue: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const [authTagHex, dataHex] = encryptedValue.split(':');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  }
}
