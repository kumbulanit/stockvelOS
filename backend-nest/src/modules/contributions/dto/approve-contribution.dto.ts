import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class ApproveContributionDto {
  @ApiPropertyOptional({ example: 'POP verified' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectContributionDto {
  @ApiProperty({ example: 'POP does not match amount' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
