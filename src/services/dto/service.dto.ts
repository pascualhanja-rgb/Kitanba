import {
  IsIn,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateServiceDetailsDto {
  @ApiProperty({ enum: ['fixed', 'per_hour', 'per_sqm', 'quote_required'] })
  @IsIn(['fixed', 'per_hour', 'per_sqm', 'quote_required'])
  pricing_type: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsNumber()
  @Min(15)
  estimated_duration_minutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requires_site_visit?: boolean;
}

export class ScheduleDayDto {
  @ApiProperty({ example: 1, description: '0 = domingo ... 6 = sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @ApiProperty({ example: '08:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time deve estar no formato HH:mm',
  })
  start_time: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'end_time deve estar no formato HH:mm',
  })
  end_time: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class SetScheduleDto {
  @ApiProperty({ type: [ScheduleDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days: ScheduleDayDto[];
}

export class SlotsQueryDto {
  @ApiProperty({ example: '2026-11-03' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ example: 'uuid-servico' })
  @IsOptional()
  @IsString()
  product_id?: string;
}
