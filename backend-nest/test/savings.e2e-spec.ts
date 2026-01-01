import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Savings Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let groupId: string;
  let contributionId: string;

  const testUser = {
    email: `savings-test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Savings',
    lastName: 'Tester',
    phone: '+27987654321',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Register and login test user
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);
    
    accessToken = registerRes.body.accessToken;
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (contributionId) {
      await prisma.contribution.deleteMany({ where: { id: contributionId } });
    }
    if (groupId) {
      await prisma.ledgerEntry.deleteMany({ where: { groupId } });
      await prisma.savingsRule.deleteMany({ where: { groupId } });
      await prisma.groupMember.deleteMany({ where: { groupId } });
      await prisma.group.deleteMany({ where: { id: groupId } });
    }
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  describe('Complete Savings Workflow', () => {
    it('should create a savings group', async () => {
      const groupData = {
        name: 'Test Savings Group',
        description: 'E2E Test Savings Group',
        type: 'SAVINGS',
        contributionAmount: 500,
        contributionFrequency: 'MONTHLY',
        contributionDay: 1,
        startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        endDate: new Date(Date.now() + 365 * 86400000).toISOString(), // 1 year from now
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/savings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(groupData)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(groupData.name);
      expect(res.body.type).toBe('SAVINGS');
      groupId = res.body.id;
    });

    it('should get savings group with rules', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/savings/${groupId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(groupId);
      expect(res.body).toHaveProperty('savingsRule');
      expect(res.body.savingsRule.contributionAmount).toBe('500');
    });

    it('should get savings summary', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/savings/${groupId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('groupBalance');
      expect(res.body).toHaveProperty('memberCount');
      expect(res.body).toHaveProperty('myBalance');
    });

    it('should submit a contribution', async () => {
      const contributionData = {
        groupId,
        amount: 500,
        paymentMethod: 'BANK_TRANSFER',
        externalReference: 'TEST-REF-001',
        paymentDate: new Date().toISOString(),
        contributionPeriod: '2024-01',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/contributions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(contributionData)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.amount).toBe('500');
      contributionId = res.body.id;
    });

    it('should get my contributions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/contributions/my/${groupId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('contributions');
      expect(res.body.contributions).toBeInstanceOf(Array);
      expect(res.body.contributions.length).toBeGreaterThanOrEqual(1);
    });

    it('should get pending contributions as treasurer (chairperson)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/contributions/group/${groupId}?status=PENDING`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('contributions');
    });

    it('should update savings rules as chairperson', async () => {
      const updateData = {
        contributionAmount: 600,
        latePaymentPenaltyPercent: 5,
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/savings/${groupId}/rules`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.contributionAmount).toBe('600');
      expect(res.body.latePaymentPenaltyPercent).toBe('5');
    });

    it('should get ledger statement', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/savings/${groupId}/statement`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('entries');
      expect(res.body.entries).toBeInstanceOf(Array);
    });

    it('should list user groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.some((g: any) => g.id === groupId)).toBe(true);
    });
  });
});
