import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBotModule } from './modules/user-bot/user-bot.module';
import { AdminBotModule } from './modules/admin-bot/admin-bot.module';
import { LeaderIdModule } from './modules/leader-id/leader-id.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { LeaderIdUserTokenService } from './modules/leader-id/leader-id-user-token.service';
import { User } from './entities/user.entity';
import { AdminModule } from './modules/admin/admin.module';
import { Admin } from './entities/admin.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: 5432,
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [User, Admin],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    UserBotModule,
    AdminBotModule,
    LeaderIdModule,
    AuthModule,
    UserModule,
    AdminModule,
  ],
  providers: [LeaderIdUserTokenService],
})
export class AppModule {}
