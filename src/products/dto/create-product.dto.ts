import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductImageDto {
  @ApiProperty({ example: 'https://example.com/product.jpg' })
  @IsString()
  @IsNotEmpty()
  url: string;
}

export class ProductAttributeValueDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  attribute_id: number;

  @ApiProperty({ example: 'XL' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro Max' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  title: string;

  @ApiPropertyOptional({ example: 'O melhor iPhone de todos os tempos' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  stock_quantity: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  category_id: number;

  @ApiProperty({ example: 'free', enum: ['free', 'paid'] })
  @IsString()
  @IsIn(['free', 'paid'])
  shipping_type: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  shipping_cost?: number;

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiPropertyOptional({ type: [ProductAttributeValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  attribute_values?: ProductAttributeValueDto[];
}
