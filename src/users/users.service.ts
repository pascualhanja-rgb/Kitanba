import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Listar todos os utilizadores (Admin only)
   */
  async findAll(page = 1, limit = 20) {
    const [users, total] = await this.userRepository.findAndCount({
      select: ['id', 'name', 'email', 'phone', 'user_type', 'is_email_verified', 'created_at'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obter utilizador por ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'phone', 'avatar_url', 'document_url', 'user_type', 'is_email_verified', 'created_at'],
    });

    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    return user;
  }

  /**
   * Atualizar perfil do utilizador (apenas o próprio ou admin)
   */
  async update(id: string, updateUserDto: UpdateUserDto, currentUser: User) {
    // Verificar permissão
    if (currentUser.id !== id && currentUser.user_type !== 'admin') {
      throw new ForbiddenException('Sem permissão para atualizar este utilizador');
    }

    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    // Aplicar apenas campos permitidos (anti mass assignment)
    const allowedFields = ['name', 'phone', 'avatar_url', 'document_url'];
    const updates: any = {};

    for (const field of allowedFields) {
      if (updateUserDto[field] !== undefined) {
        updates[field] = updateUserDto[field];
      }
    }

    Object.assign(user, updates);
    const savedUser = await this.userRepository.save(user);

    this.logger.log(`Utilizador ${id} atualizado`);

    return {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
      phone: savedUser.phone,
      avatar_url: savedUser.avatar_url,
      user_type: savedUser.user_type,
    };
  }

  /**
   * Eliminar utilizador (Admin only)
   */
  async remove(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    await this.userRepository.remove(user);

    this.logger.log(`Utilizador ${id} eliminado`);

    return { message: 'Utilizador eliminado com sucesso' };
  }

  /**
   * Buscar utilizador por email (interno)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }
}
