import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Senha atual (obrigatória para utilizadores autenticados)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  current_password?: string;

  @ApiProperty({
    description:
      'Nova senha (mínimo 8 caracteres, deve conter maiúscula, minúscula, número e caractere especial)',
    example: 'NovaSenh@123!',
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
  new_password!: string;

  @ApiPropertyOptional({
    description: 'E-mail do utilizador (para redefinição por OTP)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Token de redefinição após validação do OTP',
  })
  @IsOptional()
  @IsString()
  reset_token?: string;
}