import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'localhost'),
      port: this.configService.get('SMTP_PORT', 1025),
      secure: this.configService.get('SMTP_SECURE', false),
      auth: this.configService.get('SMTP_USER')
        ? {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS'),
          }
        : undefined,
    });
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    try {
      const fromAddress = this.configService.get(
        'EMAIL_FROM',
        'noreply@stockvel.app',
      );

      await this.transporter.sendMail({
        from: fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${payload.to}`, error);
      throw error;
    }
  }

  async sendContributionReminder(
    to: string,
    memberName: string,
    groupName: string,
    amount: number,
    dueDate: Date,
  ): Promise<boolean> {
    const subject = `Contribution Reminder - ${groupName}`;
    const html = `
      <h2>Hi ${memberName},</h2>
      <p>This is a friendly reminder that your contribution of <strong>R${amount.toFixed(2)}</strong> to <strong>${groupName}</strong> is due on <strong>${dueDate.toLocaleDateString()}</strong>.</p>
      <p>Please ensure your payment is made on time to maintain your good standing in the group.</p>
      <p>Thank you for being a valued member of the stokvel!</p>
      <p>Best regards,<br>Stockvel OS Team</p>
    `;

    return this.sendEmail({ to, subject, html });
  }

  async sendContributionConfirmation(
    to: string,
    memberName: string,
    groupName: string,
    amount: number,
    reference: string,
  ): Promise<boolean> {
    const subject = `Contribution Confirmed - ${groupName}`;
    const html = `
      <h2>Hi ${memberName},</h2>
      <p>Your contribution of <strong>R${amount.toFixed(2)}</strong> to <strong>${groupName}</strong> has been confirmed.</p>
      <p>Reference: <strong>${reference}</strong></p>
      <p>Thank you for your contribution!</p>
      <p>Best regards,<br>Stockvel OS Team</p>
    `;

    return this.sendEmail({ to, subject, html });
  }

  async sendPayoutNotification(
    to: string,
    memberName: string,
    groupName: string,
    amount: number,
    payoutDate: Date,
  ): Promise<boolean> {
    const subject = `Payout Scheduled - ${groupName}`;
    const html = `
      <h2>Hi ${memberName},</h2>
      <p>A payout of <strong>R${amount.toFixed(2)}</strong> from <strong>${groupName}</strong> has been scheduled for <strong>${payoutDate.toLocaleDateString()}</strong>.</p>
      <p>The funds will be transferred to your registered bank account.</p>
      <p>Best regards,<br>Stockvel OS Team</p>
    `;

    return this.sendEmail({ to, subject, html });
  }

  async sendGroupInvitation(
    to: string,
    inviterName: string,
    groupName: string,
    inviteLink: string,
  ): Promise<boolean> {
    const subject = `You're invited to join ${groupName}`;
    const html = `
      <h2>Hello,</h2>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${groupName}</strong> on Stockvel OS.</p>
      <p>Click the link below to accept the invitation:</p>
      <p><a href="${inviteLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>Stockvel OS Team</p>
    `;

    return this.sendEmail({ to, subject, html });
  }
}
