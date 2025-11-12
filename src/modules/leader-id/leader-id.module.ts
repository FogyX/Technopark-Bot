import { Module } from '@nestjs/common';
import { LeaderIdApiService } from './leader-id-api.service';
import { LeaderIdTokenService } from './leader-id-token.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [LeaderIdApiService, LeaderIdTokenService],
  exports: [LeaderIdApiService, LeaderIdTokenService],
})
export class LeaderIdModule {}
