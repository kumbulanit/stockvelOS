import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class ApprovePayoutDto {
  @ApiPropertyOptional({ example: 'Approved for year-end distribution' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectPayoutDto {
  @ApiProperty({ example: 'Insufficient documentation provided' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
