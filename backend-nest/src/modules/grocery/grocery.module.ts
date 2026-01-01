import { Module } from '@nestjs/common';
import { GroceryController } from './grocery.controller';
import { GroceryService } from './grocery.service';
import { ProductService } from './services/product.service';
import { PurchaseService } from './services/purchase.service';
import { StockService } from './services/stock.service';
import { DistributionService } from './services/distribution.service';
import { GroceryMemberController } from './grocery-member.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { MembershipsModule } from '../memberships/memberships.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    LedgerModule,
    NotificationsModule,
    DocumentsModule,
    MembershipsModule,
  ],
  controllers: [GroceryController, GroceryMemberController],
  providers: [
    GroceryService,
    ProductService,
    PurchaseService,
    StockService,
    DistributionService,
  ],
  exports: [GroceryService, StockService],
})
export class GroceryModule {}
