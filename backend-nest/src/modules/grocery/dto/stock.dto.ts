import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovementType, GroceryCategory } from '@prisma/client';

export class StockQueryDto {
  @IsOptional()
  @IsEnum(GroceryCategory)
  category?: GroceryCategory;

  @IsOptional()
  @IsString()
  search?: string;
}

export class StockMovementQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  movementType?: StockMovementType;

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

export class CreateAdjustmentDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  quantity: number; // Can be positive or negative for adjustments

  @IsString()
  reason: string;
}

export class StockLevelResponseDto {
  productId: string;
  productName: string;
  unit: string;
  category: GroceryCategory;
  currentQuantity: number;
  lastMovementAt: Date | null;
}

export class StockMovementResponseDto {
  id: string;
  groupId: string;
  productId: string;
  productName: string;
  movementType: StockMovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: Date;
}

export class StockSummaryResponseDto {
  groupId: string;
  totalProducts: number;
  totalStockValue: number;
  stockByCategory: Record<string, { count: number; totalQuantity: number }>;
  recentMovements: StockMovementResponseDto[];
}
