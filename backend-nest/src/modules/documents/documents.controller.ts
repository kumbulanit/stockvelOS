import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { DocumentType } from '@prisma/client';
import { IsString, IsEnum, IsOptional, IsNumber, IsUUID } from 'class-validator';

class UploadDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

class GetUploadUrlDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  filename: string;

  @IsString()
  mimeType: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

class ConfirmUploadDto {
  @IsString()
  key: string;

  @IsString()
  originalFilename: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  sizeBytes: number;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

@ApiTags('documents')
@Controller({ path: 'documents', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document directly' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: Object.values(DocumentType) },
        groupId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.uploadDocument(
      {
        buffer: file.buffer,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        type: dto.type,
        groupId: dto.groupId,
      },
      user.id,
    );
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Get a signed URL for direct upload to S3' })
  @ApiResponse({ status: 200, description: 'Signed upload URL' })
  async getUploadUrl(
    @Body() dto: GetUploadUrlDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.getUploadUrl(
      dto.type,
      dto.filename,
      dto.mimeType,
      dto.groupId,
      user.id,
    );
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm upload after using signed URL' })
  @ApiResponse({ status: 201, description: 'Upload confirmed' })
  async confirmUpload(
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.confirmUpload(
      dto.key,
      dto.originalFilename,
      dto.mimeType,
      dto.sizeBytes,
      dto.type,
      dto.groupId,
      user.id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details' })
  @ApiResponse({ status: 200, description: 'Document details' })
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.getDocument(id, user.id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get signed download URL for a document' })
  @ApiResponse({ status: 200, description: 'Download URL' })
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.getDownloadUrl(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.deleteDocument(id, user.id);
  }

  @Get('group/:groupId')
  @ApiOperation({ summary: 'Get all documents for a group' })
  @ApiResponse({ status: 200, description: 'Group documents' })
  @ApiQuery({ name: 'type', required: false, enum: DocumentType })
  async getGroupDocuments(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('type') type: DocumentType,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.getGroupDocuments(groupId, user.id, type);
  }
}
