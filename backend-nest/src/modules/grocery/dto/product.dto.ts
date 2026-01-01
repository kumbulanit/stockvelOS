import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsPositive,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroceryCategory } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(50)
  unit: string;

  @IsEnum(GroceryCategory)
  category: GroceryCategory;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Type(() => Number)
  defaultSize?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsEnum(GroceryCategory)
  category?: GroceryCategory;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Type(() => Number)
  defaultSize?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ProductQueryDto {
  @IsOptional()
  @IsEnum(GroceryCategory)
  category?: GroceryCategory;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

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

export class ProductResponseDto {
  id: string;
  groupId: string;
  name: string;
  unit: string;
  category: GroceryCategory;
  defaultSize: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
