import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  IsUrl,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdvertisementDto {
  @ApiProperty({ example: 1, description: 'ID do plano de publicidade' })
  @IsNumber()
  @IsNotEmpty()
  ad_plan_id: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID do produto associado (opcional)',
  })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiProperty({
    example: 'Promoção de Verão - 50% OFF',
    description: 'Título do anúncio',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({
    example: 'https://example.com/ad-banner.jpg',
    description: 'URL da mídia (imagem JPG/PNG, vídeo MP4, panfleto)',
  })
  @IsOptional()
  @IsUrl({}, { message: 'media_url deve ser uma URL válida' })
  media_url?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/promocao',
    description: 'URL de destino ao clicar no anúncio',
  })
  @IsOptional()
  @IsUrl({}, { message: 'target_url deve ser uma URL válida' })
  target_url?: string;

  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Data de início do anúncio (formato ISO 8601)',
  })
  @IsDateString({}, { message: 'start_date deve ser uma data válida em formato ISO 8601' })
  @IsNotEmpty()
  start_date: string;
}