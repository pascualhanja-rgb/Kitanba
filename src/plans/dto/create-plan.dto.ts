import {
  IsString,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Premium' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'premium', enum: ['normal', 'black', 'premium'] })
  @IsString()
  @IsIn(['normal', 'black', 'premium'])
  tier: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  monthly_price: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  max_products: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  allow_flyer_ads: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  allow_banner_ads: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  allow_video_ads: boolean;
}
