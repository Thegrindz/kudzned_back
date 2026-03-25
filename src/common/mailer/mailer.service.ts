import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";

export interface OrderItem {
  name: string;
  description: string;
  price: string;
}

export interface OrderConfirmationData {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  orderDate: string;
  paymentMethod: string;
  transactionId: string;
  orderItems: OrderItem[];
  subtotal: string;
  processingFee: string;
  totalAmount: string;
}

export interface WalletFundingData {
  recipientName: string;
  amount: string;
  cryptoCurrency: string;
  cryptoAmount: string;
  exchangeRate: string;
  cryptoAddress: string;
  transactionReference: string;
  processedDate: string;
}

@Injectable()
export class MailService {
  constructor(private mailservice: MailerService) {}

  private resolveTemplatePath(templateName: string): string {
    const possiblePaths = [
      path.join(__dirname, "..", "mailer", "templates", templateName),
      path.join(process.cwd(), "src", "common", "mailer", "templates", templateName),
      path.join(process.cwd(), "dist", "common", "mailer", "templates", templateName),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }

    throw new Error(`Template file ${templateName} not found`);
  }

  async sendWelcomeMail(email: string, name: string): Promise<void> {
    const subject = "Welcome to SONNET.SHOP - Your Digital Marketplace Journey Begins!";

    try {
      // Load the HTML template
      const templatePath = this.resolveTemplatePath("welcome-mail.html");
      let content = fs.readFileSync(templatePath, "utf-8");

      // Replace template variables
      content = content.replace(/\$\{name\}/g, name);

      await this.mailservice.sendMail({
        to: email,
        subject: subject,
        html: content,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      throw error;
    }
  }

  async sendWalletFundedMail(
    email: string,
    data: WalletFundingData
  ): Promise<void> {
    const subject = "Wallet Funded Successfully - SONNET.SHOP";

    try {
      // Load the HTML template
      const templatePath = this.resolveTemplatePath("payout-completed-mail.html");
      let content = fs.readFileSync(templatePath, "utf-8");

      // Replace all template variables
      content = content.replace(/\$\{recipientName\}/g, data.recipientName);
      content = content.replace(/\$\{amount\}/g, data.amount);
      content = content.replace(/\$\{cryptoCurrency\}/g, data.cryptoCurrency);
      content = content.replace(/\$\{cryptoAmount\}/g, data.cryptoAmount);
      content = content.replace(/\$\{exchangeRate\}/g, data.exchangeRate);
      content = content.replace(/\$\{cryptoAddress\}/g, data.cryptoAddress);
      content = content.replace(/\$\{transactionReference\}/g, data.transactionReference);
      content = content.replace(/\$\{processedDate\}/g, data.processedDate);

      await this.mailservice.sendMail({
        to: email,
        subject: subject,
        html: content,
      });
    } catch (error) {
      console.error("Failed to send wallet funding email:", error);
      throw error;
    }
  }

  async sendOrderConfirmationMail(
    email: string,
    data: OrderConfirmationData
  ): Promise<void> {
    const subject = `Order Confirmed - SONNET.SHOP Order #${data.orderNumber}`;

    try {
      // Load the HTML template
      const templatePath = this.resolveTemplatePath("order-confirmation-mail.html");
      let content = fs.readFileSync(templatePath, "utf-8");

      // Replace basic template variables
      content = content.replace(/\$\{customerName\}/g, data.customerName);
      content = content.replace(/\$\{customerEmail\}/g, data.customerEmail);
      content = content.replace(/\$\{orderNumber\}/g, data.orderNumber);
      content = content.replace(/\$\{orderDate\}/g, data.orderDate);
      content = content.replace(/\$\{paymentMethod\}/g, data.paymentMethod);
      content = content.replace(/\$\{transactionId\}/g, data.transactionId);
      content = content.replace(/\$\{subtotal\}/g, data.subtotal);
      content = content.replace(/\$\{processingFee\}/g, data.processingFee);
      content = content.replace(/\$\{totalAmount\}/g, data.totalAmount);

      // Replace order items dynamically
      const itemsHtml = data.orderItems.map(item => `
      <div class="product-item">
        <div class="product-image">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        </div>
        <div class="product-details">
          <div class="product-name">${item.name}</div>
          <div class="product-description">${item.description}</div>
          <div class="product-price">$${item.price}</div>
        </div>
      </div>
      `).join('');

      content = content.replace(/\$\{orderItems\}/g, itemsHtml);

      await this.mailservice.sendMail({
        to: email,
        subject: subject,
        html: content,
      });
    } catch (error) {
      console.error("Failed to send order confirmation email:", error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async WelcomeMail(email: string, name: string): Promise<void> {
    return this.sendWelcomeMail(email, name);
  }

  // Legacy method for backward compatibility
  async sendPayoutCompletedMail(
    email: string,
    recipientName: string,
    amount: string,
    payoutId: string,
    paymentMethod: string,
    transactionReference: string,
    processedDate: string,
  ): Promise<void> {
    const data: WalletFundingData = {
      recipientName,
      amount,
      cryptoCurrency: 'USD',
      cryptoAmount: amount,
      exchangeRate: '1.00',
      cryptoAddress: 'N/A',
      transactionReference,
      processedDate,
    };
    return this.sendWalletFundedMail(email, data);
  }
}
