import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import * as crypto from "crypto";

@Injectable()
export class TatumService {
  private readonly logger = new Logger(TatumService.name);
  private readonly apiKey: string;
  private readonly baseUrlV3: string;
  private readonly baseUrlV4: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>("TATUM_API_KEY");
    this.baseUrlV3 = "https://api.tatum.io/v3";
    this.baseUrlV4 = "https://api.tatum.io/v4";
  }

  async generateBTCWallet() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrlV3}/bitcoin/wallet`, {
          headers: { "x-api-key": this.apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to generate BTC wallet: ${error.message}`);
      throw error;
    }
  }

  async generateBTCAddress(xpub: string, index: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrlV3}/bitcoin/address/${xpub}/${index}`,
          {
            headers: { "x-api-key": this.apiKey },
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to generate BTC address: ${error.message}`);
      throw error;
    }
  }

  async generateETHWallet() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrlV3}/ethereum/wallet`, {
          headers: { "x-api-key": this.apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to generate ETH wallet: ${error.message}`);
      throw error;
    }
  }

  async generateETHAddress(xpub: string, index: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrlV3}/ethereum/address/${xpub}/${index}`,
          {
            headers: { "x-api-key": this.apiKey },
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to generate ETH address: ${error.message}`);
      throw error;
    }
  }

  async createSubscription(address: string, chain: "BTC" | "ETH") {
    const backendUrl = this.configService.get<string>("BACKEND_URL");
    
    // Tatum webhooks cannot be sent to localhost. 
    // If you're testing locally, use a tool like ngrok to get a public URL.
    if (!backendUrl || backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1")) {
      this.logger.warn(`Skipping Tatum subscription for ${address} because BACKEND_URL is set to localhost. Webhooks require a publicly accessible URL.`);
      return { skipped: true, reason: "localhost_not_supported" };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrlV3}/subscription`,
          {
            type: "ADDRESS_TRANSACTION",
            attr: {
              address,
              chain,
              url: `${backendUrl}/api/v1/wallets/webhooks/tatum`,
            },
          },
          {
            headers: { "x-api-key": this.apiKey },
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      if (error.response) {
        this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async getExchangeRate(from: string, to: string = "BTC") {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrlV3}/tatum/exchange-rate/rate/${from}?basePair=${to}`,
          {
            headers: { "x-api-key": this.apiKey },
          },
        ),
      );
      return response.data.value;
    } catch (error) {
      this.logger.error(`Failed to get exchange rate: ${error.message}`);
      return null;
    }
  }

  async getWalletBalance(address: string, chain: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrlV4}/data/balance?address=${address}&chain=${chain}`,
          {
            headers: { "x-api-key": this.apiKey },
          },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get wallet balance: ${error.message}`);
      throw error;
    }
  }

  async setupWallets() {
    try {
      const btcWallet = await this.generateBTCWallet();
      this.logger.log(`BTC Wallet generated: xpub: ${btcWallet.xpub}`);

      const ethWallet = await this.generateETHWallet();
      this.logger.log(`ETH Wallet generated: xpub: ${ethWallet.xpub}`);

      return { btcXpub: btcWallet.xpub, ethXpub: ethWallet.xpub };
    } catch (error) {
      this.logger.error(`Failed to setup wallets: ${error.message}`);
      throw error;
    }
  }

  // FIX #1 — Verify Tatum webhook HMAC-SHA512 signature to prevent anyone from
  // sending fake deposit payloads. Tatum signs the raw request body with your
  // TATUM_WEBHOOK_SECRET and puts the hex digest in the x-payload-hash header.
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!signature) return false;

    const secret = this.configService.get<string>("TATUM_WEBHOOK_SECRET");
    if (!secret) {
      this.logger.error("TATUM_WEBHOOK_SECRET is not configured");
      return false;
    }

    const hmac = crypto.createHmac("sha512", secret);
    hmac.update(rawBody);
    const computed = hmac.digest("hex");

    // timingSafeEqual prevents timing-based attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(signature, "hex"),
      );
    } catch {
      // Buffers were different lengths — signature is invalid
      return false;
    }
  }
}