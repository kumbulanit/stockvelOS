import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GroceryService } from './grocery.service';
import { ProductService } from './services/product.service';
import { PurchaseService } from './services/purchase.service';
import { StockService } from './services/stock.service';
import { DistributionService } from './services/distribution.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from './dto/product.dto';
import {
  CreatePurchaseDto,
  ApprovePurchaseDto,
  RejectPurchaseDto,
  PurchaseQueryDto,
} from './dto/purchase.dto';
import {
  StockQueryDto,
  StockMovementQueryDto,
  CreateAdjustmentDto,
} from './dto/stock.dto';
import {
  CreateDistributionDto,
  UpdateDistributionStatusDto,
  UpdateDistributionItemStatusDto,
  ConfirmDistributionItemDto,
  DistributionQueryDto,
} from './dto/distribution.dto';
import { MemberRole } from '@prisma/client';

@Controller('groups/:groupId/grocery')
@UseGuards(JwtAuthGuard)
export class GroceryController {
  private readonly TREASURER_OR_CHAIR: MemberRole[] = ['TREASURER', 'CHAIRPERSON'];
  private readonly ALL_MEMBERS: MemberRole[] = ['MEMBER', 'TREASURER', 'SECRETARY', 'CHAIRPERSON'];

  constructor(
    private groceryService: GroceryService,
    private productService: ProductService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private distributionService: DistributionService,
  ) {}

  // ==================== GROUP SUMMARY ====================

  @Get('summary')
  async getGroupSummary(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.groceryService.getGroupSummary(groupId);
  }

  // ==================== PRODUCTS ====================

  @Get('products')
  async listProducts(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: ProductQueryDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.productService.findAll(groupId, query);
  }

  @Get('products/categories')
  async getCategories() {
    return this.productService.getCategories();
  }

  @Get('products/:productId')
  async getProduct(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.productService.findById(groupId, productId);
  }

  @Post('products')
  async createProduct(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.productService.create(groupId, dto, user.id);
  }

  @Patch('products/:productId')
  async updateProduct(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.productService.update(groupId, productId, dto, user.id);
  }

  @Delete('products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    await this.productService.softDelete(groupId, productId, user.id);
  }

  // ==================== PURCHASES ====================

  @Get('purchases')
  async listPurchases(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: PurchaseQueryDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.purchaseService.findAll(groupId, query);
  }

  @Get('purchases/:purchaseId')
  async getPurchase(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.purchaseService.findById(groupId, purchaseId);
  }

  @Post('purchases')
  async createPurchase(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.purchaseService.create(groupId, dto, user.id);
  }

  @Post('purchases/:purchaseId/approve')
  async approvePurchase(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Body() dto: ApprovePurchaseDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.purchaseService.approve(groupId, purchaseId, dto, user.id);
  }

  @Post('purchases/:purchaseId/reject')
  async rejectPurchase(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Body() dto: RejectPurchaseDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.purchaseService.reject(groupId, purchaseId, dto, user.id);
  }

  // ==================== STOCK ====================

  @Get('stock')
  async getCurrentStock(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: StockQueryDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.stockService.getCurrentStock(groupId, query);
  }

  @Get('stock/movements')
  async getStockMovements(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: StockMovementQueryDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.stockService.getMovements(groupId, query);
  }

  @Post('stock/adjustments')
  async createStockAdjustment(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.stockService.createAdjustment(groupId, dto, user.id);
  }

  // ==================== DISTRIBUTIONS ====================

  @Get('distributions')
  async listDistributions(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: DistributionQueryDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.distributionService.findAll(groupId, query);
  }

  @Get('distributions/:distributionId')
  async getDistribution(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('distributionId', ParseUUIDPipe) distributionId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.distributionService.findById(groupId, distributionId);
  }

  @Post('distributions')
  async createDistribution(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateDistributionDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.distributionService.create(groupId, dto, user.id);
  }

  @Patch('distributions/:distributionId/status')
  async updateDistributionStatus(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('distributionId', ParseUUIDPipe) distributionId: string,
    @Body() dto: UpdateDistributionStatusDto,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.TREASURER_OR_CHAIR);
    return this.distributionService.updateStatus(groupId, distributionId, dto, user.id);
  }

  // ==================== MEMBER SUMMARY ====================

  @Get('member/:memberId/summary')
  async getMemberFairnessSummary(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.distributionService.getMemberFairnessSummary(groupId, memberId);
  }
}
