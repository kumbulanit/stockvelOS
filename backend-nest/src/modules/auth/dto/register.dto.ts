import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+27821234567' })
  @IsString()
  @Matches(/^\+27[0-9]{9}$/, { message: 'Phone must be a valid SA number (+27XXXXXXXXX)' })
  phone: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: '9001015009087' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{13}$/, { message: 'ID number must be 13 digits' })
  idNumber?: string;

  @ApiPropertyOptional({ example: 'iPhone 14 Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceInfo?: string;
}
