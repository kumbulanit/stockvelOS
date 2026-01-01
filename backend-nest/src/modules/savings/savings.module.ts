import { Module } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { SavingsPayoutsController } from './savings-payouts.controller';
import { SavingsPayoutsService } from './savings-payouts.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [SavingsController, SavingsPayoutsController],
  providers: [SavingsService, SavingsPayoutsService],
  exports: [SavingsService, SavingsPayoutsService],
})
export class SavingsModule {}
