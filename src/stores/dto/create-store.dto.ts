import { IsString, IsOptional, IsNotEmpty, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ example: 'Loja do João' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  banner_url?: string;

  @ApiPropertyOptional({ example: 'A melhor loja de Angola' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  plan_id: number;
}
