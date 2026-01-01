import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SavingsPayoutType, DistributionType } from '@prisma/client';

export class CreatePayoutDto {
  @ApiProperty({ example: 5000, description: 'Payout amount' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'ZAR', default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: SavingsPayoutType, example: 'SCHEDULED' })
  @IsEnum(SavingsPayoutType)
  payoutType: SavingsPayoutType;

  @ApiPropertyOptional({ example: 'Year-end distribution' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: ['uuid1', 'uuid2'],
    description: 'Target member IDs (empty = all members)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetMembers?: string[];

  @ApiPropertyOptional({ enum: DistributionType, default: 'EQUAL' })
  @IsOptional()
  @IsEnum(DistributionType)
  distributionType?: DistributionType;

  @ApiPropertyOptional({ description: 'Idempotency key for offline support' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
