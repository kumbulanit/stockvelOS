import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { S3Service } from './s3.service';
import { AuditService } from '../audit/audit.service';
import { DocumentType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface UploadFileInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  type: DocumentType;
  groupId?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private auditService: AuditService,
  ) {}

  async uploadDocument(input: UploadFileInput, userId: string) {
    // If groupId provided, verify user is member
    if (input.groupId) {
      const membership = await this.prisma.groupMember.findFirst({
        where: {
          groupId: input.groupId,
          userId,
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this group');
      }
    }

    // Upload to S3
    const folder = input.type.toLowerCase().replace(/_/g, '-');
    const { key, bucket } = await this.s3Service.uploadFile(
      input.buffer,
      input.mimeType,
      folder,
    );

    // Generate safe filename
    const ext = input.originalFilename.split('.').pop() || '';
    const filename = `${uuidv4()}.${ext}`;

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        uploaderId: userId,
        groupId: input.groupId,
        type: input.type,
        filename,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        storageKey: key,
        storageBucket: bucket,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'DOCUMENT',
      resourceId: document.id,
      groupId: input.groupId,
      afterState: {
        type: input.type,
        filename: input.originalFilename,
        size: input.buffer.length,
      },
      outcome: 'SUCCESS',
    });

    return document;
  }

  async getDocument(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: {
        uploader: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check access: uploader, or member of same group
    if (document.uploaderId !== userId) {
      if (document.groupId) {
        const membership = await this.prisma.groupMember.findFirst({
          where: {
            groupId: document.groupId,
            userId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        });

        if (!membership) {
          throw new ForbiddenException('You do not have access to this document');
        }
      } else {
        throw new ForbiddenException('You do not have access to this document');
      }
    }

    return document;
  }

  async getDownloadUrl(id: string, userId: string) {
    const document = await this.getDocument(id, userId);
    
    const url = await this.s3Service.getSignedDownloadUrl(document.storageKey);
    
    return {
      url,
      filename: document.originalFilename,
      mimeType: document.mimeType,
      expiresIn: 900, // 15 minutes
    };
  }

  async getUploadUrl(
    type: DocumentType,
    filename: string,
    mimeType: string,
    groupId: string | undefined,
    userId: string,
  ) {
    // If groupId provided, verify user is member
    if (groupId) {
      const membership = await this.prisma.groupMember.findFirst({
        where: {
          groupId,
          userId,
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this group');
      }
    }

    const folder = type.toLowerCase().replace(/_/g, '-');
    const ext = filename.split('.').pop() || '';
    const key = `${folder}/${uuidv4()}.${ext}`;

    const url = await this.s3Service.getSignedUploadUrl(key, mimeType);

    return {
      url,
      key,
      expiresIn: 3600, // 1 hour
      // Client should call confirmUpload after uploading to this URL
    };
  }

  async confirmUpload(
    key: string,
    originalFilename: string,
    mimeType: string,
    sizeBytes: number,
    type: DocumentType,
    groupId: string | undefined,
    userId: string,
  ) {
    const document = await this.prisma.document.create({
      data: {
        uploaderId: userId,
        groupId,
        type,
        filename: key.split('/').pop() || key,
        originalFilename,
        mimeType,
        sizeBytes,
        storageKey: key,
        storageBucket: 'stockvel-documents', // Should come from config
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'DOCUMENT',
      resourceId: document.id,
      groupId,
      afterState: { type, filename: originalFilename },
      outcome: 'SUCCESS',
    });

    return document;
  }

  async deleteDocument(id: string, userId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Only uploader or group chairperson can delete
    if (document.uploaderId !== userId) {
      if (document.groupId) {
        const membership = await this.prisma.groupMember.findFirst({
          where: {
            groupId: document.groupId,
            userId,
            role: 'CHAIRPERSON',
            status: 'ACTIVE',
            deletedAt: null,
          },
        });

        if (!membership) {
          throw new ForbiddenException('Only uploader or chairperson can delete documents');
        }
      } else {
        throw new ForbiddenException('Only uploader can delete this document');
      }
    }

    // Soft delete in database
    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Delete from S3
    await this.s3Service.deleteFile(document.storageKey);

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'DOCUMENT_DELETED',
      resourceType: 'DOCUMENT',
      resourceId: id,
      groupId: document.groupId,
      outcome: 'SUCCESS',
    });

    return { success: true };
  }

  async getGroupDocuments(groupId: string, userId: string, type?: DocumentType) {
    // Verify membership
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return this.prisma.document.findMany({
      where: {
        groupId,
        deletedAt: null,
        ...(type && { type }),
      },
      include: {
        uploader: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
