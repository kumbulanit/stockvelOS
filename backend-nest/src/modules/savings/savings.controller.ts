import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SavingsService } from './savings.service';
import { CreateSavingsGroupDto } from './dto/create-savings-group.dto';
import { UpdateSavingsRulesDto } from './dto/update-savings-rules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChairpersonOnly, AnyMember } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('savings')
@Controller({ path: 'groups/savings', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new savings group' })
  @ApiResponse({ status: 201, description: 'Savings group created' })
  create(@Body() dto: CreateSavingsGroupDto, @CurrentUser() user: AuthUser) {
    return this.savingsService.createSavingsGroup(dto, user.id);
  }

  @Get(':groupId')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Get savings group details' })
  @ApiResponse({ status: 200, description: 'Savings group details' })
  findOne(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.savingsService.getSavingsGroup(groupId);
  }

  @Patch(':groupId/rules')
  @UseGuards(RolesGuard)
  @ChairpersonOnly()
  @ApiOperation({ summary: 'Update savings group rules' })
  @ApiResponse({ status: 200, description: 'Rules updated' })
  updateRules(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateSavingsRulesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.savingsService.updateSavingsRules(groupId, dto, user.id);
  }

  @Get(':groupId/summary')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Get savings group summary/dashboard' })
  @ApiResponse({ status: 200, description: 'Savings summary' })
  getSummary(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.savingsService.getSavingsSummary(groupId);
  }

  @Get(':groupId/members/:userId/status')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Get member savings status' })
  @ApiResponse({ status: 200, description: 'Member status' })
  getMemberStatus(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.savingsService.getMemberSavingsStatus(groupId, userId);
  }

  @Get(':groupId/me/status')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Get my savings status in this group' })
  @ApiResponse({ status: 200, description: 'My status' })
  getMyStatus(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.savingsService.getMemberSavingsStatus(groupId, user.id);
  }
}
