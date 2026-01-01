import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SavingsPayoutsService } from './savings-payouts.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ApprovePayoutDto, RejectPayoutDto } from './dto/approve-payout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TreasurerOrHigher, AnyMember } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('savings')
@Controller({ version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SavingsPayoutsController {
  constructor(private readonly payoutsService: SavingsPayoutsService) {}

  @Post('groups/:groupId/savings/payouts')
  @TreasurerOrHigher()
  @ApiOperation({ summary: 'Create a new payout request' })
  @ApiResponse({ status: 201, description: 'Payout created' })
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreatePayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payoutsService.createPayout(groupId, dto, user.id);
  }

  @Get('groups/:groupId/savings/payouts')
  @AnyMember()
  @ApiOperation({ summary: 'Get all payouts for a group' })
  @ApiResponse({ status: 200, description: 'Payouts list' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  findAll(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.payoutsService.getPayouts(groupId, { status, limit, offset });
  }

  @Get('savings/payouts/:payoutId')
  @ApiOperation({ summary: 'Get payout details' })
  @ApiResponse({ status: 200, description: 'Payout details' })
  findOne(@Param('payoutId', ParseUUIDPipe) payoutId: string) {
    return this.payoutsService.getPayout(payoutId);
  }

  @Post('savings/payouts/:payoutId/approve')
  @ApiOperation({ summary: 'Approve a payout' })
  @ApiResponse({ status: 200, description: 'Payout approval recorded' })
  approve(
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body() dto: ApprovePayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payoutsService.approvePayout(payoutId, dto, user.id);
  }

  @Post('savings/payouts/:payoutId/reject')
  @ApiOperation({ summary: 'Reject a payout' })
  @ApiResponse({ status: 200, description: 'Payout rejected' })
  reject(
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body() dto: RejectPayoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payoutsService.rejectPayout(payoutId, dto, user.id);
  }

  @Delete('savings/payouts/:payoutId')
  @ApiOperation({ summary: 'Cancel a pending payout' })
  @ApiResponse({ status: 200, description: 'Payout cancelled' })
  cancel(
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payoutsService.cancelPayout(payoutId, user.id);
  }
}
