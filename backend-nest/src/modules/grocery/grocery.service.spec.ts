import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
import { PurchaseService } from './services/purchase.service';
import { DistributionService } from './services/distribution.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreatePurchaseDto } from './dto/purchase.dto';
import { CreateDistributionDto } from './dto/distribution.dto';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

// Mock PrismaService
const mockPrismaService = {
  groceryProduct: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  groceryPurchase: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  groceryPurchaseItem: {
    createMany: jest.fn(),
  },
  groceryStockMovement: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  groceryDistribution: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  groceryDistributionItem: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  groceryIdempotencyKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  groupMember: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  ledgerEntry: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

describe('GroceryModule Services', () => {
  let module: TestingModule;
  let productService: ProductService;
  let stockService: StockService;
  let purchaseService: PurchaseService;
  let distributionService: DistributionService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ProductService,
        StockService,
        PurchaseService,
        DistributionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    productService = module.get<ProductService>(ProductService);
    stockService = module.get<StockService>(StockService);
    purchaseService = module.get<PurchaseService>(PurchaseService);
    distributionService = module.get<DistributionService>(DistributionService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('ProductService', () => {
    const groupId = 'group-123';
    const userId = 'user-123';

    describe('create', () => {
      it('should create a product successfully', async () => {
        const dto: CreateProductDto = {
          name: 'Rice',
          unit: 'kg',
          category: 'STAPLES',
          defaultSize: 2.5,
        };

        const expectedProduct = {
          id: 'product-123',
          groupId,
          ...dto,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrismaService.groceryProduct.create.mockResolvedValue(expectedProduct);

        const result = await productService.create(groupId, dto, userId);

        expect(result).toEqual(expectedProduct);
        expect(mockPrismaService.groceryProduct.create).toHaveBeenCalledWith({
          data: {
            groupId,
            name: dto.name,
            unit: dto.unit,
            category: dto.category,
            defaultSize: dto.defaultSize,
          },
        });
      });

      it('should create product with default category if not provided', async () => {
        const dto: CreateProductDto = {
          name: 'Test Product',
          unit: 'piece',
        };

        mockPrismaService.groceryProduct.create.mockResolvedValue({
          id: 'product-123',
          groupId,
          ...dto,
          category: 'OTHER',
          active: true,
        });

        await productService.create(groupId, dto, userId);

        expect(mockPrismaService.groceryProduct.create).toHaveBeenCalled();
      });
    });

    describe('findAll', () => {
      it('should return paginated products', async () => {
        const products = [
          { id: '1', name: 'Rice', unit: 'kg', category: 'STAPLES', active: true },
          { id: '2', name: 'Oil', unit: 'litre', category: 'STAPLES', active: true },
        ];

        mockPrismaService.groceryProduct.findMany.mockResolvedValue(products);
        mockPrismaService.groceryProduct.count.mockResolvedValue(2);

        const result = await productService.findAll(groupId, {});

        expect(result.products).toEqual(products);
        expect(result.total).toBe(2);
      });

      it('should filter by category', async () => {
        mockPrismaService.groceryProduct.findMany.mockResolvedValue([]);
        mockPrismaService.groceryProduct.count.mockResolvedValue(0);

        await productService.findAll(groupId, { category: 'MEAT' });

        expect(mockPrismaService.groceryProduct.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              category: 'MEAT',
            }),
          }),
        );
      });

      it('should filter by search term', async () => {
        mockPrismaService.groceryProduct.findMany.mockResolvedValue([]);
        mockPrismaService.groceryProduct.count.mockResolvedValue(0);

        await productService.findAll(groupId, { search: 'rice' });

        expect(mockPrismaService.groceryProduct.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              name: { contains: 'rice', mode: 'insensitive' },
            }),
          }),
        );
      });
    });

    describe('update', () => {
      it('should update a product', async () => {
        const productId = 'product-123';
        const dto: UpdateProductDto = { name: 'Brown Rice' };

        mockPrismaService.groceryProduct.findUnique.mockResolvedValue({
          id: productId,
          groupId,
          name: 'Rice',
        });

        mockPrismaService.groceryProduct.update.mockResolvedValue({
          id: productId,
          groupId,
          name: 'Brown Rice',
        });

        const result = await productService.update(groupId, productId, dto, userId);

        expect(result.name).toBe('Brown Rice');
      });

      it('should throw NotFoundException if product not found', async () => {
        mockPrismaService.groceryProduct.findUnique.mockResolvedValue(null);

        await expect(
          productService.update(groupId, 'non-existent', { name: 'Test' }, userId),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('delete', () => {
      it('should soft delete a product', async () => {
        const productId = 'product-123';

        mockPrismaService.groceryProduct.findUnique.mockResolvedValue({
          id: productId,
          groupId,
        });

        mockPrismaService.groceryProduct.update.mockResolvedValue({
          id: productId,
          active: false,
        });

        await productService.delete(groupId, productId, userId);

        expect(mockPrismaService.groceryProduct.update).toHaveBeenCalledWith({
          where: { id: productId },
          data: { active: false },
        });
      });
    });
  });

  describe('StockService', () => {
    const groupId = 'group-123';

    describe('getCurrentStock', () => {
      it('should aggregate stock movements correctly', async () => {
        mockPrismaService.groceryStockMovement.groupBy.mockResolvedValue([
          {
            productId: 'product-1',
            _sum: { quantity: 100 },
          },
          {
            productId: 'product-2',
            _sum: { quantity: 50 },
          },
        ]);

        const result = await stockService.getCurrentStock(groupId);

        expect(result).toHaveLength(2);
      });
    });

    describe('checkAvailability', () => {
      it('should return true when stock is sufficient', async () => {
        mockPrismaService.groceryStockMovement.aggregate.mockResolvedValue({
          _sum: { quantity: 100 },
        });

        const result = await stockService.checkAvailability(groupId, 'product-1', 50);

        expect(result).toBe(true);
      });

      it('should return false when stock is insufficient', async () => {
        mockPrismaService.groceryStockMovement.aggregate.mockResolvedValue({
          _sum: { quantity: 30 },
        });

        const result = await stockService.checkAvailability(groupId, 'product-1', 50);

        expect(result).toBe(false);
      });
    });
  });

  describe('PurchaseService', () => {
    const groupId = 'group-123';
    const userId = 'user-123';

    describe('create', () => {
      it('should create purchase with items and stock movements', async () => {
        const dto: CreatePurchaseDto = {
          purchaseDate: new Date().toISOString(),
          items: [
            { productId: 'product-1', quantity: 10, unitCost: 50 },
            { productId: 'product-2', quantity: 5, unitCost: 100 },
          ],
        };

        const memberId = 'member-123';
        mockPrismaService.groupMember.findFirst.mockResolvedValue({
          id: memberId,
          role: 'TREASURER',
        });

        mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
          _sum: { creditAmount: 2000, debitAmount: 500 },
        });

        const expectedPurchase = {
          id: 'purchase-123',
          groupId,
          totalCost: 1000,
          status: 'APPROVED',
          items: dto.items.map((item, index) => ({
            id: `item-${index}`,
            ...item,
            lineCost: item.quantity * item.unitCost,
          })),
        };

        mockPrismaService.groceryPurchase.create.mockResolvedValue(expectedPurchase);

        const result = await purchaseService.create(groupId, dto, userId);

        expect(result.totalCost).toBe(1000);
        expect(mockPrismaService.groceryPurchase.create).toHaveBeenCalled();
      });

      it('should throw BadRequestException if insufficient balance', async () => {
        const dto: CreatePurchaseDto = {
          purchaseDate: new Date().toISOString(),
          items: [{ productId: 'product-1', quantity: 100, unitCost: 500 }],
        };

        mockPrismaService.groupMember.findFirst.mockResolvedValue({
          id: 'member-123',
          role: 'TREASURER',
        });

        // Very low balance
        mockPrismaService.ledgerEntry.findFirst.mockResolvedValue({
          _sum: { creditAmount: 100, debitAmount: 0 },
        });

        await expect(purchaseService.create(groupId, dto, userId)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('approve', () => {
      it('should approve a pending purchase', async () => {
        const purchaseId = 'purchase-123';
        const chairpersonId = 'chairperson-123';

        mockPrismaService.groupMember.findFirst.mockResolvedValue({
          id: 'member-chair',
          role: 'CHAIRPERSON',
        });

        mockPrismaService.groceryPurchase.findUnique.mockResolvedValue({
          id: purchaseId,
          groupId,
          status: 'PENDING_APPROVAL',
          items: [{ productId: 'p1', quantity: 10 }],
        });

        mockPrismaService.groceryPurchase.update.mockResolvedValue({
          id: purchaseId,
          status: 'APPROVED',
        });

        const result = await purchaseService.approve(groupId, purchaseId, chairpersonId);

        expect(result.status).toBe('APPROVED');
      });

      it('should throw ForbiddenException if not chairperson', async () => {
        mockPrismaService.groupMember.findFirst.mockResolvedValue({
          id: 'member-123',
          role: 'MEMBER',
        });

        await expect(
          purchaseService.approve(groupId, 'purchase-123', 'user-123'),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('DistributionService', () => {
    const groupId = 'group-123';
    const userId = 'user-123';

    describe('create', () => {
      it('should create distribution with equal share allocation', async () => {
        const dto: CreateDistributionDto = {
          eventName: 'December Distribution',
          eventDate: new Date().toISOString(),
          allocationRule: 'EQUAL_SHARE',
          items: [{ productId: 'product-1', totalQuantity: 100 }],
        };

        mockPrismaService.groupMember.findFirst.mockResolvedValue({
          id: 'member-123',
          role: 'TREASURER',
        });

        // 10 members
        mockPrismaService.groupMember.count.mockResolvedValue(10);
        mockPrismaService.groupMember.findMany.mockResolvedValue(
          Array(10).fill(null).map((_, i) => ({ id: `member-${i}` })),
        );

        // Sufficient stock
        mockPrismaService.groceryStockMovement.aggregate.mockResolvedValue({
          _sum: { quantity: 150 },
        });

        const expectedDistribution = {
          id: 'dist-123',
          groupId,
          eventName: dto.eventName,
          status: 'CONFIRMED',
          items: Array(10).fill(null).map((_, i) => ({
            memberId: `member-${i}`,
            productId: 'product-1',
            quantity: 10, // 100 / 10 members
            status: 'ALLOCATED',
          })),
        };

        mockPrismaService.groceryDistribution.create.mockResolvedValue(expectedDistribution);

        const result = await distributionService.create(groupId, dto, userId);

        expect(result.items).toHaveLength(10);
        // Each member gets 10 (100 / 10 members)
        expect(result.items[0].quantity).toBe(10);
      });

      it('should throw BadRequestException if stock insufficient', async () => {
        const dto: CreateDistributionDto = {
          eventName: 'Test Distribution',
          eventDate: new Date().toISOString(),
          allocationRule: 'EQUAL_SHARE',
          items: [{ productId: 'product-1', totalQuantity: 100 }],
        };

        mockPrismaService.groupMember.findFirst.mockResolvedValue({
          id: 'member-123',
          role: 'TREASURER',
        });

        // Insufficient stock
        mockPrismaService.groceryStockMovement.aggregate.mockResolvedValue({
          _sum: { quantity: 50 },
        });

        await expect(distributionService.create(groupId, dto, userId)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('confirmItem (idempotency)', () => {
      it('should return cached response for duplicate idempotency key', async () => {
        const itemId = 'item-123';
        const idempotencyKey = 'idem-key-123';

        // Existing idempotency record
        mockPrismaService.groceryIdempotencyKey.findUnique.mockResolvedValue({
          idempotencyKey,
          response: JSON.stringify({
            itemId,
            status: 'COLLECTED',
            confirmedAt: new Date().toISOString(),
          }),
        });

        const result = await distributionService.confirmItem(itemId, idempotencyKey, userId);

        expect(result.fromCache).toBe(true);
        expect(mockPrismaService.groceryDistributionItem.update).not.toHaveBeenCalled();
      });

      it('should process and cache new confirmation', async () => {
        const itemId = 'item-123';
        const idempotencyKey = 'new-idem-key';

        mockPrismaService.groceryIdempotencyKey.findUnique.mockResolvedValue(null);

        mockPrismaService.groceryDistributionItem.findUnique.mockResolvedValue({
          id: itemId,
          memberId: 'member-123',
          status: 'ALLOCATED',
          distribution: { groupId },
          member: { userId },
        });

        mockPrismaService.groceryDistributionItem.update.mockResolvedValue({
          id: itemId,
          status: 'COLLECTED',
          confirmedAt: new Date(),
        });

        mockPrismaService.groceryIdempotencyKey.create.mockResolvedValue({});

        const result = await distributionService.confirmItem(itemId, idempotencyKey, userId);

        expect(result.status).toBe('COLLECTED');
        expect(result.fromCache).toBe(false);
        expect(mockPrismaService.groceryIdempotencyKey.create).toHaveBeenCalled();
      });
    });
  });
});
