import type { UserRepository } from '@/repositories/user.repository';
import { hashPassword } from '@/utils/crypto';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';

export class UserService {
  constructor(private userRepo: UserRepository) {}

  async listUsers(shopId: string): Promise<ServiceResult<any[]>> {
    const users = await this.userRepo.listUsers(shopId);
    return success(users);
  }

  async inviteUser(
    shopId: string,
    data: { name: string; email: string; phone?: string; roleId: string }
  ): Promise<ServiceResult<any>> {
    const defaultPassword = 'password123';
    const passwordHash = await hashPassword(defaultPassword);
    const user = await this.userRepo.createUser(shopId, {
      ...data,
      passwordHash,
    });
    return success(user);
  }

  async updateUserRole(
    shopId: string,
    userId: string,
    data: { name?: string; phone?: string; roleId?: string }
  ): Promise<ServiceResult<any>> {
    const user = await this.userRepo.updateUserRole(shopId, userId, data);
    return success(user);
  }

  async deleteUser(shopId: string, userId: string): Promise<ServiceResult<void>> {
    await this.userRepo.deleteUser(shopId, userId);
    return success(undefined);
  }

  async listRoles(shopId: string): Promise<ServiceResult<any[]>> {
    const roles = await this.userRepo.listRoles(shopId);
    return success(roles);
  }
}
