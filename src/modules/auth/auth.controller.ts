import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { UserService } from '../user/user.service';
import { LeaderIdApiService } from '../leader-id/leader-id-api.service';

@Controller('oauth')
export class AuthController {
  constructor(
    private userService: UserService,
    private leaderIdApiService: LeaderIdApiService,
  ) {}

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') telegramId: string,
    @Res() res: Response,
  ) {
    const tokenResp = await axios.post(
      'https://apps.leader-id.ru/api/v1/oauth/token',
      {
        client_id: process.env.LEADERID_CLIENT_ID,
        client_secret: process.env.LEADERID_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      },
    );

    const { access_token, refresh_token, user_id } = tokenResp.data;

    // В API указано, что токен доступен 7 дней
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { firstName, lastName, phone, email } =
      await this.leaderIdApiService.getUserProfile(user_id, access_token);

    await this.userService.updateProfile({
      telegramId,
      leaderId: user_id,
      firstName,
      lastName,
      phone,
      email,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    });

    return res.send('Авторизация успешна! Можно вернуться в Telegram.');
  }
}
