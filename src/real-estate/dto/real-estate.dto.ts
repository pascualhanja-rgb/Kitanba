import {
  IsIn,
  IsOptional,
  IsNumber,
  IsString,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRealEstateDto {
  @ApiPropertyOptional({ enum: ['house', 'apartment', 'land', 'commercial'] })
  @IsOptional()
  @IsIn(['house', 'apartment', 'land', 'commercial'])
  property_type?: string;

  @ApiPropertyOptional({ enum: ['sale', 'rent'] })
  @IsOptional()
  @IsIn(['sale', 'rent'])
  transaction_type?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 120.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  area_sqm?: number;

  @ApiPropertyOptional({ example: 'Talatona, Luanda' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  location_address?: string;

  @ApiPropertyOptional({ example: -8.915 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 13.185 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class SuspendListingDto {
  @ApiProperty({ example: 'Anúncio duplicado' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
