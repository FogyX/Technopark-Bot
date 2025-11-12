import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LeaderIdApiService {
  async getUserProfile(userId: number, accessToken: string) {
    const resp = await axios.get(
      `https://apps.leader-id.ru/api/v1/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const data = resp.data;

    return {
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      phone: data.phones?.[0]?.phone ?? null,
      email: data.email ?? null,
    };
  }
}
