import { forwardRef, Module } from '@nestjs/common';
import { UserBotService } from './user-bot.service';
import { UserModule } from '../user/user.module';
import { LeaderIdModule } from '../leader-id/leader-id.module';
import { AdminModule } from '../admin/admin.module';
import { AdminBotModule } from '../admin-bot/admin-bot.module';

@Module({
  imports: [
    UserModule,
    LeaderIdModule,
    AdminModule,
    forwardRef(() => AdminBotModule),
  ],
  providers: [UserBotService],
  exports: [UserBotService],
})
export class UserBotModule {}
