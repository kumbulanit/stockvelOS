import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class CreateContributionDto {
  @ApiProperty({ example: 500, description: 'Contribution amount' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'ZAR', default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: '2024-01-01', description: 'Period start date' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2024-01-31', description: 'Period end date' })
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ enum: PaymentMethod, example: 'EFT' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Document ID for proof of payment' })
  @IsOptional()
  @IsUUID()
  popDocumentId?: string;

  @ApiPropertyOptional({ example: 'Monthly contribution for January' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Idempotency key for offline support' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
