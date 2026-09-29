import {
  IsIn,
  IsOptional,
  IsNumber,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    enum: ['picking_up', 'in_transit', 'delivered', 'cancelled'],
    example: 'in_transit',
  })
  @IsIn(['picking_up', 'in_transit', 'delivered', 'cancelled'])
  status: string;
}

export class TrackPositionDto {
  @ApiProperty({ example: -8.839 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 13.289 })
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 45.5, description: 'Ângulo de orientação (0-360°)' })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiPropertyOptional({ example: 32.4, description: 'Velocidade (km/h)' })
  @IsOptional()
  @IsNumber()
  speed?: number;
}
