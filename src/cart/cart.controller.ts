import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Ver o meu carrinho' })
  @ApiResponse({ status: 200, description: 'Carrinho com totais calculados' })
  async getCart(@CurrentUser() user: any) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  @ApiResponse({ status: 201, description: 'Carrinho atualizado' })
  @ApiResponse({ status: 400, description: 'Produto indisponível/estoque' })
  async addItem(@CurrentUser() user: any, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Atualizar quantidade/instruções de um item' })
  async updateItem(
    @CurrentUser() user: any,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remover item do carrinho' })
  async removeItem(
    @CurrentUser() user: any,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.cartService.removeItem(user.id, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Esvaziar carrinho' })
  async clear(@CurrentUser() user: any) {
    return this.cartService.clear(user.id);
  }
}
