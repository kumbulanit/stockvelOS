import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService, TransactionType } from './ledger.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

describe('LedgerService', () => {
  let service: LedgerService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    ledgerEntry: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEntry', () => {
    it('should create a credit entry and update balance', async () => {
      const entryInput = {
        groupId: 'group-1',
        memberId: 'member-1',
        type: TransactionType.CONTRIBUTION,
        amount: new Decimal(100),
        description: 'Monthly contribution',
        idempotencyKey: 'key-1',
        performedBy: 'user-1',
      };

      const mockEntry = {
        id: 'entry-1',
        ...entryInput,
        direction: 'CREDIT',
        balanceAfter: new Decimal(100),
        createdAt: new Date(),
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          $queryRaw: jest.fn().mockResolvedValue([{ balance: new Decimal(0) }]),
          ledgerEntry: {
            create: jest.fn().mockResolvedValue(mockEntry),
          },
        });
      });

      const result = await service.creditContribution(
        entryInput.groupId,
        entryInput.memberId,
        entryInput.amount,
        'Monthly contribution',
        null,
        entryInput.idempotencyKey,
        entryInput.performedBy,
      );

      expect(result).toHaveProperty('id');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('should return correct balance for a group', async () => {
      mockPrismaService.ledgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(1000) },
      });

      const result = await service.getBalance('group-1');

      expect(result.toString()).toBe('1000');
      expect(mockPrismaService.ledgerEntry.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1' },
        }),
      );
    });

    it('should return zero for empty group', async () => {
      mockPrismaService.ledgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.getBalance('group-1');

      expect(result.toString()).toBe('0');
    });
  });

  describe('getMemberBalance', () => {
    it('should return correct balance for a member', async () => {
      mockPrismaService.ledgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(500) },
      });

      const result = await service.getMemberBalance('group-1', 'member-1');

      expect(result.toString()).toBe('500');
    });
  });

  describe('getSummary', () => {
    it('should return correct summary with credits and debits', async () => {
      mockPrismaService.ledgerEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal(1000) } }) // credits
        .mockResolvedValueOnce({ _sum: { amount: new Decimal(300) } }); // debits

      const result = await service.getSummary('group-1');

      expect(result.totalCredits.toString()).toBe('1000');
      expect(result.totalDebits.toString()).toBe('300');
      expect(result.balance.toString()).toBe('700');
    });
  });

  describe('getMemberStatement', () => {
    it('should return paginated statement entries', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          type: 'CONTRIBUTION',
          amount: new Decimal(100),
          direction: 'CREDIT',
          balanceAfter: new Decimal(100),
          createdAt: new Date(),
        },
        {
          id: 'entry-2',
          type: 'PAYOUT',
          amount: new Decimal(-50),
          direction: 'DEBIT',
          balanceAfter: new Decimal(50),
          createdAt: new Date(),
        },
      ];

      mockPrismaService.ledgerEntry.findMany.mockResolvedValue(mockEntries);

      const result = await service.getMemberStatement('group-1', 'member-1', 1, 20);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.ledgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1', memberId: 'member-1' },
        }),
      );
    });
  });
});
