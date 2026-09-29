import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignProductDto {
  @ApiProperty({ example: '3f8a9c1e-6b7d-4e2f-9a0b-1c2d3e4f5a6b' })
  @IsUUID()
  product_id: string;

  @ApiProperty({ example: 4500, description: 'Preço promocional' })
  @IsNumber()
  @Min(0)
  promotional_price: number;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'Sextou da Kitanda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ example: 'sextou', default: 'sextou' })
  @IsOptional()
  @IsString()
  campaign_type?: string;

  @ApiProperty({ example: '2026-10-02T18:00:00Z' })
  @IsDateString()
  starts_at: string;

  @ApiProperty({ example: '2026-10-03T23:59:59Z' })
  @IsDateString()
  ends_at: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ type: [CampaignProductDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CampaignProductDto)
  products: CampaignProductDto[];
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({ example: 'Sextou da Kitanda' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: '2026-10-02T18:00:00Z' })
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiPropertyOptional({ example: '2026-10-03T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ type: [CampaignProductDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignProductDto)
  products?: CampaignProductDto[];
}
