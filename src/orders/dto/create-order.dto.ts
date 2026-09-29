import {
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ example: '3f8a9c1e-6b7d-4e2f-9a0b-1c2d3e4f5a6b' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: '44e1f3a2-9b0c-4d5e-8f7a-6b5c4d3e2f1a' })
  @IsUUID()
  store_id: string;

  @ApiProperty({ example: 'Rua 21 de Janeiro, Casa 45, Luanda' })
  @IsString()
  delivery_address: string;

  @ApiProperty({ example: -8.839 })
  @IsLatitude()
  delivery_latitude: number;

  @ApiProperty({ example: 13.289 })
  @IsLongitude()
  delivery_longitude: number;

  @ApiPropertyOptional({ example: 'Casa azul com portão branco' })
  @IsOptional()
  @IsString()
  delivery_notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
