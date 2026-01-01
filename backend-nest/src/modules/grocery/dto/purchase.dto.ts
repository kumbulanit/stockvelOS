import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroceryPurchaseStatus } from '@prisma/client';

export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Type(() => Number)
  unitPrice: number;
}

export class CreatePurchaseDto {
  @IsString()
  @MaxLength(200)
  supplierName: string;

  @IsDateString()
  purchaseDate: string;

  @IsOptional()
  @IsUUID()
  receiptDocumentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}

export class ApprovePurchaseDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectPurchaseDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class PurchaseQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  status?: GroceryPurchaseStatus;

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

export class PurchaseItemResponseDto {
  id: string;
  productId: string;
  productName: string;
  productUnit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export class PurchaseResponseDto {
  id: string;
  groupId: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  currency: string;
  status: GroceryPurchaseStatus;
  notes: string | null;
  receiptDocumentId: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  approvedAt: Date | null;
  items: PurchaseItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
