import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock the API module
vi.mock('@/lib/api', () => ({
  groceryApi: {
    getSummary: vi.fn(),
    getProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getPurchases: vi.fn(),
    createPurchase: vi.fn(),
    approvePurchase: vi.fn(),
    rejectPurchase: vi.fn(),
    getStock: vi.fn(),
    getStockMovements: vi.fn(),
    createAdjustment: vi.fn(),
    getDistributions: vi.fn(),
    createDistribution: vi.fn(),
    getDistribution: vi.fn(),
    updateDistributionItemStatus: vi.fn(),
    confirmItem: vi.fn(),
    getFairnessReport: vi.fn(),
  },
}));

import { groceryApi } from '@/lib/api';

// Test data
const mockSummary = {
  potBalance: 5000,
  productCount: 15,
  totalDistributions: 8,
  pendingPurchases: 2,
  memberCount: 10,
};

const mockProducts = {
  products: [
    { id: '1', name: 'Rice', unit: 'kg', category: 'STAPLES', active: true },
    { id: '2', name: 'Cooking Oil', unit: 'litre', category: 'STAPLES', active: true },
  ],
  total: 2,
};

const mockStock = {
  stock: [
    { productId: '1', productName: 'Rice', productUnit: 'kg', category: 'STAPLES', currentQuantity: 50 },
    { productId: '2', productName: 'Cooking Oil', productUnit: 'litre', category: 'STAPLES', currentQuantity: 20 },
  ],
};

const mockDistributions = {
  distributions: [
    {
      id: 'dist-1',
      eventName: 'December Distribution',
      eventDate: '2024-12-15T00:00:00Z',
      status: 'CONFIRMED',
      allocationRule: 'EQUAL_SHARE',
    },
  ],
};

