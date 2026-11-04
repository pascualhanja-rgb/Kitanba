import {
  IsUUID,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  IsString,
  IsUrl,
  Min,
  Max,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInstallmentPlanDto {
  @ApiPropertyOptional({ example: 'uuid-pedido' })
  @ValidateIf((dto) => !dto.rental_id)
  @IsUUID()
  order_id?: string;

  @ApiPropertyOptional({ example: 'uuid-aluguer' })
  @ValidateIf((dto) => !dto.order_id)
  @IsUUID()
  rental_id?: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(12)
  total_installments: number;

  @ApiProperty({ example: '2026-11-10' })
  @IsDateString()
  first_due_date: string;

  @ApiPropertyOptional({ example: 30, description: 'Dias entre vencimentos' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval_days?: number;
}

export class PayInstallmentDto {
  @ApiProperty({
    enum: ['transferencia', 'multicaixa', 'dinheiro', 'express'],
  })
  @IsIn(['transferencia', 'multicaixa', 'dinheiro', 'express'])
  payment_method: string;

  @ApiPropertyOptional({ example: 'https://cdn.kitanda.ao/proofs/abc.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  payment_proof_url?: string;
}

export class MarkInstallmentPaidDto {
  @ApiPropertyOptional({ example: 'transferencia' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  payment_method?: string;

  @ApiPropertyOptional({ example: '2026-11-09T15:30:00Z' })
  @IsOptional()
  @IsDateString()
  paid_at?: string;
}

export class CancelInstallmentDto {
  @ApiPropertyOptional({ example: 'Negociação com o cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
