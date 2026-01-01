import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnyMember } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('ledger')
@Controller({ path: 'groups/:groupId/ledger', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @AnyMember()
  @ApiOperation({ summary: 'Get ledger entries for a group' })
  @ApiResponse({ status: 200, description: 'Ledger entries retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'entryType', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getLedgerEntries(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('entryType') entryType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ledgerService.getEntries(groupId, {
      limit: limit || 50,
      offset: offset || 0,
      entryType: entryType as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('summary')
  @AnyMember()
  @ApiOperation({ summary: 'Get ledger summary for a group' })
  @ApiResponse({ status: 200, description: 'Ledger summary retrieved' })
  async getLedgerSummary(@Param('groupId', ParseUUIDPipe) groupId: string) {
    const summary = await this.ledgerService.getSummary(groupId);
    return {
      ...summary,
      currentBalance: summary.currentBalance.toString(),
      totalCredits: summary.totalCredits.toString(),
      totalDebits: summary.totalDebits.toString(),
    };
  }

  @Get('balance')
  @AnyMember()
  @ApiOperation({ summary: 'Get current pot balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved' })
  async getBalance(@Param('groupId', ParseUUIDPipe) groupId: string) {
    const balance = await this.ledgerService.getBalance(groupId);
    return { balance: balance.toString(), currency: 'ZAR' };
  }

  @Get('members/:userId/statement')
  @AnyMember()
  @ApiOperation({ summary: 'Get member statement' })
  @ApiResponse({ status: 200, description: 'Member statement retrieved' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getMemberStatement(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const statement = await this.ledgerService.getMemberStatement(
      groupId,
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return {
      ...statement,
      totalContributed: statement.totalContributed.toString(),
      groupBalance: statement.groupBalance.toString(),
      estimatedShare: statement.estimatedShare.toString(),
    };
  }

  @Get('me/statement')
  @AnyMember()
  @ApiOperation({ summary: 'Get my statement for this group' })
  @ApiResponse({ status: 200, description: 'Statement retrieved' })
  async getMyStatement(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const statement = await this.ledgerService.getMemberStatement(
      groupId,
      user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return {
      ...statement,
      totalContributed: statement.totalContributed.toString(),
      groupBalance: statement.groupBalance.toString(),
      estimatedShare: statement.estimatedShare.toString(),
    };
  }
}
