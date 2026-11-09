import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ProfessionalSpecialty } from './entities/professional-specialty.entity.js';
import { ProviderSpecialty } from './entities/provider-specialty.entity.js';
import { ProviderPortfolioItem } from './entities/provider-portfolio-item.entity.js';
import { ServiceQuoteRequest, ServiceQuoteStatus } from './entities/service-quote-request.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';

import {
  CreateProfessionalSpecialtyDto,
  UpdateProfessionalSpecialtyDto,
} from './dto/create-professional-specialty.dto.js';
import { AssignSpecialtiesDto } from './dto/specialty-assign.dto.js';
import {
  CreatePortfolioItemDto,
  UpdatePortfolioItemDto,
} from './dto/create-portfolio-item.dto.js';
import {
  CreateServiceQuoteRequestDto,
  UpdateServiceQuoteRequestDto,
  AcceptQuoteRequestDto,
  RejectQuoteRequestDto,
  ProviderQuoteRequestDto,
  QuoteStateChangeDto,
  ListQuoteRequestsQueryDto,
} from './dto/create-quote-request.dto.js';
interface StoreWithOwner {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  status: string;
  city?: string | null;
}

class SpecialtyShape {
  id: number;
  name: string;
  icon_url?: string | null;
  description?: string | null;
}

@Injectable()
export class ProfessionalSpecialtiesService {
  private readonly logger = new Logger(ProfessionalSpecialtiesService.name);

