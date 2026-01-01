import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationType, NotificationChannel } from '@prisma/client';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  data?: Record<string, any>;
  groupId?: string;
  contributionId?: string;
  payoutId?: string;
}

export interface BulkNotificationPayload {
  userIds: string[];
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  data?: Record<string, any>;
  groupId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  async send(payload: NotificationPayload) {
    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: payload.channels[0], // Primary channel
        title: payload.title,
        body: payload.body,
        data: payload.data,
        groupId: payload.groupId,
        contributionId: payload.contributionId,
        payoutId: payload.payoutId,
      },
    });

    // Queue notification for each channel
    for (const channel of payload.channels) {
      await this.notificationsQueue.add('send-notification', {
        notificationId: notification.id,
        userId: payload.userId,
        channel,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });
    }

    return notification;
  }

  async sendBulk(payload: BulkNotificationPayload) {
    const notifications = await this.prisma.$transaction(
      payload.userIds.map((userId) =>
        this.prisma.notification.create({
          data: {
            userId,
            type: payload.type,
            channel: payload.channels[0],
            title: payload.title,
            body: payload.body,
            data: payload.data,
            groupId: payload.groupId,
          },
        }),
      ),
    );

    // Queue all notifications
    const jobs = [];
    for (const notification of notifications) {
      for (const channel of payload.channels) {
        jobs.push({
          name: 'send-notification',
          data: {
            notificationId: notification.id,
            userId: notification.userId,
            channel,
            title: payload.title,
            body: payload.body,
            data: payload.data,
          },
        });
      }
    }

    await this.notificationsQueue.addBulk(jobs);

    return notifications;
  }

  async scheduleContributionReminders(groupId: string, dueDate: Date) {
    // Get group and members
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: { user: true },
        },
        savingsRule: true,
      },
    });

    if (!group || !group.savingsRule) {
      return;
    }

    // Schedule reminders 3 days, 1 day, and on due date
    const reminderOffsets = [3, 1, 0]; // days before due date

    for (const offset of reminderOffsets) {
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - offset);

      // Only schedule if reminder is in the future
      if (reminderDate > new Date()) {
        const delay = reminderDate.getTime() - Date.now();

        for (const member of group.members) {
          await this.notificationsQueue.add(
            'contribution-reminder',
            {
              userId: member.userId,
              email: member.user.email,
              phone: member.user.phone,
              memberName: `${member.user.firstName} ${member.user.lastName}`,
              groupName: group.name,
              amount: group.savingsRule.contributionAmount.toNumber(),
              dueDate: dueDate.toISOString(),
              daysUntilDue: offset,
            },
            {
              delay,
              jobId: `reminder-${groupId}-${member.userId}-${offset}`,
            },
          );
        }
      }
    }

    this.logger.log(`Scheduled contribution reminders for group ${groupId}`);
  }

  async cancelScheduledReminders(groupId: string) {
    const jobs = await this.notificationsQueue.getJobs([
      'delayed',
      'waiting',
    ]);

    for (const job of jobs) {
      if (job.id?.startsWith(`reminder-${groupId}`)) {
        await job.remove();
      }
    }
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          group: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async notifyContributionApproved(
    userId: string,
    email: string,
    phone: string | null,
    memberName: string,
    groupName: string,
    amount: number,
    reference: string,
  ) {
    await this.notificationsQueue.add('contribution-approved', {
      userId,
      email,
      phone,
      memberName,
      groupName,
      amount,
      reference,
    });
  }

  async notifyPayoutScheduled(
    userId: string,
    email: string,
    phone: string | null,
    memberName: string,
    groupName: string,
    amount: number,
    payoutDate: Date,
  ) {
    await this.notificationsQueue.add('payout-scheduled', {
      userId,
      email,
      phone,
      memberName,
      groupName,
      amount,
      payoutDate: payoutDate.toISOString(),
    });
  }
}
