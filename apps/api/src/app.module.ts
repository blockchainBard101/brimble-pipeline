import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './crypto/crypto.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CryptoModule,
    DeploymentsModule,
    WebhooksModule,
    AppConfigModule,
  ],
})
export class AppModule {}
