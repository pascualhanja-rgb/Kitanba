import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'Loja do João Atualizada' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  name?: string;

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
}
