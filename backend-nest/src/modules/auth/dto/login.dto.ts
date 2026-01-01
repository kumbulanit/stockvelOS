import { IsString, IsOptional, IsEmail, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+27821234567' })
  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'iPhone 14 Pro' })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
