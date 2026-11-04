import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cart } from './entities/cart.entity.js';
import { CartItem } from './entities/cart-item.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { ProductVariant } from '../products/entities/product-variant.entity.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
  ) {}

  /**
   * Obter (ou criar) o carrinho do cliente
   */
  private async getOrCreateCart(customerId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { customer_id: customerId },
    });

    if (!cart) {
      cart = await this.cartRepository.save(
        this.cartRepository.create({ customer_id: customerId }),
      );
    }

    return cart;
  }

  /**
   * Formatação de valores + totais calculados no servidor
   */
  private async buildResponse(cart: Cart) {
    const items = await this.cartItemRepository.find({
      where: { cart_id: cart.id },
      relations: ['product', 'product.images', 'variant'],
      order: { created_at: 'ASC' },
    });

    let subtotal = 0;
    let shippingTotal = 0;

    const formattedItems = items.map((item) => {
      const product = item.product as any;
      const variant = item.variant as any;

      const basePrice = Number(product?.price ?? 0);
      const unitPrice = Number(
        (basePrice + Number(variant?.additional_price ?? 0)).toFixed(2),
      );
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));

      subtotal += lineTotal;

      if (product?.shipping_type === 'paid') {
        shippingTotal = Math.max(shippingTotal, Number(product.shipping_cost ?? 0));
      }

      return {
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        variant_name: variant?.name ?? null,
        quantity: item.quantity,
        unit_price: unitPrice,
        special_instructions: item.special_instructions,
        line_total: lineTotal,
        product: product
          ? {
              id: product.id,
              title: product.title,
              store_id: product.store_id,
              price: basePrice,
              product_type: product.product_type,
              stock_quantity: Number(product.stock_quantity ?? 0),
              shipping_type: product.shipping_type,
              images: product.images,
            }
          : null,
      };
    });

    return {
      id: cart.id,
      customer_id: cart.customer_id,
      updated_at: cart.updated_at,
      items: formattedItems,
      subtotal: Number(subtotal.toFixed(2)),
      shipping_total: Number(shippingTotal.toFixed(2)),
      total_amount: Number((subtotal + shippingTotal).toFixed(2)),
    };
  }

  /**
   * Carrinho atual do cliente
   */
  async getCart(customerId: string) {
    const cart = await this.getOrCreateCart(customerId);
    return this.buildResponse(cart);
  }

  /**
   * Adicionar item (soma quantidade se já existir o mesmo produto/variante/instruções)
   */
  async addItem(customerId: string, dto: AddCartItemDto) {
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, is_active: true },
    });

    if (!product) {
      throw new BadRequestException('Produto indisponível');
    }

    if (product.product_type === 'service') {
      throw new BadRequestException(
        'Produtos do tipo service devem ser agendados',
      );
    }

    if (product.product_type === 'rental') {
      throw new BadRequestException(
        'Produtos do tipo rental devem ser alugados via /rentals',
      );
    }

    let variant: ProductVariant | null = null;

    if (dto.variant_id) {
      variant = await this.variantRepository.findOne({
        where: { id: dto.variant_id },
      });

      if (!variant || variant.product_id !== product.id) {
        throw new BadRequestException(
          'Variante não pertence a este produto',
        );
      }

      if (!variant.is_active) {
        throw new BadRequestException('Variante indisponível');
      }
    }

    const cart = await this.getOrCreateCart(customerId);

    const instructions = dto.special_instructions
      ? sanitizeHtml(dto.special_instructions)
      : null;

    const existing = await this.cartItemRepository.findOne({
      where: {
        cart_id: cart.id,
        product_id: product.id,
        variant_id: variant ? variant.id : null,
        special_instructions: instructions,
      } as any,
    });

    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;
    const available = variant
      ? Number(variant.stock_quantity)
      : Number(product.stock_quantity);

    if (newQuantity > available) {
      throw new BadRequestException(
        variant
          ? `Estoque insuficiente para a variante: ${variant.name}`
          : `Estoque insuficiente para o produto: ${product.title}`,
      );
    }

    if (existing) {
      existing.quantity = newQuantity;
      await this.cartItemRepository.save(existing);
    } else {
      await this.cartItemRepository.save(
        this.cartItemRepository.create({
          cart_id: cart.id,
          product_id: product.id,
          variant_id: variant ? variant.id : null,
          quantity: dto.quantity,
          special_instructions: instructions,
        }),
      );
    }

    await this.touch(cart.id);

    this.logger.log(
      `Item adicionado ao carrinho ${cart.id} (produto ${product.id})`,
    );

    return this.getCart(customerId);
  }

  /**
   * Atualizar quantidade/instruções de um item
   */
  async updateItem(customerId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: ['cart', 'product', 'variant'],
    });

    if (!item) {
      throw new NotFoundException('Item do carrinho não encontrado');
    }

    if ((item.cart as Cart).customer_id !== customerId) {
      throw new ForbiddenException('Sem permissão para este item');
    }

    if (dto.quantity !== undefined) {
      const available = item.variant_id
        ? Number((item.variant as any)?.stock_quantity ?? 0)
        : Number((item.product as any)?.stock_quantity ?? 0);

      if (dto.quantity > available) {
        throw new BadRequestException('Estoque insuficiente');
      }

      item.quantity = dto.quantity;
    }

    if (dto.special_instructions !== undefined) {
      item.special_instructions = dto.special_instructions
        ? sanitizeHtml(dto.special_instructions)
        : null;
    }

    await this.cartItemRepository.save(item);
    await this.touch((item.cart as Cart).id);

    return this.getCart(customerId);
  }

  /**
   * Remover um item
   */
  async removeItem(customerId: string, itemId: string) {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: ['cart'],
    });

    if (!item) {
      throw new NotFoundException('Item do carrinho não encontrado');
    }

    if ((item.cart as Cart).customer_id !== customerId) {
      throw new ForbiddenException('Sem permissão para este item');
    }

    await this.cartItemRepository.remove(item);
    await this.touch((item.cart as Cart).id);

    return this.getCart(customerId);
  }

  /**
   * Esvaziar carrinho
   */
  async clear(customerId: string) {
    const cart = await this.getOrCreateCart(customerId);
    await this.cartItemRepository.delete({ cart_id: cart.id });
    await this.touch(cart.id);

    return this.getCart(customerId);
  }

  private async touch(cartId: string) {
    await this.cartRepository.update({ id: cartId }, { updated_at: new Date() });
  }
}
