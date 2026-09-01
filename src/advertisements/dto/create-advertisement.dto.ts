import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdvertisementDto {
  @ApiProperty({ example: 1, description: 'ID do plano de publicidade' })
  @IsNumber()
  ad_plan_id: number;

  @ApiPropertyOptional({
    example: 'uuid-do-produto',
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
  @IsString()
  media_url?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/promocao',
    description: 'URL de destino ao clicar no anúncio',
  })
  @IsOptional()
  @IsString()
  target_url?: string;

  @ApiProperty({
    example: '2024-01-15T00:00:00Z',
    description: 'Data de início do anúncio',
  })
  @IsString()
  @IsNotEmpty()
  start_date: string;
}
