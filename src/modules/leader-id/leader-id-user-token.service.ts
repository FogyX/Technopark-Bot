import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { UserService } from '../user/user.service';

@Injectable()
export class LeaderIdUserTokenService {
  constructor(private userService: UserService) {}

  async getValidUserAccessToken(telegramId: string) {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user || !user.leader_id_access_token) throw new Error('No token');

    if (user.leader_id_expires_at && user.leader_id_expires_at < new Date()) {
      // обновляем токен через refresh_token
      const resp = await axios.post(
        'https://apps.leader-id.ru/api/v1/oauth/token',
        {
          client_id: process.env.LEADERID_CLIENT_ID,
          client_secret: process.env.LEADERID_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: user.leader_id_refresh_token,
        },
      );

      const { access_token, refresh_token } = resp.data;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.userService.updateProfile({
        telegramId,
        leaderId: user.leader_id,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      });

      return access_token;
    }

    return user.leader_id_access_token;
  }
}
