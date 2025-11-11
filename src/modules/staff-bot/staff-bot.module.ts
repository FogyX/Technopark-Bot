import { Module } from '@nestjs/common';
import { StaffBotService } from './staff-bot.service';

@Module({
  providers: [StaffBotService],
})
export class StaffBotModule {}
