import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GroceryService } from './grocery.service';
import { DistributionService } from './services/distribution.service';
import {
  UpdateDistributionItemStatusDto,
  ConfirmDistributionItemDto,
} from './dto/distribution.dto';
import { MemberRole } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class GroceryMemberController {
  private readonly TREASURER_OR_CHAIR: MemberRole[] = ['TREASURER', 'CHAIRPERSON'];
  private readonly ALL_MEMBERS: MemberRole[] = ['MEMBER', 'TREASURER', 'SECRETARY', 'CHAIRPERSON'];

  constructor(
    private groceryService: GroceryService,
    private distributionService: DistributionService,
  ) {}

  // ==================== MY GROCERY GROUPS ====================

  @Get('me/grocery/groups')
  async getMyGroceryGroups(@CurrentUser() user: any) {
    return this.groceryService.getUserGroceryGroups(user.id);
  }

  @Get('me/grocery/groups/:groupId/allocations')
  async getMyAllocations(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    await this.groceryService.validateMemberRole(groupId, user.id, this.ALL_MEMBERS);
    return this.distributionService.getMemberAllocations(groupId, user.id);
  }

  @Get('me/grocery/groups/:groupId/history')
  async getMyHistory(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: any,
  ) {
    await this.groceryService.validateGroceryGroup(groupId);
    const { membership } = await this.groceryService.validateMemberRole(
      groupId,
      user.id,
      this.ALL_MEMBERS,
    );
    return this.distributionService.getMemberHistory(groupId, membership.id);
  }

  // ==================== DISTRIBUTION ITEMS ====================

  @Patch('grocery/distribution-items/:itemId/status')
  async updateDistributionItemStatus(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateDistributionItemStatusDto,
    @CurrentUser() user: any,
  ) {
    // Get item to find group
    const item = await this.getItemWithGroup(itemId);
    const { role } = await this.groceryService.validateMemberRole(
      item.groupId,
      user.id,
      this.TREASURER_OR_CHAIR,
    );

    return this.distributionService.updateItemStatus(
      itemId,
      dto,
      user.id,
      true, // isTreasurer
    );
  }

  @Post('grocery/distribution-items/:itemId/confirm')
  async confirmDistributionItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ConfirmDistributionItemDto,
    @CurrentUser() user: any,
  ) {
    return this.distributionService.confirmItem(itemId, dto, user.id);
  }

  // Helper to get item with group context
  private async getItemWithGroup(itemId: string): Promise<{ groupId: string }> {
    // This would be injected, but for simplicity accessing prisma directly
    const item = await (this.distributionService as any).prisma.groceryDistributionItem.findUnique({
      where: { id: itemId },
      include: { distribution: { select: { groupId: true } } },
    });

    if (!item) {
      throw new Error('Distribution item not found');
    }

    return { groupId: item.distribution.groupId };
  }
}
