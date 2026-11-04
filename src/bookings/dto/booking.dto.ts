import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  IsNumber,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-servico' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ example: '2026-11-03' })
  @IsDateString()
  scheduled_date: string;

  @ApiProperty({ example: '09:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'scheduled_time deve estar no formato HH:mm',
  })
  scheduled_time: string;

  @ApiProperty({ example: 'Rua 21 de Janeiro, Casa 45, Luanda' })
  @IsString()
  @MaxLength(1000)
  service_address: string;

  @ApiPropertyOptional({ example: -8.839 })
  @IsOptional()
  @IsNumber()
  service_latitude?: number;

  @ApiPropertyOptional({ example: 13.289 })
  @IsOptional()
  @IsNumber()
  service_longitude?: number;

  @ApiPropertyOptional({ example: 'Portão azul. Dois andares.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes_from_customer?: string;

  @ApiPropertyOptional({
    example: 120,
    description: 'Obrigatório para pricing_type = per_sqm',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  area_sqm?: number;
}

export class RescheduleBookingDto {
  @ApiProperty({ example: '2026-11-04' })
  @IsDateString()
  scheduled_date: string;

  @ApiProperty({ example: '14:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'scheduled_time deve estar no formato HH:mm',
  })
  scheduled_time: string;

  @ApiPropertyOptional({ example: 'Equipa indisponível no dia anterior.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AssignProviderDto {
  @ApiProperty({ example: 'uuid-prestador' })
  @IsUUID()
  provider_id: string;
}

export class ServiceQuoteDto {
  @ApiProperty({ example: 42000 })
  @IsNumber()
  @Min(0)
  total_amount: number;

  @ApiPropertyOptional({ example: 'Inclui material.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Imprevisto do cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