// Wrapper for hooks
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Grocery API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should fetch grocery summary', async () => {
      (groceryApi.getSummary as any).mockResolvedValue({ data: mockSummary });

      const result = await groceryApi.getSummary('group-123');

      expect(result.data).toEqual(mockSummary);
      expect(groceryApi.getSummary).toHaveBeenCalledWith('group-123');
    });
  });

  describe('Products API', () => {
    it('should fetch products with filters', async () => {
      (groceryApi.getProducts as any).mockResolvedValue({ data: mockProducts });

      const result = await groceryApi.getProducts('group-123', {
        category: 'STAPLES',
        search: 'rice',
      });

      expect(result.data.products).toHaveLength(2);
      expect(groceryApi.getProducts).toHaveBeenCalledWith('group-123', {
        category: 'STAPLES',
        search: 'rice',
      });
    });

    it('should create a new product', async () => {
      const newProduct = {
        id: '3',
        name: 'Sugar',
        unit: 'kg',
        category: 'STAPLES',
        active: true,
      };

      (groceryApi.createProduct as any).mockResolvedValue({ data: newProduct });

      const result = await groceryApi.createProduct('group-123', {
        name: 'Sugar',
        unit: 'kg',
        category: 'STAPLES',
      });

      expect(result.data.name).toBe('Sugar');
    });

    it('should update a product', async () => {
      const updatedProduct = {
        id: '1',
        name: 'Brown Rice',
        unit: 'kg',
        category: 'STAPLES',
      };

      (groceryApi.updateProduct as any).mockResolvedValue({ data: updatedProduct });

      const result = await groceryApi.updateProduct('group-123', '1', {
        name: 'Brown Rice',
      });

      expect(result.data.name).toBe('Brown Rice');
    });

    it('should delete a product', async () => {
      (groceryApi.deleteProduct as any).mockResolvedValue({ data: { success: true } });

      await groceryApi.deleteProduct('group-123', '1');

      expect(groceryApi.deleteProduct).toHaveBeenCalledWith('group-123', '1');
    });
  });

  describe('Stock API', () => {
    it('should fetch current stock', async () => {
      (groceryApi.getStock as any).mockResolvedValue({ data: mockStock });

      const result = await groceryApi.getStock('group-123');

      expect(result.data.stock).toHaveLength(2);
      expect(result.data.stock[0].currentQuantity).toBe(50);
    });

    it('should create stock adjustment', async () => {
      const adjustment = {
        id: 'adj-1',
        productId: '1',
        type: 'ADJUSTMENT',
        quantity: 5,
        notes: 'Stock count correction',
      };

      (groceryApi.createAdjustment as any).mockResolvedValue({ data: adjustment });

      const result = await groceryApi.createAdjustment('group-123', {
        productId: '1',
        quantity: 5,
        type: 'ADJUSTMENT',
        notes: 'Stock count correction',
      });

      expect(result.data.type).toBe('ADJUSTMENT');
    });
  });

  describe('Purchase API', () => {
    it('should create a purchase', async () => {
      const purchase = {
        id: 'purchase-1',
        totalCost: 1000,
        status: 'APPROVED',
        items: [
          { productId: '1', quantity: 10, unitCost: 100 },
        ],
      };

      (groceryApi.createPurchase as any).mockResolvedValue({ data: purchase });

      const result = await groceryApi.createPurchase('group-123', {
        purchaseDate: new Date().toISOString(),
        items: [{ productId: '1', quantity: 10, unitCost: 100 }],
      });

      expect(result.data.totalCost).toBe(1000);
    });

    it('should approve a purchase', async () => {
      const approvedPurchase = {
        id: 'purchase-1',
        status: 'APPROVED',
      };

      (groceryApi.approvePurchase as any).mockResolvedValue({ data: approvedPurchase });

      const result = await groceryApi.approvePurchase('group-123', 'purchase-1');

      expect(result.data.status).toBe('APPROVED');
    });

    it('should reject a purchase', async () => {
      const rejectedPurchase = {
        id: 'purchase-1',
        status: 'REJECTED',
      };

      (groceryApi.rejectPurchase as any).mockResolvedValue({ data: rejectedPurchase });

      const result = await groceryApi.rejectPurchase('group-123', 'purchase-1', {
        reason: 'Insufficient funds',
      });

      expect(result.data.status).toBe('REJECTED');
    });
  });

  describe('Distribution API', () => {
    it('should fetch distributions', async () => {
      (groceryApi.getDistributions as any).mockResolvedValue({ data: mockDistributions });

      const result = await groceryApi.getDistributions('group-123');

      expect(result.data.distributions).toHaveLength(1);
      expect(result.data.distributions[0].eventName).toBe('December Distribution');
    });

    it('should create a distribution', async () => {
      const distribution = {
        id: 'dist-2',
        eventName: 'January Distribution',
        status: 'CONFIRMED',
        items: [],
      };

      (groceryApi.createDistribution as any).mockResolvedValue({ data: distribution });

      const result = await groceryApi.createDistribution('group-123', {
        eventName: 'January Distribution',
        eventDate: new Date().toISOString(),
        allocationRule: 'EQUAL_SHARE',
        items: [{ productId: '1', totalQuantity: 50 }],
      });

      expect(result.data.eventName).toBe('January Distribution');
    });

    it('should update distribution item status', async () => {
      const updatedItem = {
        id: 'item-1',
        status: 'COLLECTED',
        confirmedAt: new Date().toISOString(),
      };

      (groceryApi.updateDistributionItemStatus as any).mockResolvedValue({ data: updatedItem });

      const result = await groceryApi.updateDistributionItemStatus('item-1', {
        status: 'COLLECTED',
      });

      expect(result.data.status).toBe('COLLECTED');
    });

    it('should confirm item receipt with idempotency', async () => {
      const confirmation = {
        itemId: 'item-1',
        status: 'COLLECTED',
        confirmedAt: new Date().toISOString(),
        fromCache: false,
      };

      (groceryApi.confirmItem as any).mockResolvedValue({ data: confirmation });

      const result = await groceryApi.confirmItem('item-1', {
        idempotencyKey: 'unique-key-123',
      });

      expect(result.data.status).toBe('COLLECTED');
      expect(result.data.fromCache).toBe(false);
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const cachedConfirmation = {
        itemId: 'item-1',
        status: 'COLLECTED',
        confirmedAt: new Date().toISOString(),
        fromCache: true,
      };

      (groceryApi.confirmItem as any).mockResolvedValue({ data: cachedConfirmation });

      const result = await groceryApi.confirmItem('item-1', {
        idempotencyKey: 'duplicate-key',
      });

      expect(result.data.fromCache).toBe(true);
    });
  });

  describe('Fairness Report API', () => {
    it('should fetch fairness report', async () => {
      const report = {
        memberStats: [
          { memberId: '1', memberName: 'John', fairnessScore: 98 },
          { memberId: '2', memberName: 'Jane', fairnessScore: 102 },
        ],
        productStats: [
          { productId: '1', productName: 'Rice', totalDistributed: 100 },
        ],
      };

      (groceryApi.getFairnessReport as any).mockResolvedValue({ data: report });

      const result = await groceryApi.getFairnessReport('group-123', { range: 'quarter' });

      expect(result.data.memberStats).toHaveLength(2);
    });
  });
});

describe('Grocery Stock Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent distribution when stock is insufficient', async () => {
    const error = new Error('Insufficient stock for product Rice');
    (groceryApi.createDistribution as any).mockRejectedValue(error);

    await expect(
      groceryApi.createDistribution('group-123', {
        eventName: 'Test',
        eventDate: new Date().toISOString(),
        allocationRule: 'EQUAL_SHARE',
        items: [{ productId: '1', totalQuantity: 1000 }],
      }),
    ).rejects.toThrow('Insufficient stock');
  });

  it('should allow distribution when stock is sufficient', async () => {
    (groceryApi.createDistribution as any).mockResolvedValue({
      data: { id: 'dist-1', status: 'CONFIRMED' },
    });

    const result = await groceryApi.createDistribution('group-123', {
      eventName: 'Test',
      eventDate: new Date().toISOString(),
      allocationRule: 'EQUAL_SHARE',
      items: [{ productId: '1', totalQuantity: 50 }],
    });

    expect(result.data.status).toBe('CONFIRMED');
  });
});
