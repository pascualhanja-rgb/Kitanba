import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantDto {
  @ApiProperty({ example: 'Tamanho: G / Cor: Vermelho' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additional_price?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number;
}

export class UpdateVariantDto {
  @ApiPropertyOptional({ example: 'Tamanho: M' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additional_price?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
