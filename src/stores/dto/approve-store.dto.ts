import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveStoreDto {
  @ApiPropertyOptional({ example: 'Loja aprovada' })
  @IsOptional()
  @IsString()
  reason?: string;
}
