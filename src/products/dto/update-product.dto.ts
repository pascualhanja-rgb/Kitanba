import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto.js';

/**
 * Atualização parcial do produto. `product_type` só pode mudar enquanto o
 * produto não tiver pedidos/alugueres (validado no service).
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
