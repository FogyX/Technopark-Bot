import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from 'src/entities/admin.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
  ) {}

  async checkIfIsAdmin(telegramId: string): Promise<boolean> {
    return (
      (await this.adminRepo.findOneBy({ telegram_id: telegramId })) !== null
    );
  }

  async createAdmin(telegramId: string) {
    return await this.adminRepo.save(
      this.adminRepo.create({ telegram_id: telegramId }),
    );
  }

  async getAdmins() {
    return await this.adminRepo.find();
  }
}
