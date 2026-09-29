import {
  IsString,
  IsIn,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBillingProfileDto {
  @ApiProperty({ example: 'company', enum: ['individual', 'company'] })
  @IsIn(['individual', 'company'])
  entity_type: string;

  @ApiPropertyOptional({ example: 'Kitanda Comércio Lda' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company_name?: string;

  @ApiProperty({ example: '5417890123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nif: string;

  @ApiPropertyOptional({ example: 'Rua Amílcar Cabral, 123, Luanda' })
  @IsOptional()
  @IsString()
  tax_address?: string;

  @ApiPropertyOptional({ example: 'Banco BAI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;

  @ApiPropertyOptional({ example: 'AO06004000000000000000000' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iban?: string;

  @ApiPropertyOptional({ example: 'BAIPAOLU' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  swift?: string;
}

export class UpdateBillingProfileDto {
  @ApiPropertyOptional({ example: 'company', enum: ['individual', 'company'] })
  @IsOptional()
  @IsIn(['individual', 'company'])
  entity_type?: string;

  @ApiPropertyOptional({ example: 'Kitanda Comércio Lda' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company_name?: string;

  @ApiPropertyOptional({ example: '5417890123' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nif?: string;

  @ApiPropertyOptional({ example: 'Rua Amílcar Cabral, 123, Luanda' })
  @IsOptional()
  @IsString()
  tax_address?: string;

  @ApiPropertyOptional({ example: 'Banco BAI' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;

  @ApiPropertyOptional({ example: 'AO06004000000000000000000' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iban?: string;

  @ApiPropertyOptional({ example: 'BAIPAOLU' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  swift?: string;
}
