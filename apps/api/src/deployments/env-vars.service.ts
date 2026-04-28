import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { EnvVarInputDto, EnvVarResponseDto } from './dto/env-var.dto';

@Injectable()
export class EnvVarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async setEnvVars(deploymentId: string, vars: EnvVarInputDto[]): Promise<void> {
    await this.prisma.envVar.deleteMany({ where: { deploymentId } });
    if (!vars.length) return;
    const data = vars.map(({ key, value }) => {
      const { encryptedValue, iv } = this.crypto.encrypt(value);
      return { deploymentId, key, encryptedValue, iv };
    });
    await this.prisma.envVar.createMany({ data });
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
