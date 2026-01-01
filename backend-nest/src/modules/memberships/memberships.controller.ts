import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TreasurerOrHigher, AnyMember, ChairpersonOnly } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('memberships')
@Controller({ path: 'groups/:groupId/members', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @TreasurerOrHigher()
  @ApiOperation({ summary: 'Add a member to the group' })
  @ApiResponse({ status: 201, description: 'Member added' })
  addMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipsService.addMember(groupId, dto, user.id);
  }

  @Get()
  @AnyMember()
  @ApiOperation({ summary: 'Get all members of a group' })
  @ApiResponse({ status: 200, description: 'Members list' })
  getMembers(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.membershipsService.getMembers(groupId);
  }

  @Get(':userId')
  @AnyMember()
  @ApiOperation({ summary: 'Get a specific member' })
  @ApiResponse({ status: 200, description: 'Member details' })
  getMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.membershipsService.getMember(groupId, userId);
  }

  @Patch(':memberId')
  @ChairpersonOnly()
  @ApiOperation({ summary: 'Update member role or status' })
  @ApiResponse({ status: 200, description: 'Member updated' })
  updateMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipsService.updateMember(groupId, memberId, dto, user.id);
  }

  @Delete(':memberId')
  @ChairpersonOnly()
  @ApiOperation({ summary: 'Remove a member from the group' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  removeMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipsService.removeMember(groupId, memberId, user.id);
  }
}
