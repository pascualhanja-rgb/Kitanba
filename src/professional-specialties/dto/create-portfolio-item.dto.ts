import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePortfolioItemDto {
  @ApiProperty({ example: 'Instalação de rede de água na Talatona' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Projeto completo de encanamento residencial.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'https://example.com/portfolio/talaton.jpg' })
  @IsString()
  @IsNotEmpty()
  image_url: string;
}

export class UpdatePortfolioItemDto {
  @ApiPropertyOptional({ example: 'Instalação de rede de água e esgoto na Talatona' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Projeto completo de encanamento residencial com videira.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/portfolio/talaton-atualizado.jpg' })
  @IsOptional()
  @IsString()
  image_url?: string;
}
