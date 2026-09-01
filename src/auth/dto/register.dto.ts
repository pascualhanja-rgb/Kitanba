import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({
    example: 'MinhaSenh@123!',
    description:
      'Mínimo 8 caracteres, deve conter: 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])/, {
    message: 'A senha deve conter pelo menos uma letra minúscula',
  })
  @Matches(/^(?=.*[A-Z])/, {
    message: 'A senha deve conter pelo menos uma letra maiúscula',
  })
  @Matches(/^(?=.*\d)/, {
    message: 'A senha deve conter pelo menos um número',
  })
  @Matches(/^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message:
      'A senha deve conter pelo menos um caractere especial (!@#$%^&*...)',
  })
  password: string;

  @ApiPropertyOptional({ example: '+244 923 456 789' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ enum: ['customer', 'seller'], default: 'customer' })
  @IsOptional()
  @IsIn(['customer', 'seller'])
  user_type?: string;
}
