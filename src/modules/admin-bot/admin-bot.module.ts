import { Module } from '@nestjs/common';
import { AdminBotService } from './admin-bot.service';

@Module({
  providers: [AdminBotService],
})
export class AdminBotModule {}
