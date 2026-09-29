import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAffiliateDto {
  @ApiProperty({ example: 'membro@email.com', description: 'Email do utilizador a associar' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'affiliate',
    enum: ['affiliate', 'courier', 'manager'],
    default: 'affiliate',
  })
  @IsIn(['affiliate', 'courier', 'manager'])
  role: string;
}

export class UpdateAffiliateDto {
  @ApiPropertyOptional({
    example: 'courier',
    enum: ['affiliate', 'courier', 'manager'],
  })
  @IsOptional()
  @IsIn(['affiliate', 'courier', 'manager'])
  role?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
