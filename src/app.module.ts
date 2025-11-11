import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBotModule } from './modules/user-bot/user-bot.module';
import { AdminBotModule } from './modules/admin-bot/admin-bot.module';
import { StaffBotModule } from './modules/staff-bot/staff-bot.module';

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
        entities: [],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    UserBotModule,
    AdminBotModule,
    StaffBotModule,
  ],
})
export class AppModule {}
