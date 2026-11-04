import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsNotEmpty,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ example: 'uuid-produto' })
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({ example: 'uuid-variante' })
  @IsOptional()
  @IsUUID()
  variant_id?: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Sem cebola' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  special_instructions?: string;
}

export class UpdateCartItemDto {
  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 'Sem cebola' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  special_instructions?: string;
}

export class CartProductRefDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  product_id: string;
}
