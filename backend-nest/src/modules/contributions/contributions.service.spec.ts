import { Test, TestingModule } from '@nestjs/testing';
import { ContributionsService } from './contributions.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { DocumentsService } from '../documents/documents.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';

describe('ContributionsService', () => {
  let service: ContributionsService;
  let prismaService: PrismaService;
  let ledgerService: LedgerService;

  const mockPrismaService = {
    groupMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    savingsRule: {
      findUnique: jest.fn(),
    },
    contribution: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockLedgerService = {
    creditContribution: jest.fn(),
  };

  const mockDocumentsService = {};

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockNotificationsService = {
    notifyContributionApproved: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContributionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: DocumentsService, useValue: mockDocumentsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ContributionsService>(ContributionsService);
    prismaService = module.get<PrismaService>(PrismaService);
    ledgerService = module.get<LedgerService>(LedgerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      groupId: 'group-1',
      amount: 100,
      paymentMethod: 'BANK_TRANSFER',
      externalReference: 'REF123',
      paymentDate: new Date(),
      contributionPeriod: '2024-01',
    };

    const mockMembership = {
      id: 'member-1',
      userId: 'user-1',
      groupId: 'group-1',
      role: 'MEMBER',
      status: 'ACTIVE',
      deletedAt: null,
      group: {
        id: 'group-1',
        type: 'SAVINGS',
        status: 'ACTIVE',
        deletedAt: null,
      },
    };

    const mockSavingsRule = {
      contributionAmount: new Decimal(100),
      contributionDay: 1,
    };

    it('should create a contribution successfully', async () => {
      mockPrismaService.groupMember.findFirst.mockResolvedValue(mockMembership);
      mockPrismaService.savingsRule.findUnique.mockResolvedValue(mockSavingsRule);
      mockPrismaService.contribution.findFirst.mockResolvedValue(null);
      mockPrismaService.contribution.create.mockResolvedValue({
        id: 'contribution-1',
        ...createDto,
        memberId: 'member-1',
        status: 'PENDING',
        createdAt: new Date(),
      });

      const result = await service.create(createDto, 'user-1');

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('PENDING');
      expect(mockPrismaService.contribution.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user not member', async () => {
      mockPrismaService.groupMember.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException for duplicate period', async () => {
      mockPrismaService.groupMember.findFirst.mockResolvedValue(mockMembership);
      mockPrismaService.savingsRule.findUnique.mockResolvedValue(mockSavingsRule);
      mockPrismaService.contribution.findFirst.mockResolvedValue({
        id: 'existing-contribution',
        status: 'APPROVED',
      });

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('approve', () => {
    const mockContribution = {
      id: 'contribution-1',
      memberId: 'member-1',
      groupId: 'group-1',
      amount: new Decimal(100),
      status: 'PENDING',
      contributionPeriod: '2024-01',
      member: {
        id: 'member-1',
        userId: 'user-1',
        user: {
          id: 'user-1',
          email: 'member@test.com',
          phone: '+27123456789',
          firstName: 'Test',
          lastName: 'Member',
        },
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
      },
    };

    const mockTreasurerMembership = {
      id: 'member-2',
      role: 'TREASURER',
      status: 'ACTIVE',
      deletedAt: null,
    };

    it('should approve a contribution and credit ledger', async () => {
      mockPrismaService.contribution.findUnique.mockResolvedValue(mockContribution);
      mockPrismaService.groupMember.findFirst.mockResolvedValue(mockTreasurerMembership);
      mockPrismaService.contribution.update.mockResolvedValue({
        ...mockContribution,
        status: 'APPROVED',
      });
      mockLedgerService.creditContribution.mockResolvedValue({
        id: 'entry-1',
        balanceAfter: new Decimal(100),
      });

      const result = await service.approve(
        'contribution-1',
        { notes: 'Verified payment' },
        'treasurer-user-id',
      );

      expect(result.status).toBe('APPROVED');
      expect(mockLedgerService.creditContribution).toHaveBeenCalled();
      expect(mockNotificationsService.notifyContributionApproved).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid contribution', async () => {
      mockPrismaService.contribution.findUnique.mockResolvedValue(null);

      await expect(
        service.approve('invalid-id', {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not treasurer', async () => {
      mockPrismaService.contribution.findUnique.mockResolvedValue(mockContribution);
      mockPrismaService.groupMember.findFirst.mockResolvedValue({
        ...mockTreasurerMembership,
        role: 'MEMBER',
      });

      await expect(
        service.approve('contribution-1', {}, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject', () => {
    it('should reject a contribution with reason', async () => {
      const mockContribution = {
        id: 'contribution-1',
        memberId: 'member-1',
        groupId: 'group-1',
        status: 'PENDING',
        member: {
          user: { id: 'user-1' },
          group: { name: 'Test Group' },
        },
      };

      mockPrismaService.contribution.findUnique.mockResolvedValue(mockContribution);
      mockPrismaService.groupMember.findFirst.mockResolvedValue({
        id: 'treasurer-member',
        role: 'TREASURER',
        status: 'ACTIVE',
        deletedAt: null,
      });
      mockPrismaService.contribution.update.mockResolvedValue({
        ...mockContribution,
        status: 'REJECTED',
        rejectionReason: 'Invalid proof of payment',
      });

      const result = await service.reject(
        'contribution-1',
        { reason: 'Invalid proof of payment' },
        'treasurer-user-id',
      );

      expect(result.status).toBe('REJECTED');
    });
  });

  describe('getMyContributions', () => {
    it('should return paginated contributions for user', async () => {
      const mockContributions = [
        { id: 'c1', amount: new Decimal(100), status: 'APPROVED' },
        { id: 'c2', amount: new Decimal(100), status: 'PENDING' },
      ];

      mockPrismaService.groupMember.findFirst.mockResolvedValue({
        id: 'member-1',
      });
      mockPrismaService.contribution.findMany.mockResolvedValue(mockContributions);
      mockPrismaService.contribution.count.mockResolvedValue(2);

      const result = await service.getMyContributions('group-1', 'user-1', 1, 20);

      expect(result.contributions).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });
  });
});
