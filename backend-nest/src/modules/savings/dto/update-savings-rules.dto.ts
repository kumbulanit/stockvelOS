import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSavingsGroupDto } from './create-savings-group.dto';

export class UpdateSavingsRulesDto extends PartialType(
  OmitType(CreateSavingsGroupDto, ['name', 'description', 'currency'] as const),
) {}
