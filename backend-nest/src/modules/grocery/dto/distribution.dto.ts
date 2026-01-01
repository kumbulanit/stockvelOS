import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GroceryDistributionStatus,
  AllocationRule,
  DistributionItemStatus,
} from '@prisma/client';

export class DistributionProductDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Type(() => Number)
  totalQuantity: number;
}

export class MemberOverrideDto {
  @IsUUID()
  memberId: string;

  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateDistributionDto {
  @IsDateString()
  distributionDate: string;

  @IsOptional()
  @IsEnum(AllocationRule)
  allocationRule?: AllocationRule = AllocationRule.EQUAL_SHARE;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => DistributionProductDto)
  products: DistributionProductDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberOverrideDto)
  overrides?: MemberOverrideDto[];
}

export class UpdateDistributionStatusDto {
  @IsEnum(GroceryDistributionStatus)
  status: GroceryDistributionStatus;
}

export class UpdateDistributionItemStatusDto {
  @IsEnum(DistributionItemStatus)
  status: DistributionItemStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmDistributionItemDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class DistributionQueryDto {
  @IsOptional()
  @IsEnum(GroceryDistributionStatus)
  status?: GroceryDistributionStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class DistributionItemResponseDto {
  id: string;
  distributionId: string;
  memberId: string;
  member: {
    id: string;
    userId: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
  productId: string;
  product: {
    name: string;
    unit: string;
  };
  quantityAllocated: number;
  quantityOverride: number | null;
  overrideReason: string | null;
  status: DistributionItemStatus;
  confirmedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  confirmationNote: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

export class DistributionResponseDto {
  id: string;
  groupId: string;
  status: GroceryDistributionStatus;
  allocationRule: AllocationRule;
  distributionDate: string;
  notes: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items: DistributionItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalItems: number;
    pendingCount: number;
    packedCount: number;
    collectedCount: number;
    confirmedCount: number;
  };
}

export class MemberAllocationResponseDto {
  distributionId: string;
  distributionDate: string;
  status: GroceryDistributionStatus;
  items: {
    id: string;
    productId: string;
    productName: string;
    productUnit: string;
    quantityAllocated: number;
    status: DistributionItemStatus;
    confirmedAt: Date | null;
  }[];
}

export class MemberHistoryResponseDto {
  distributions: {
    id: string;
    distributionDate: string;
    totalItems: number;
    confirmedItems: number;
    items: {
      productName: string;
      quantity: number;
      confirmedAt: Date | null;
    }[];
  }[];
  summary: {
    totalDistributions: number;
    totalItemsReceived: number;
    estimatedValue: number;
  };
}

export class MemberFairnessSummaryDto {
  memberId: string;
  member: {
    firstName: string;
    lastName: string;
  };
  totalContributions: number;
  totalGroceryValue: number;
  fairnessRatio: number; // groceryValue / contributions
  lastContributionDate: Date | null;
  lastDistributionDate: Date | null;
}
