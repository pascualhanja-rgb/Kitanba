import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestPlanUpgradeDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  requested_plan_id: number;

  @ApiPropertyOptional({ example: 'https://example.com/proof.jpg' })
  @IsOptional()
  @IsString()
  payment_proof_url?: string;
}
