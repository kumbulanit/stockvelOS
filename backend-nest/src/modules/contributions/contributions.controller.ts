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
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { ApproveContributionDto, RejectContributionDto } from './dto/approve-contribution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TreasurerOrHigher, AnyMember } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('contributions')
@Controller({ version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('groups/:groupId/contributions')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Submit a new contribution' })
  @ApiResponse({ status: 201, description: 'Contribution created' })
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateContributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contributionsService.create(groupId, dto, user.id);
  }

  @Get('groups/:groupId/contributions')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Get all contributions for a group' })
  @ApiResponse({ status: 200, description: 'Contributions list' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'memberId', required: false })
  @ApiQuery({ name: 'periodStart', required: false })
  @ApiQuery({ name: 'periodEnd', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  findAll(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('status') status?: string,
    @Query('memberId') memberId?: string,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.contributionsService.findAll(groupId, {
      status,
      memberId,
      periodStart,
      periodEnd,
      limit,
      offset,
    });
  }

  @Get('contributions/:id')
  @ApiOperation({ summary: 'Get contribution details' })
  @ApiResponse({ status: 200, description: 'Contribution details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contributionsService.findOne(id);
  }

  @Post('contributions/:id/approve')
  @ApiOperation({ summary: 'Approve a contribution' })
  @ApiResponse({ status: 200, description: 'Contribution approved' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveContributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contributionsService.approve(id, dto, user.id);
  }

  @Post('contributions/:id/reject')
  @ApiOperation({ summary: 'Reject a contribution' })
  @ApiResponse({ status: 200, description: 'Contribution rejected' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectContributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contributionsService.reject(id, dto, user.id);
  }

  @Delete('contributions/:id')
  @ApiOperation({ summary: 'Cancel a pending contribution' })
  @ApiResponse({ status: 200, description: 'Contribution cancelled' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contributionsService.cancel(id, user.id);
  }

  @Get('me/contributions')
  @ApiOperation({ summary: 'Get my contributions across all groups' })
  @ApiResponse({ status: 200, description: 'My contributions' })
  @ApiQuery({ name: 'groupId', required: false })
  getMyContributions(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
  ) {
    return this.contributionsService.getMyContributions(user.id, groupId);
  }

  @Get('me/statements/savings')
  @ApiOperation({ summary: 'Get my savings statements across all groups' })
  @ApiResponse({ status: 200, description: 'My savings statements' })
  async getMySavingsStatements(@CurrentUser() user: AuthUser) {
    // Get all savings groups user belongs to
    const memberships = await this.contributionsService['prisma'].groupMember.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        group: { type: 'SAVINGS', deletedAt: null },
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    const statements = await Promise.all(
      memberships.map(async (m) => {
        const contributions = await this.contributionsService.getMyContributions(
          user.id,
          m.groupId,
        );
        const totalContributed = contributions
          .filter((c: any) => c.status === 'APPROVED')
          .reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0);

        return {
          groupId: m.groupId,
          groupName: m.group.name,
          role: m.role,
          totalContributed,
          contributionCount: contributions.filter((c: any) => c.status === 'APPROVED').length,
          recentContributions: contributions.slice(0, 5),
        };
      }),
    );

    return statements;
  }
}
