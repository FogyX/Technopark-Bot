import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LeaderIdAppTokenService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;

  private readonly logger = new Logger(LeaderIdAppTokenService.name);

  private readonly tokenUrl = 'https://apps.leader-id.ru/api/v1/oauth/token';
  private readonly clientId = process.env.LEADERID_CLIENT_ID!;
  private readonly clientSecret = process.env.LEADERID_CLIENT_SECRET!;

  async getAppAccessToken(): Promise<string> {
    const now = Date.now() / 1000;

    if (!this.accessToken || now >= this.expiresAt - 60) {
      if (this.refreshToken) {
        await this.refreshAppToken();
      } else {
        await this.requestNewAppToken();
      }
    }

    return this.accessToken!;
  }

  private async requestNewAppToken(): Promise<void> {
    this.logger.log(
      'Requesting new client_credentials token from Leader ID...',
    );
    const { data } = await axios.post(this.tokenUrl, {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    this.updateTokens(data);
  }

  private async refreshAppToken(): Promise<void> {
    try {
      this.logger.log('Refreshing Leader ID app token...');
      const { data } = await axios.post(this.tokenUrl, {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
      });

      this.updateTokens(data);
    } catch (e) {
      this.logger.warn('Refresh failed, requesting new token...');
      await this.requestNewAppToken();
    }
  }

  private updateTokens(data: any): void {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    // Leader ID обычно выдает токен на 7 дней
    this.expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    this.logger.log('Leader ID app token updated successfully');
  }
}
