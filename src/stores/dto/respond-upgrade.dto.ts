import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespondUpgradeDto {
  @ApiProperty({ example: 'approved', enum: ['approved', 'rejected'] })
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: string;

  @ApiPropertyOptional({ example: 'Upgrade aprovado' })
  @IsOptional()
  @IsString()
  admin_notes?: string;
}
