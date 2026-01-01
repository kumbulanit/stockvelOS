import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChairpersonOnly, AnyMember } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { GroupType } from '@prisma/client';

@ApiTags('groups')
@Controller({ path: 'groups', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: AuthUser) {
    return this.groupsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all groups for current user' })
  @ApiResponse({ status: 200, description: 'Groups retrieved' })
  @ApiQuery({ name: 'type', required: false, enum: GroupType })
  findAll(@CurrentUser() user: AuthUser, @Query('type') type?: GroupType) {
    return this.groupsService.findAll(user.id, type);
  }

  @Get(':groupId')
  @UseGuards(RolesGuard)
  @AnyMember()
  @ApiOperation({ summary: 'Get group details' })
  @ApiResponse({ status: 200, description: 'Group details' })
  findOne(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.groupsService.findOne(groupId);
  }

  @Patch(':groupId')
  @UseGuards(RolesGuard)
  @ChairpersonOnly()
  @ApiOperation({ summary: 'Update group details' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.groupsService.update(groupId, dto, user.id);
  }

  @Delete(':groupId')
  @UseGuards(RolesGuard)
  @ChairpersonOnly()
  @ApiOperation({ summary: 'Delete/dissolve a group' })
  @ApiResponse({ status: 200, description: 'Group deleted' })
  remove(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user: AuthUser) {
    return this.groupsService.remove(groupId, user.id);
  }
}
