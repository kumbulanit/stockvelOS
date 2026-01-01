import { IsEmail, IsString, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';

export class AddMemberDto {
  @ApiPropertyOptional({ example: 'member@example.com' })
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+27821234567' })
  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: MemberRole, default: 'MEMBER' })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}
