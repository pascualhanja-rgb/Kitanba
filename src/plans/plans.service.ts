import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SellerPlan } from './entities/seller-plan.entity.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(SellerPlan)
    private readonly planRepository: Repository<SellerPlan>,
  ) {}

  /**
   * Listar todos os planos ativos
   */
  async findAll() {
    return this.planRepository.find({
      where: { is_active: true },
      order: { monthly_price: 'ASC' },
    });
  }

  /**
   * Listar todos os planos (Admin)
   */
  async findAllAdmin() {
    return this.planRepository.find({
      order: { monthly_price: 'ASC' },
    });
  }

  /**
   * Obter plano por ID
   */
  async findOne(id: number): Promise<SellerPlan> {
    const plan = await this.planRepository.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return plan;
  }

  /**
   * Criar novo plano (Admin)
   */
  async create(createPlanDto: CreatePlanDto): Promise<SellerPlan> {
    const plan = this.planRepository.create(createPlanDto);
    const saved = await this.planRepository.save(plan);

    this.logger.log(`Novo plano criado: ${saved.name}`);

    return saved;
  }

  /**
   * Atualizar plano (Admin)
   */
  async update(id: number, updatePlanDto: UpdatePlanDto): Promise<SellerPlan> {
    const plan = await this.findOne(id);

    Object.assign(plan, updatePlanDto);
    const saved = await this.planRepository.save(plan);

    this.logger.log(`Plano ${id} atualizado`);

    return saved;
  }

  /**
   * Desativar plano (Admin)
   */
  async deactivate(id: number) {
    const plan = await this.findOne(id);

    plan.is_active = false;
    await this.planRepository.save(plan);

    this.logger.log(`Plano ${id} desativado`);

    return { message: 'Plano desativado com sucesso' };
  }
}
