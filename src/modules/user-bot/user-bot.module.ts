import { Module } from '@nestjs/common';
import { UserBotService } from './user-bot.service';

@Module({
  providers: [UserBotService],
})
export class UserBotModule {}
