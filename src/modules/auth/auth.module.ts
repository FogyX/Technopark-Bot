import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { LeaderIdModule } from '../leader-id/leader-id.module';

@Module({
  imports: [UserModule, LeaderIdModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
