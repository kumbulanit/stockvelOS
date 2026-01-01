import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupType, ContributionFrequency } from '@prisma/client';

export class CreateGroupDto {
  @ApiProperty({ example: 'Family Savings Club' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: GroupType, example: 'SAVINGS' })
  @IsEnum(GroupType)
  type: GroupType;

  @ApiPropertyOptional({ example: 'Monthly family savings group' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'ZAR', default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  contributionAmount?: number;

  @ApiPropertyOptional({ enum: ContributionFrequency, example: 'MONTHLY' })
  @IsOptional()
  @IsEnum(ContributionFrequency)
  contributionFrequency?: ContributionFrequency;

  @ApiPropertyOptional({ example: { maxMembers: 20, minAge: 18 } })
  @IsOptional()
  @IsObject()
  rules?: Record<string, any>;
}
