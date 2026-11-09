import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfessionalSpecialtyDto {
  @ApiProperty({ example: 'Eletricista' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/icons/eletricista.png' })
  @IsOptional()
  @IsString()
  icon_url?: string;

  @ApiPropertyOptional({ example: 'Instalações elétricas e manutenção de quadros.' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProfessionalSpecialtyDto {
  @ApiPropertyOptional({ example: 'Eletricista Industrial' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/icons/electricista-industrial.png' })
  @IsOptional()
  @IsString()
  icon_url?: string;

  @ApiPropertyOptional({ example: 'Instalações elétricas industriais e manutenção de quadros.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
