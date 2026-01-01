import { Module } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { ContributionsController } from './contributions.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [LedgerModule, DocumentsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
