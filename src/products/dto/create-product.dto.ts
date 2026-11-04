import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  IsUUID,
  IsLatitude,
  IsLongitude,
  MaxLength,
  Min,
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

export class ProductVariantDto {
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ServiceDetailsDto {
  @ApiProperty({
    enum: ['fixed', 'per_hour', 'per_sqm', 'quote_required'],
    example: 'per_sqm',
  })
  @IsIn(['fixed', 'per_hour', 'per_sqm', 'quote_required'])
  pricing_type: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(15)
  estimated_duration_minutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requires_site_visit?: boolean;
}

export class RealEstateDetailsDto {
  @ApiProperty({ enum: ['house', 'apartment', 'land', 'commercial'] })
  @IsIn(['house', 'apartment', 'land', 'commercial'])
  property_type: string;

  @ApiProperty({ enum: ['sale', 'rent'] })
  @IsIn(['sale', 'rent'])
  transaction_type: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 120.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  area_sqm?: number;

  @ApiProperty({ example: 'Talatona, Luanda' })
  @IsString()
  @IsNotEmpty()
  location_address: string;

  @ApiPropertyOptional({ example: -8.915 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 13.185 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
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
  @Min(0)
  price: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
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
  @Min(0)
  shipping_cost?: number;

  // ---------------------------------------------------------------------------
  // Fase 3 — tipo de produto
  // ---------------------------------------------------------------------------

  @ApiPropertyOptional({
    enum: ['physical', 'rental', 'food', 'service'],
    example: 'physical',
  })
  @IsOptional()
  @IsIn(['physical', 'rental', 'food', 'service'])
  product_type?: string;

  @ApiPropertyOptional({ enum: ['hourly', 'daily', 'monthly'] })
  @IsOptional()
  @IsIn(['hourly', 'daily', 'monthly'])
  rental_period_type?: string;

  @ApiPropertyOptional({ example: 20000, description: 'Caução do aluguer' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  security_deposit?: number;

  @ApiPropertyOptional({ enum: ['new', 'used', 'refurbished'] })
  @IsOptional()
  @IsIn(['new', 'used', 'refurbished'])
  condition_type?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requires_towing?: boolean;

  @ApiPropertyOptional({ type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({ type: ServiceDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceDetailsDto)
  service_details?: ServiceDetailsDto;

  @ApiPropertyOptional({ type: RealEstateDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RealEstateDetailsDto)
  real_estate_details?: RealEstateDetailsDto;

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
