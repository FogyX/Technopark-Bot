import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LeaderIdAppTokenService } from './leader-id-app-token.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LeaderIdApiService {
  private readonly placeId: number;

  constructor(
    private readonly leaderIdAppTokenService: LeaderIdAppTokenService,
    private readonly configService: ConfigService,
  ) {
    this.placeId = this.configService.get('LEADERID_PLACE_ID');
  }

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

  async getEvents(
    page: number = 1,
    dateInterval?: { dateFrom: Date; dateTo: Date },
    query?: string,
  ) {
    const accessToken = await this.leaderIdAppTokenService.getAppAccessToken();
    const resp = await axios.get(
      `https://apps.leader-id.ru/api/v1/events/search`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          dateFrom: dateInterval?.dateFrom?.toISOString().split('T')[0],
          dateTo: dateInterval?.dateTo?.toISOString().split('T')[0],
          query,
          sort: 'date',
          paginationPage: page,
          paginationSize: 5,
          'placeIds[]': this.placeId,
          onlyActual: 1,
        },
      },
    );
    return resp.data;
  }

  async getEventInformation(eventId: number) {
    const accessToken = await this.leaderIdAppTokenService.getAppAccessToken();
    const resp = await axios.get(
      `https://apps.leader-id.ru/api/v1/events/?ids[]=${eventId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return resp.data;
  }

  async checkParticipation(eventId: number, userId: number) {
    const accessToken = await this.leaderIdAppTokenService.getAppAccessToken();
    const resp = await axios.get(
      `https://apps.leader-id.ru/api/v1/users/${userId}/event-participations`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const participation = resp.data.items.find(
      (p: any) => p.eventId === eventId,
    );

    return !!participation;
  }

  async sendParticipation(eventId: number, userId: number) {
    const accessToken = await this.leaderIdAppTokenService.getAppAccessToken();
    const resp = await axios.post(
      `https://apps.leader-id.ru/api/v1/users/${userId}/event-participations`,
      {
        eventId: eventId,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    return resp.data;
  }
}
