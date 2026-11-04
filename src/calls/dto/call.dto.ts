import { IsUUID, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateCallDto {
  @ApiProperty({ example: 'uuid-entrega' })
  @IsUUID()
  delivery_id: string;

  @ApiPropertyOptional({ example: 'uuid-pedido' })
  @IsOptional()
  @IsUUID()
  order_id?: string;
}

export class UpdateCallStatusDto {
  @ApiProperty({
    enum: ['ringing', 'answered', 'missed', 'rejected', 'ended'],
  })
  @IsIn(['ringing', 'answered', 'missed', 'rejected', 'ended'])
  status: string;
}
