import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationChannel } from '@prisma/client';

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  @Process('send-notification')
  async handleNotification(job: Job) {
    const { notificationId, userId, channel, title, body, data } = job.data;

    try {
      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true, firstName: true },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      if (channel === NotificationChannel.EMAIL && user.email) {
        await this.emailService.sendEmail({
          to: user.email,
          subject: title,
          html: `<p>${body}</p>`,
        });
      }

      if (channel === NotificationChannel.SMS && user.phone) {
        await this.smsService.sendSms({
          to: user.phone,
          message: body,
        });
      }

      if (channel === NotificationChannel.PUSH) {
        // Push notification implementation would go here
        // (e.g., Firebase Cloud Messaging, OneSignal, etc.)
        this.logger.log(`[PUSH] Would send push notification to ${userId}: ${title}`);
      }

      if (channel === NotificationChannel.IN_APP) {
        // In-app notifications are already stored in DB
        this.logger.log(`[IN_APP] Notification stored for ${userId}: ${title}`);
      }

      // Update notification status
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { sentAt: new Date() },
      });

      this.logger.log(`Notification sent via ${channel} to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification ${notificationId}`, error);
      throw error;
    }
  }

  @Process('contribution-reminder')
  async handleContributionReminder(job: Job) {
    const {
      userId,
      email,
      phone,
      memberName,
      groupName,
      amount,
      dueDate,
      daysUntilDue,
    } = job.data;

    try {
      // Send email
      if (email) {
        await this.emailService.sendContributionReminder(
          email,
          memberName,
          groupName,
          amount,
          new Date(dueDate),
        );
      }

      // Send SMS for same-day and day-before reminders
      if (phone && daysUntilDue <= 1) {
        await this.smsService.sendContributionReminder(
          phone,
          groupName,
          amount,
          new Date(dueDate),
        );
      }

      // Create in-app notification
      let title: string;
      if (daysUntilDue === 0) {
        title = `Contribution due today for ${groupName}`;
      } else if (daysUntilDue === 1) {
        title = `Contribution due tomorrow for ${groupName}`;
      } else {
        title = `Contribution due in ${daysUntilDue} days for ${groupName}`;
      }

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'CONTRIBUTION_REMINDER',
          channel: 'IN_APP',
          title,
          body: `Your R${amount.toFixed(2)} contribution is due${daysUntilDue === 0 ? ' today' : ''}.`,
          sentAt: new Date(),
        },
      });

      this.logger.log(`Contribution reminder sent to ${userId} for ${groupName}`);
    } catch (error) {
      this.logger.error(`Failed to send contribution reminder`, error);
      throw error;
    }
  }

  @Process('contribution-approved')
  async handleContributionApproved(job: Job) {
    const { userId, email, phone, memberName, groupName, amount, reference } =
      job.data;

    try {
      if (email) {
        await this.emailService.sendContributionConfirmation(
          email,
          memberName,
          groupName,
          amount,
          reference,
        );
      }

      if (phone) {
        await this.smsService.sendContributionConfirmation(phone, groupName, amount);
      }

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'CONTRIBUTION_APPROVED',
          channel: 'IN_APP',
          title: `Contribution Confirmed - ${groupName}`,
          body: `Your R${amount.toFixed(2)} contribution has been approved. Reference: ${reference}`,
          sentAt: new Date(),
        },
      });

      this.logger.log(`Contribution approved notification sent to ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send contribution approved notification`, error);
      throw error;
    }
  }

  @Process('payout-scheduled')
  async handlePayoutScheduled(job: Job) {
    const { userId, email, phone, memberName, groupName, amount, payoutDate } =
      job.data;

    try {
      if (email) {
        await this.emailService.sendPayoutNotification(
          email,
          memberName,
          groupName,
          amount,
          new Date(payoutDate),
        );
      }

      if (phone) {
        await this.smsService.sendPayoutNotification(phone, groupName, amount);
      }

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'PAYOUT_SCHEDULED',
          channel: 'IN_APP',
          title: `Payout Scheduled - ${groupName}`,
          body: `A payout of R${amount.toFixed(2)} has been scheduled.`,
          sentAt: new Date(),
        },
      });

      this.logger.log(`Payout scheduled notification sent to ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send payout scheduled notification`, error);
      throw error;
    }
  }
}
