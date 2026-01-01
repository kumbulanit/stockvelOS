import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsPayload {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  async sendSms(payload: SmsPayload): Promise<boolean> {
    // In production, integrate with SMS provider like Twilio, AfricasTalking, etc.
    const provider = this.configService.get('SMS_PROVIDER', 'mock');

    if (provider === 'mock') {
      this.logger.log(`[MOCK SMS] To: ${payload.to}, Message: ${payload.message}`);
      return true;
    }

    if (provider === 'twilio') {
      return this.sendViaTwilio(payload);
    }

    if (provider === 'africas_talking') {
      return this.sendViaAfricasTalking(payload);
    }

    this.logger.warn(`Unknown SMS provider: ${provider}`);
    return false;
  }

  private async sendViaTwilio(payload: SmsPayload): Promise<boolean> {
    try {
      const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
      const fromNumber = this.configService.get('TWILIO_FROM_NUMBER');

      // Dynamic import to avoid requiring twilio when not using it
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);

      await client.messages.create({
        body: payload.message,
        from: fromNumber,
        to: payload.to,
      });

      this.logger.log(`SMS sent via Twilio to ${payload.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS via Twilio to ${payload.to}`, error);
      throw error;
    }
  }

  private async sendViaAfricasTalking(payload: SmsPayload): Promise<boolean> {
    try {
      const username = this.configService.get('AT_USERNAME');
      const apiKey = this.configService.get('AT_API_KEY');
      const senderId = this.configService.get('AT_SENDER_ID');

      // Dynamic import
      const AfricasTalking = require('africastalking');
      const at = AfricasTalking({ username, apiKey });
      const sms = at.SMS;

      await sms.send({
        to: [payload.to],
        message: payload.message,
        from: senderId,
      });

      this.logger.log(`SMS sent via Africa's Talking to ${payload.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS via Africa's Talking to ${payload.to}`, error);
      throw error;
    }
  }

  async sendContributionReminder(
    to: string,
    groupName: string,
    amount: number,
    dueDate: Date,
  ): Promise<boolean> {
    const message = `Stockvel: Your R${amount.toFixed(2)} contribution to ${groupName} is due on ${dueDate.toLocaleDateString()}. Please make your payment.`;
    return this.sendSms({ to, message });
  }

  async sendContributionConfirmation(
    to: string,
    groupName: string,
    amount: number,
  ): Promise<boolean> {
    const message = `Stockvel: Your R${amount.toFixed(2)} contribution to ${groupName} has been confirmed. Thank you!`;
    return this.sendSms({ to, message });
  }

  async sendPayoutNotification(
    to: string,
    groupName: string,
    amount: number,
  ): Promise<boolean> {
    const message = `Stockvel: A payout of R${amount.toFixed(2)} from ${groupName} has been scheduled to your account.`;
    return this.sendSms({ to, message });
  }
}
