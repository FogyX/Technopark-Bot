import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findByTelegramId(id: string) {
    return this.usersRepo.findOne({ where: { telegram_id: id } });
  }

  async createOrUpdateFromTelegram(ctxUser) {
    const existing = await this.findByTelegramId(ctxUser.id);

    const data = {
      telegram_id: ctxUser.id,
      username: ctxUser.username,
    };

    if (!existing) {
      return this.usersRepo.save(this.usersRepo.create(data));
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
    user.username = username;
    user.first_name = firstName;
    user.last_name = lastName;
    user.phone = phone;
    user.email = email;

    return this.usersRepo.save(user);
  }
}
