import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FineType, PayoutModel } from '@prisma/client';

export class CreateSavingsGroupDto {
  @ApiProperty({ example: 'Family Savings Club' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Monthly family savings group' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'ZAR', default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 500, description: 'Monthly contribution amount' })
  @IsNumber()
  @Min(1)
  monthlyAmount: number;

  @ApiProperty({ example: 1, description: 'Day of month when contribution is due (1-28)' })
  @IsNumber()
  @Min(1)
  @Max(28)
  dueDay: number;

  @ApiPropertyOptional({ example: 7, description: 'Grace period in days after due date' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  gracePeriodDays?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  fineEnabled?: boolean;

  @ApiPropertyOptional({ example: 50, description: 'Fine amount if enabled' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fineAmount?: number;

  @ApiPropertyOptional({ enum: FineType, example: 'FLAT' })
  @IsOptional()
  @IsEnum(FineType)
  fineType?: FineType;

  @ApiPropertyOptional({ enum: PayoutModel, example: 'YEAR_END' })
  @IsOptional()
  @IsEnum(PayoutModel)
  payoutModel?: PayoutModel;

  @ApiPropertyOptional({ example: { months: [6, 12] }, description: 'Custom payout schedule' })
  @IsOptional()
  @IsObject()
  payoutSchedule?: Record<string, any>;

  @ApiPropertyOptional({ example: 2, description: 'Minimum approvals needed for payouts' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  minApprovalCount?: number;
}
