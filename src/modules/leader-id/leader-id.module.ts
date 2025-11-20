import { Module } from '@nestjs/common';
import { LeaderIdApiService } from './leader-id-api.service';
import { LeaderIdUserTokenService } from './leader-id-user-token.service';
import { UserModule } from '../user/user.module';
import { LeaderIdAppTokenService } from './leader-id-app-token.service';

@Module({
  imports: [UserModule],
  providers: [
    LeaderIdApiService,
    LeaderIdAppTokenService,
    LeaderIdUserTokenService,
  ],
  exports: [LeaderIdApiService, LeaderIdUserTokenService],
})
export class LeaderIdModule {}
