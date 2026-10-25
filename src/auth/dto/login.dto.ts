import { IsEmail, IsString, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  /** Email OU telefone — pelo menos um é obrigatório. */
  @ApiPropertyOptional({
    example: 'joao@email.com',
    description: 'Email do utilizador. Obrigatório se o telefone não for informado.',
  })
  @ValidateIf((o) => !o.phone)
  @IsEmail({}, { message: 'Informe um email válido ou um telefone' })
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    example: '+244 923 456 789',
    description:
      'Telefone do utilizador (o mesmo cadastrado no registo). Obrigatório se o email não for informado.',
  })
  @ValidateIf((o) => !o.email)
  @IsString({ message: 'Informe um email válido ou um telefone' })
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'MinhaSenh@123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
