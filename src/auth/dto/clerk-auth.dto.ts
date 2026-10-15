import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClerkAuthDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Imlu...',
    description:
      'Token de sessão devolvido pelo Clerk no frontend (useAuth().getToken()) após login com Google ou Apple',
  })
  @IsString()
  clerk_token: string;

  @ApiPropertyOptional({ enum: ['customer', 'seller'], default: 'customer' })
  @IsOptional()
  @IsIn(['customer', 'seller'])
  user_type?: string;
}

export class ClerkLinkDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Imlu...',
    description:
      'Token de sessão do Clerk a ligar à conta autenticada atual',
  })
  @IsString()
  clerk_token: string;
}
