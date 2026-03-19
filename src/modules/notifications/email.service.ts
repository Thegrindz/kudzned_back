import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class EmailService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async sendEmail(data: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const apiKey = this.configService.get("email.apiKey");
    const fromEmail = this.configService.get("email.fromEmail");

    if (!apiKey) {
      console.log("Email API key not configured, skipping email send");
      return;
    }

    try {
      // This is a mock implementation
      // In production, integrate with your email service provider (SendGrid, Mailgun, etc.)
      console.log("Sending email:", {
        from: fromEmail,
        to: data.to,
        subject: data.subject,
        html: data.html,
      });

      // Example with SendGrid:
      // await this.httpService.post('https://api.sendgrid.v3/mail/send', {
      //   personalizations: [{
      //     to: [{ email: data.to }],
      //     subject: data.subject,
      //   }],
      //   from: { email: fromEmail },
      //   content: [{
      //     type: 'text/html',
      //     value: data.html,
      //   }],
      // }, {
      //   headers: {
      //     'Authorization': `Bearer ${apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      // }).toPromise();
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }

  async sendOrderConfirmation(email: string, orderData: any): Promise<void> {
    const html = `
      <h2>Order Confirmation</h2>
      <p>Thank you for your order!</p>
      <p><strong>Order ID:</strong> ${orderData.id}</p>
      <p><strong>Total Amount:</strong> ${orderData.total_amount} satoshis</p>
      <p>You can download your digital products from your account dashboard.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: "Order Confirmation - KUDZNED",
      html,
    });
  }

  async sendDepositConfirmation(
    email: string,
    depositData: any,
  ): Promise<void> {
    const html = `
      <h2>Deposit Confirmed</h2>
      <p>Your Bitcoin deposit has been confirmed!</p>
      <p><strong>Amount:</strong> ${depositData.amount} satoshis</p>
      <p><strong>Transaction Hash:</strong> ${depositData.txHash}</p>
      <p>The funds are now available in your wallet.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: "Deposit Confirmed - KUDZNED",
      html,
    });
  }

  async sendKYCNotification(email: string, approved: boolean): Promise<void> {
    const html = approved
      ? `
        <h2>KYC Verification Approved</h2>
        <p>Congratulations! Your KYC verification has been approved.</p>
        <p>You now have full access to all platform features.</p>
      `
      : `
        <h2>KYC Verification Rejected</h2>
        <p>Unfortunately, your KYC verification has been rejected.</p>
        <p>Please review your documents and resubmit for verification.</p>
      `;

    await this.sendEmail({
      to: email,
      subject: `KYC ${approved ? "Approved" : "Rejected"} - KUDZNED`,
      html,
    });
  }
}