  constructor(
    @InjectRepository(ProfessionalSpecialty)
    private readonly specialtyRepository: Repository<ProfessionalSpecialty>,
    @InjectRepository(ProviderSpecialty)
    private readonly providerSpecialtyRepository: Repository<ProviderSpecialty>,
    @InjectRepository(ProviderPortfolioItem)
    private readonly portfolioRepository: Repository<ProviderPortfolioItem>,
    @InjectRepository(ServiceQuoteRequest)
    private readonly quoteRequestRepository: Repository<ServiceQuoteRequest>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // -------------------------------------------------------------------------
  // Professional specialties
  // -------------------------------------------------------------------------

  async listSpecialties(includeInactive = false) {
    const where: any = includeInactive ? {} : { is_active: true };

    return this.specialtyRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getSpecialtyById(id: number) {
    const specialty = await this.specialtyRepository.findOne({
      where: { id },
    });

    if (!specialty) {
      throw new NotFoundException('Especialidade não encontrada');
    }

    return specialty;
  }

  async createSpecialty(dto: CreateProfessionalSpecialtyDto) {
    const existing = await this.specialtyRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('Já existe uma especialidade com este nome');
    }

    const specialty = this.specialtyRepository.create({
      ...dto,
      is_active: true,
    });

    return this.specialtyRepository.save(specialty);
  }

  async createQuoteRequestForCustomer(
    customerId: string,
    dto: CreateServiceQuoteRequestDto,
  ) {
    const store = await this.storeRepository.findOne({
      where: { id: dto.store_id, status: 'active' },
    });

    if (!store) {
      throw new BadRequestException('Loja não encontrada ou inativa');
    }

    const specialty = dto.specialty_id
      ? await this.specialtyRepository.findOne({ where: { id: dto.specialty_id } })
      : null;

    if (dto.specialty_id && !specialty) {
      throw new BadRequestException('Especialidade não encontrada');
    }

    const quote = this.quoteRequestRepository.create({
      customer_id: customerId,
      store_id: store.id,
      specialty_id: specialty?.id ?? null,
      title: dto.title,
      description: dto.description,
      photo_url: dto.photo_url ?? null,
      address: dto.address,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      status: 'pending',
    });

    return this.quoteRequestRepository.save(quote);
  }

  async updateSpecialty(id: number, dto: UpdateProfessionalSpecialtyDto) {
    const specialty = await this.getSpecialtyById(id);

    if (dto.name && dto.name !== specialty.name) {
      const existing = await this.specialtyRepository.findOne({
        where: { name: dto.name },
      });

      if (existing) {
        throw new BadRequestException(
          'Já existe uma especialidade com este nome',
        );
      }
    }

    specialty.name = dto.name ?? specialty.name;
    specialty.icon_url = dto.icon_url ?? specialty.icon_url;
    specialty.description = dto.description ?? specialty.description;
    specialty.is_active = dto.is_active ?? specialty.is_active;

    return this.specialtyRepository.save(specialty);
  }

  async deleteSpecialty(id: number) {
    const specialty = await this.getSpecialtyById(id);

    const linked = await this.providerSpecialtyRepository.count({
      where: { specialty_id: id },
    });

    if (linked > 0) {
      throw new BadRequestException(
        'Não é possível eliminar uma especialidade associada a lojas',
      );
    }

    await this.specialtyRepository.remove(specialty);

    return { message: 'Especialidade eliminada com sucesso' };
  }

  // -------------------------------------------------------------------------
  // Provider specialties (store <-> specialty)
  // -------------------------------------------------------------------------

  async getStoreSpecialties(storeId: string) {
    await this.getStoreOrFail(storeId);

    const links = await this.providerSpecialtyRepository.find({
      where: { store_id: storeId, is_active: true },
      relations: ['specialty'],
      order: { specialty: { name: 'ASC' } },
    });

    return links.map((link) => ({
      specialty_id: link.specialty_id,
      specialty_name: link.specialty?.name ?? null,
      icon_url: link.specialty?.icon_url ?? null,
      description: link.specialty?.description ?? null,
      is_active: link.is_active,
    }));
  }

  async assignSpecialtiesToStore(
    storeId: string,
    userId: string,
    dto: AssignSpecialtiesDto,
    requireOwnership = true,
  ) {
    let store: StoreWithOwner;

    if (requireOwnership) {
      store = await this.getStoreOwnedBy(storeId, userId);
    } else {
      store = await this.getStoreOrFail(storeId, ['owner']);
    }

    const specialties = await this.specialtyRepository.find({
      where: { id: In(dto.specialty_ids) },
    });

    if (specialties.length !== dto.specialty_ids.length) {
      const foundIds = specialties.map((s) => s.id);
      const missing = dto.specialty_ids.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Especialidades não encontradas: ${missing.join(', ')}`,
      );
    }

    await this.providerSpecialtyRepository.createQueryBuilder()
      .delete()
      .where('store_id = :storeId', { storeId })
      .execute();

    if (dto.specialty_ids.length > 0) {
      await this.providerSpecialtyRepository.save(
        dto.specialty_ids.map((specialty_id) =>
          this.providerSpecialtyRepository.create({
            store_id: storeId,
            specialty_id,
            is_active: true,
          }),
        ),
      );
    }

    const count = dto.specialty_ids.length;

    return {
      message: 'Especialidades atribuídas com sucesso',
      count,
    };
  }

  async removeSpecialtyFromStore(
    storeId: string,
    userId: string,
    specialtyId: number,
    requireOwnership = true,
  ) {
    await this.getStoreOrFail(storeId);
    await this.specialtyRepository.findOneOrFail({ where: { id: specialtyId } });

    if (requireOwnership) {
      await this.getStoreOwnedBy(storeId, userId);
    }

    const link = await this.providerSpecialtyRepository.findOne({
      where: { store_id: storeId, specialty_id: specialtyId },
    });

    if (!link) {
      throw new NotFoundException(
        'Especialidade não associada a esta loja',
      );
    }

    await this.providerSpecialtyRepository.remove(link);

    return { message: 'Especialidade removida da loja' };
  }

  async getStoresBySpecialtyId(specialtyId: number, activeOnly = true) {
    await this.specialtyRepository.findOneOrFail({ where: { id: specialtyId } });

    const qb = this.providerSpecialtyRepository
      .createQueryBuilder('ps')
      .innerJoinAndSelect('ps.store', 'store')
      .where('ps.specialty_id = :specialtyId', { specialtyId });

    if (activeOnly) {
      qb.andWhere('ps.is_active = :active', { active: true });
      qb.andWhere('store.status = :storeStatus', { storeStatus: 'active' });
    }

    const links = await qb.getMany();

    return links.map((link) => ({
      store_id: link.store_id,
      store_name: link.store?.name ?? null,
      city: link.store?.city ?? null,
      is_active: link.is_active,
    }));
  }

  // -------------------------------------------------------------------------
  // Provider portfolio
  // -------------------------------------------------------------------------

  async getStorePortfolio(storeId: string) {
    await this.getStoreOrFail(storeId);

    return this.portfolioRepository.find({
      where: { store_id: storeId },
      order: { created_at: 'DESC' },
    });
  }

  async addPortfolioItem(
    storeId: string,
    userId: string,
    dto: CreatePortfolioItemDto,
    requireOwnership = true,
  ) {
    let store: StoreWithOwner;

    if (requireOwnership) {
      store = await this.getStoreOwnedBy(storeId, userId);
    } else {
      store = await this.getStoreOrFail(storeId);
    }

    const item = this.portfolioRepository.create({
      ...dto,
      store_id: storeId,
    });

    return this.portfolioRepository.save(item);
  }

  async updatePortfolioItem(
    storeId: string,
    userId: string,
    portfolioId: string,
    dto: UpdatePortfolioItemDto,
    requireOwnership = true,
  ) {
    let store: StoreWithOwner;

    if (requireOwnership) {
      store = await this.getStoreOwnedBy(storeId, userId);
    } else {
      store = await this.getStoreOrFail(storeId);
    }

    const item = await this.portfolioRepository.findOne({
      where: { id: portfolioId, store_id: storeId },
    });

    if (!item) {
      throw new NotFoundException('Item do portfólio não encontrado');
    }

    Object.assign(item, dto);
    return this.portfolioRepository.save(item);
  }

  async deletePortfolioItem(
    storeId: string,
    userId: string,
    portfolioId: string,
    requireOwnership = true,
  ) {
    if (requireOwnership) {
      await this.getStoreOwnedBy(storeId, userId);
    } else {
      await this.getStoreOrFail(storeId);
    }

    const item = await this.portfolioRepository.findOne({
      where: { id: portfolioId, store_id: storeId },
    });

    if (!item) {
      throw new NotFoundException('Item do portfólio não encontrado');
    }

    await this.portfolioRepository.remove(item);

    return { message: 'Item do portfólio eliminado' };
  }

  // -------------------------------------------------------------------------
  // Service quote requests
  // -------------------------------------------------------------------------

  async listQuoteRequests(query: ListQuoteRequestsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: any = {};

    if (query.status) {
      where.status = query.status as ServiceQuoteStatus;
    }

    if (query.customer_id) {
      where.customer_id = query.customer_id;
    }

    if (query.store_id) {
      where.store_id = query.store_id;
    }

    const [items, total] = await this.quoteRequestRepository.findAndCount({
      where,
      relations: ['store', 'specialty'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: items.map(this.toQuoteResponse),
      total,
      page,
      limit,
    };
  }

  async getQuoteRequestById(id: string, userId?: string) {
    const quote = await this.quoteRequestRepository.findOne({
      where: { id },
      relations: ['store', 'specialty'],
    });

    if (!quote) {
      throw new NotFoundException('Pedido de orçamento não encontrado');
    }

    if (userId) {
      const store = quote.store as StoreWithOwner | null;

      if (!store) {
        throw new NotFoundException('Pedido de orçamento não tem loja atribuída');
      }

      const isOwner =
        store.owner_id === userId ||
        (await this.isUserAdmin(userId));

      if (!isOwner) {
        const isCustomer = quote.customer_id === userId;

        if (!isCustomer) {
          throw new ForbiddenException(
            'Não tem acesso a este pedido de orçamento',
          );
        }
      }
    }

    return this.toQuoteResponse(quote);
  }

  async getQuoteRequestsByStore(
    storeId: string,
    userId: string,
    query: ListQuoteRequestsQueryDto,
  ) {
    await this.getStoreOwnedBy(storeId, userId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: any = { store_id: storeId };

    if (query.status) {
      where.status = query.status as ServiceQuoteStatus;
    }

    const [items, total] = await this.quoteRequestRepository.findAndCount({
      where,
      relations: ['store', 'specialty'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: items.map(this.toQuoteResponse),
      total,
      page,
      limit,
    };
  }

  async updateQuoteRequest(
    id: string,
    userId: string,
    dto: UpdateServiceQuoteRequestDto,
  ) {
    const quote = await this.getAccessibleQuote(id, userId);

    if (!quote.store) {
      throw new NotFoundException('Pedido de orçamento não tem loja atribuída');
    }

    const storeWithOwner = quote.store as StoreWithOwner;
    const isProvider = storeWithOwner.owner_id === userId;
    const isAdmin = await this.isUserAdmin(userId);

    if (!isProvider && !isAdmin) {
      throw new ForbiddenException(
        'Apenas a loja ou um administrador pode atualizar este pedido',
      );
    }

    return this.applyQuoteUpdate(quote, dto);
  }

  async providerSubmitQuote(
    id: string,
    userId: string,
    dto: ProviderQuoteRequestDto,
  ) {
    const quote = await this.getAccessibleQuote(id, userId);

    if (!quote.store) {
      throw new NotFoundException('Pedido de orçamento não tem loja atribuída');
    }

    const storeWithOwner = quote.store as StoreWithOwner;

    if (storeWithOwner.owner_id !== userId) {
      throw new ForbiddenException(
        'Só a loja responsável pode enviar uma proposta',
      );
    }

    if (quote.status !== 'pending') {
      throw new BadRequestException(
        'Apenas pedidos com estado pending podem ser cotados',
      );
    }

    const update: Partial<ServiceQuoteRequest> = {
      status: 'quoted',
      proposed_price: dto.proposed_price,
    };

    if (dto.admin_or_provider_notes != null) {
      update.admin_or_provider_notes = dto.admin_or_provider_notes;
    }

    if (dto.scheduled_date) {
      update.scheduled_date = new Date(dto.scheduled_date);
    }

    if (dto.scheduled_time) {
      update.scheduled_time = new Date(
        `1970-01-01T${dto.scheduled_time}:00Z`,
      );
    }

    Object.assign(quote, update);
    await this.quoteRequestRepository.save(quote);

    return this.toQuoteResponse(quote);
  }

  async acceptQuoteRequest(id: string, userId: string, dto: AcceptQuoteRequestDto) {
    const quote = await this.getAccessibleQuote(id, userId);

    if (quote.customer_id !== userId) {
      throw new ForbiddenException(
        'Só o cliente que criou o pedido pode aceitar o orçamento',
      );
    }

    if (quote.status !== 'quoted') {
      throw new BadRequestException(
        'Apenas orçamentos com status "quoted" podem ser aceites',
      );
    }

    quote.status = 'accepted';
    quote.scheduled_date = new Date(dto.scheduled_date);
    quote.scheduled_time = new Date(
      `1970-01-01T${dto.scheduled_time}:00Z`,
    );

    await this.quoteRequestRepository.save(quote);

    return {
      id: quote.id,
      status: quote.status,
      scheduled_date: quote.scheduled_date?.toISOString().slice(0, 10),
      scheduled_time: quote.scheduled_time
        ? quote.scheduled_time.toTimeString().slice(0, 5)
        : null,
      message: 'Orçamento aceite e agendado com sucesso',
    };
  }

  async rejectQuoteRequest(id: string, userId: string, dto: RejectQuoteRequestDto) {
    const quote = await this.getAccessibleQuote(id, userId);

    if (quote.customer_id !== userId) {
      throw new ForbiddenException(
        'Só o cliente que criou o pedido pode recusar o orçamento',
      );
    }

    if (['accepted', 'rejected', 'completed', 'cancelled'].includes(quote.status)) {
      throw new BadRequestException(
        'Este pedido já não pode ser recusado',
      );
    }

    quote.status = 'rejected';

    if (dto.reason != null) {
      quote.admin_or_provider_notes = dto.reason;
      quote.reject_reason = dto.reason;
    }

    await this.quoteRequestRepository.save(quote);

    return {
      id: quote.id,
      status: quote.status,
      message: 'Orçamento recusado pelo cliente',
    };
  }

  async changeQuoteState(id: string, userId: string, dto: QuoteStateChangeDto) {
    const quote = await this.getAccessibleQuote(id, userId);

    if (!quote.store) {
      throw new NotFoundException('Pedido de orçamento não tem loja atribuída');
    }

    const storeWithOwner = quote.store as StoreWithOwner;

    if (storeWithOwner.owner_id !== userId) {
      throw new ForbiddenException(
        'Só a loja responsável pode alterar o estado do serviço',
      );
    }

    if (!['in_progress', 'completed'].includes(dto.status)) {
      throw new BadRequestException(
        'Estado inválido. Use in_progress ou completed',
      );
    }

    quote.status = dto.status as ServiceQuoteStatus;

    await this.quoteRequestRepository.save(quote);

    return {
      id: quote.id,
      status: quote.status,
      message: `Estado atualizado para '${quote.status}'`,
    };
  }

  async listQuoteRequestsByCustomer(
    customerId: string,
    page = 1,
    limit = 20,
    activeOnly = true,
  ) {
    const qb = this.quoteRequestRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.store', 'store')
      .leftJoinAndSelect('q.specialty', 'specialty')
      .where('q.customer_id = :customerId', { customerId });

    if (activeOnly) {
      qb.andWhere(
        "q.status NOT IN ('cancelled', 'completed')",
      );
    }

    qb.orderBy('q.created_at', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async getStoreOrFail(
    storeId: string,
    relations?: string[],
  ): Promise<StoreWithOwner> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations,
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    return store as StoreWithOwner;
  }

  private async getStoreOwnedBy(
    storeId: string,
    userId: string,
  ): Promise<StoreWithOwner> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId, owner_id: userId },
    });

    if (!store) {
      throw new ForbiddenException(
        'Esta loja não pertence ao utilizador autenticado',
      );
    }

    return store as StoreWithOwner;
  }

  private async isUserAdmin(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['user_type'],
    });

    return user?.user_type === 'admin';
  }

  private async getAccessibleQuote(id: string, userId: string) {
    const quote = await this.quoteRequestRepository.findOne({
      where: { id },
      relations: ['store', 'specialty'],
    });

    if (!quote) {
      throw new NotFoundException('Pedido de orçamento não encontrado');
    }

    const store = quote.store as StoreWithOwner | null;
    const isAdmin = await this.isUserAdmin(userId);

    const isCustomer = quote.customer_id === userId;
    const isProvider = store?.owner_id === userId;

    if (!isAdmin && !isCustomer && !isProvider) {
      throw new ForbiddenException(
        'Não tem acesso a este pedido de orçamento',
      );
    }

    return quote;
  }

  private async applyQuoteUpdate(
    quote: ServiceQuoteRequest,
    dto: UpdateServiceQuoteRequestDto,
  ) {
    if (dto.status) {
      quote.status = dto.status as ServiceQuoteStatus;
    }

    if (dto.proposed_price != null) {
      quote.proposed_price = dto.proposed_price;
    }

    if (dto.admin_or_provider_notes != null) {
      quote.admin_or_provider_notes = dto.admin_or_provider_notes;
    }

    if (dto.scheduled_date) {
      quote.scheduled_date = new Date(dto.scheduled_date);
    }

    if (dto.scheduled_time) {
      quote.scheduled_time = new Date(
        `1970-01-01T${dto.scheduled_time}:00Z`,
      );
    }

    await this.quoteRequestRepository.save(quote);

    return this.toQuoteResponse(quote);
  }

  private toQuoteResponse(quote: ServiceQuoteRequest) {
    const store = quote.store as StoreWithOwner | undefined;
    const specialty = quote.specialty as ProfessionalSpecialty | undefined;

    return {
      id: quote.id,
      customer: null,
      store: store
        ? {
            id: store.id,
            name: store.name,
            slug: store.slug,
          }
        : null,
      specialty: specialty
        ? {
            id: specialty.id,
            name: specialty.name,
            icon_url: specialty.icon_url ?? null,
            description: specialty.description ?? null,
          }
        : null,
      title: quote.title,
      description: quote.description,
      photo_url: quote.photo_url,
      address: quote.address,
      latitude: quote.latitude,
      longitude: quote.longitude,
      status: quote.status,
      proposed_price: quote.proposed_price,
      admin_or_provider_notes: quote.admin_or_provider_notes,
      scheduled_date: quote.scheduled_date
        ? quote.scheduled_date.toISOString().slice(0, 10)
        : null,
      scheduled_time: quote.scheduled_time
        ? quote.scheduled_time.toTimeString().slice(0, 5)
        : null,
      created_at: quote.created_at,
    };
  }
}
