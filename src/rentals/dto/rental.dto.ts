import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRentalDto {
  @ApiProperty({ example: 'uuid-produto' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ example: '2026-11-10T08:00:00Z' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2026-11-13T18:00:00Z' })
  @IsDateString()
  end_date: string;

  @ApiPropertyOptional({ example: 'Preciso de extensão elétrica' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ExtendRentalDto {
  @ApiProperty({ example: '2026-11-15T18:00:00Z' })
  @IsDateString()
  new_end_date: string;

  @ApiPropertyOptional({ example: 'Cliente pediu mais 2 dias' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReturnRentalDto {
  @ApiProperty({
    enum: ['returned', 'damaged'],
    example: 'returned',
    description: 'returned = sem danos (caução devolvida)',
  })
  @IsIn(['returned', 'damaged'])
  condition_on_return: string;

  @ApiPropertyOptional({ example: 'Ecrã riscado' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ForceRentalStatusDto {
  @ApiProperty({
    enum: ['active', 'returned', 'damaged', 'cancelled'],
  })
  @IsIn(['active', 'returned', 'damaged', 'cancelled'])
  status: string;

  @ApiPropertyOptional({ example: 'Disputa resolvida a favor do vendedor' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
