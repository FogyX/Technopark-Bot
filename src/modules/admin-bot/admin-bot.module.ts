import { forwardRef, Module } from '@nestjs/common';
import { AdminBotService } from './admin-bot.service';
import { AdminModule } from '../admin/admin.module';
import { UserBotModule } from '../user-bot/user-bot.module';

@Module({
  imports: [AdminModule, forwardRef(() => UserBotModule)],
  providers: [AdminBotService],
  exports: [AdminBotService],
})
export class AdminBotModule {}
