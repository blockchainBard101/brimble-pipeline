import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { EnvVarResponseDto } from './dto/env-var.dto';

@Injectable()
export class EnvVarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async setEnvVars(
    deploymentId: string,
    vars: { key: string; value: string }[],
  ): Promise<void> {
    await this.prisma.envVar.deleteMany({ where: { deploymentId } });
    for (const { key, value } of vars) {
      const { encryptedValue, iv } = this.crypto.encrypt(value);
      await this.prisma.envVar.create({ data: { deploymentId, key, encryptedValue, iv } });
    }
  }

  async getMasked(deploymentId: string): Promise<EnvVarResponseDto[]> {
    const vars = await this.prisma.envVar.findMany({ where: { deploymentId } });
    return vars.map((v) => ({ key: v.key, value: '***' }));
  }

  async getDecrypted(deploymentId: string): Promise<Record<string, string>> {
    const vars = await this.prisma.envVar.findMany({ where: { deploymentId } });
    const result: Record<string, string> = {};
    for (const v of vars) {
      result[v.key] = this.crypto.decrypt(v.encryptedValue, v.iv);
    }
    return result;
  }
}
