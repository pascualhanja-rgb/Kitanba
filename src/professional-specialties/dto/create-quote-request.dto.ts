import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsIn,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const QUOTE_STATUSES = [
  'pending',
  'quoted',
  'accepted',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export class CreateServiceQuoteRequestDto {
  @ApiProperty({ example: 'store-uuid' })
  @IsUUID()
  store_id: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  specialty_id?: number;

  @ApiProperty({ example: 'Fuga de água na cozinha' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 'Preciso trocar a tubagem que está a pingar.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/photos/fuga.jpg' })
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiProperty({ example: 'Rua Talatona, Luanda' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ example: -8.84 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 13.23 })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateServiceQuoteRequestDto {
  @ApiPropertyOptional({ enum: QUOTE_STATUSES })
  @IsOptional()
  @IsIn(QUOTE_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: 85000 })
  @IsOptional()
  @IsNumber()
  proposed_price?: number;

  @ApiPropertyOptional({ example: 'Visita técnica realizada. Orçamento apresentado ao cliente.' })
  @IsOptional()
  @IsString()
  admin_or_provider_notes?: string;

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @IsString()
  scheduled_date?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  scheduled_time?: string;
}

export class AcceptQuoteRequestDto {
  @ApiProperty({ example: '2026-11-10' })
  @IsString()
  @IsNotEmpty()
  scheduled_date: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  scheduled_time: string;
}

export class RejectQuoteRequestDto {
  @ApiPropertyOptional({ example: 'Cliente optou por outro profissional' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProviderQuoteRequestDto {
  @ApiProperty({ example: 85000 })
  @IsNumber()
  proposed_price: number;

  @ApiPropertyOptional({ example: 'Visita técnica necessária. Preço contem prismas de materiais e mão de obra.' })
  @IsOptional()
  @IsString()
  admin_or_provider_notes?: string;

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @IsString()
  scheduled_date?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  scheduled_time?: string;
}

export class QuoteStateChangeDto {
  @ApiProperty({ enum: ['in_progress', 'completed'] })
  @IsIn(['in_progress', 'completed'])
  status: string;
}

export class ListQuoteRequestsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ enum: QUOTE_STATUSES })
  @IsOptional()
  @IsIn(QUOTE_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: 'customer-uuid' })
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({ example: 'store-uuid' })
  @IsOptional()
  @IsUUID()
  store_id?: string;
}
