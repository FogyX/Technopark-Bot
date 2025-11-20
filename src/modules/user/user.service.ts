import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findByTelegramId(id: string) {
    return this.userRepo.findOne({ where: { telegram_id: id } });
  }

  async createOrUpdateFromTelegram(ctxUser) {
    const existing = await this.findByTelegramId(ctxUser.id);

    if (!existing) {
      const data = {
        telegram_id: ctxUser.id,
        username: ctxUser.username,
      };
      return await this.userRepo.save(this.userRepo.create(data));
    }

    return existing;
  }

  async updateProfile({
    telegramId,
    leaderId,
    accessToken,
    refreshToken,
    expiresAt,
    username,
    firstName,
    lastName,
    phone,
    email,
  }: {
    telegramId: string;
    leaderId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    username?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  }) {
    const user = await this.findByTelegramId(telegramId);
    if (!user) throw new Error('User not found');

    user.leader_id = leaderId;
    user.leader_id_access_token = accessToken;
    user.leader_id_refresh_token = refreshToken;
    user.leader_id_expires_at = expiresAt;
    user.username = username ?? user.username;
    user.first_name = firstName ?? user.first_name;
    user.last_name = lastName ?? user.last_name;
    user.phone = phone ?? user.phone;
    user.email = email ?? user.email;

    return this.userRepo.save(user);
  }

  async isSubscribed(userTelegramId: string) {
    const user = await this.findByTelegramId(userTelegramId);
    return user.is_subscribed;
  }

  async setSubscription(userTelegramId: string, value: boolean) {
    const user = await this.findByTelegramId(userTelegramId);

    user.is_subscribed = value;
    await this.userRepo.save(user);
  }

  async getAllSubscribedUsers() {
    return await this.userRepo.findBy({
      is_subscribed: true,
    });
  }
}
