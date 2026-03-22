import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { createHmac } from "node:crypto";

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

  // ─── STEP 1 (one-time setup) ────────────────────────────────────────────────
  // Call this ONCE to register your HMAC secret with Tatum.
  // After this, every webhook Tatum fires will include an x-payload-hash header
  // signed with this secret. You can call it from an admin endpoint or on app startup.
  //
  // PUT https://api.tatum.io/v4/subscription
  // { "hmacSecret": "<your-secret>" }
  // ────────────────────────────────────────────────────────────────────────────
  async enableWebhookHmac(): Promise<void> {
    const hmacSecret = this.configService.get<string>("TATUM_WEBHOOK_SECRET");
    if (!hmacSecret) {
      throw new Error("TATUM_WEBHOOK_SECRET is not configured");
    }

    try {
      await firstValueFrom(
        this.httpService.put(
          `${this.baseUrlV4}/subscription`,
          { hmacSecret },
          { headers: { "x-api-key": this.apiKey } },
        ),
      );
      this.logger.log("Tatum HMAC webhook secret registered successfully");
    } catch (error) {
      this.logger.error(
        `Failed to register Tatum HMAC secret: ${error.message}`,
      );
      throw error;
    }
  }

  // ─── STEP 2 ─────────────────────────────────────────────────────────────────
  // Subscribe to ADDRESS_EVENT (v4 name) for a given address.
  // Tatum will POST to your webhook URL whenever a transaction hits that address.
  // ────────────────────────────────────────────────────────────────────────────
  async createSubscription(address: string, chain: "BTC" | "ETH") {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          // Note: append ?type=mainnet or ?type=testnet based on your environment
          `${this.baseUrlV4}/subscription`,
          {
            type: "ADDRESS_EVENT", // correct v4 type (not ADDRESS_TRANSACTION)
            attr: {
              address,
              chain,
              url: `${this.configService.get("BACKEND_URL")}/wallets/webhooks/tatum`,
            },
          },
          {
            headers: { "x-api-key": this.apiKey },
          },
        ),
      );
      this.logger.log(
        `Subscription created for ${chain} address ${address}: id=${response.data.id}`,
      );
      return response.data; // { id: "..." }
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
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
      const ethWallet = await this.generateETHWallet();

      // Log xpubs only — never log mnemonics
      this.logger.log(`BTC Wallet generated — xpub: ${btcWallet.xpub}`);
      this.logger.log(`ETH Wallet generated — xpub: ${ethWallet.xpub}`);

      // ⚠️  CRITICAL — this is the ONLY time you will ever see these mnemonics.
      // Copy them immediately and store offline in a password manager.
      // They are NOT saved anywhere in the database or logs.
      // If you lose them you lose access to all funds deposited into these wallets.
      return {
        btc: {
          mnemonic: btcWallet.mnemonic, // ← save this somewhere safe RIGHT NOW
          xpub: btcWallet.xpub,         // ← copy this into BTC_XPUB in your .env
        },
        eth: {
          mnemonic: ethWallet.mnemonic, // ← save this somewhere safe RIGHT NOW
          xpub: ethWallet.xpub,         // ← copy this into ETH_XPUB in your .env
        },
      };
    } catch (error) {
      this.logger.error(`Failed to setup wallets: ${error.message}`);
      throw error;
    }
  }

  // ─── STEP 4 (per official Tatum docs) ───────────────────────────────────────
  // Verify an incoming webhook is genuinely from Tatum.
  //
  // How it works (from official docs):
  //   1. Tatum stringifies the JSON body (no spaces): JSON.stringify(body)
  //   2. Signs it with HMAC-SHA512 using your hmacSecret
  //   3. Encodes the result as Base64  ← IMPORTANT: Base64, NOT hex
  //   4. Sends it in the x-payload-hash request header
  //
  // We reproduce the same calculation and compare the values.
  // No rawBody needed — we sign the parsed JSON body re-stringified.
  // ────────────────────────────────────────────────────────────────────────────
  verifyWebhookSignature(body: Record<string, any>, signature: string): boolean {
    if (!signature) {
      this.logger.warn("Webhook received with no x-payload-hash header");
      return false;
    }

    const secret = this.configService.get<string>("TATUM_WEBHOOK_SECRET");
    if (!secret) {
      this.logger.error("TATUM_WEBHOOK_SECRET is not configured");
      return false;
    }

    // Tatum signs JSON.stringify(body) — no spaces, keys in arrival order
    const stringifiedBody = JSON.stringify(body);

    // Digest must be Base64, not hex (confirmed by official Tatum docs)
    const computedBase64 = createHmac("sha512", secret)
      .update(stringifiedBody)
      .digest("base64");

    const isValid = computedBase64 === signature;

    if (!isValid) {
      this.logger.warn(
        `Webhook signature mismatch. computed=${computedBase64} received=${signature}`,
      );
    }

    return isValid;
  }
}