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
      const webhookUrl = `${this.configService.get("BACKEND_URL")}/api/v1/wallets/webhooks/tatum`;
      
      this.logger.log(`Creating Tatum subscription for ${chain} address: ${address}`);
      this.logger.log(`Webhook URL: ${webhookUrl}`);
      this.logger.log(`Using API Key: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'NOT_SET'}`);
      
      const subscriptionPayload = {
        type: "ADDRESS_EVENT",
        attr: {
          address,
          chain,
          url: webhookUrl,
        },
      };
      
      this.logger.log(`Subscription payload: ${JSON.stringify(subscriptionPayload, null, 2)}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrlV4}/subscription`,
          subscriptionPayload,
          {
            headers: { 
              "x-api-key": this.apiKey,
              "Content-Type": "application/json"
            },
            timeout: 30000, // 30 second timeout
          },
        ),
      );

      this.logger.log(
        `✅ Subscription created successfully for ${chain} address ${address}: id=${response.data.id}`,
      );
      this.logger.log(`Full response: ${JSON.stringify(response.data, null, 2)}`);
      
      return response.data; // { id: "..." }
    } catch (error) {
      this.logger.error(`❌ Failed to create subscription for ${chain} address ${address}`);
      
      // Log detailed error information
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        this.logger.error(`Error Status: ${error.response.status}`);
        this.logger.error(`Error Status Text: ${error.response.statusText}`);
        this.logger.error(`Error Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
        this.logger.error(`Error Data: ${JSON.stringify(error.response.data, null, 2)}`);
        
        // Common Tatum error scenarios
        if (error.response.status === 401) {
          this.logger.error('🔑 Authentication failed - Check your TATUM_API_KEY');
        } else if (error.response.status === 402) {
          this.logger.error('💰 Payment required - Check your Tatum account credits');
        } else if (error.response.status === 429) {
          this.logger.error('⏱️ Rate limit exceeded - Too many requests');
        } else if (error.response.status === 400) {
          this.logger.error('📝 Bad request - Check subscription payload format');
        }
      } else if (error.request) {
        // The request was made but no response was received
        this.logger.error('🌐 Network error - No response received from Tatum');
        this.logger.error(`Request config: ${JSON.stringify(error.config, null, 2)}`);
      } else {
        // Something happened in setting up the request that triggered an Error
        this.logger.error(`⚙️ Setup error: ${error.message}`);
      }
      
      this.logger.error(`Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
      throw error;
    }
  }

  // ─── DEBUG: Check existing subscriptions and account status ──────────────────
  async checkSubscriptionsAndAccount() {
    try {
      this.logger.log('🔍 Checking Tatum account status and existing subscriptions...');
      
      // Check existing subscriptions with required pagination
      const subscriptionsResponse = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrlV4}/subscription?pageSize=50&offset=0`,
          {
            headers: { 
              "x-api-key": this.apiKey,
              "Content-Type": "application/json"
            },
          },
        ),
      );
      
      this.logger.log(`📋 Existing subscriptions count: ${subscriptionsResponse.data.length || 0}`);
      this.logger.log(`📋 Existing subscriptions: ${JSON.stringify(subscriptionsResponse.data, null, 2)}`);
      
      // Check account details/credits if endpoint is available
      try {
        const accountResponse = await firstValueFrom(
          this.httpService.get(
            `${this.baseUrlV3}/tatum/account`,
            {
              headers: { 
                "x-api-key": this.apiKey,
                "Content-Type": "application/json"
              },
            },
          ),
        );
        this.logger.log(`💳 Account details: ${JSON.stringify(accountResponse.data, null, 2)}`);
      } catch (accountError) {
        this.logger.warn(`Could not fetch account details: ${accountError.message}`);
      }
      
      return {
        subscriptions: subscriptionsResponse.data,
        count: subscriptionsResponse.data.length || 0
      };
    } catch (error) {
      this.logger.error(`❌ Failed to check subscriptions: ${error.message}`);
      if (error.response) {
        this.logger.error(`Error Status: ${error.response.status}`);
        this.logger.error(`Error Data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw error;
    }
  }

  async getExchangeRate(from: string, to: string = "USD") {
    try {
      const url = `${this.baseUrlV4}/data/rate/symbol?symbol=${from}&basePair=${to}`;
      this.logger.log(`📈 Fetching exchange rate: ${from}/${to} from ${url}`);
      
      const response = await firstValueFrom(
        this.httpService.get(
          url,
          {
            headers: { 
              "x-api-key": this.apiKey,
              "Content-Type": "application/json"
            },
            timeout: 10000, // 10 second timeout
          },
        ),
      );
      
      const rate = response.data.value;
      this.logger.log(`✅ ${from}/${to} exchange rate: ${rate}`);
      this.logger.log(`📊 Full response: ${JSON.stringify(response.data, null, 2)}`);
      
      return rate;
    } catch (error) {
      this.logger.error(`❌ Failed to get ${from}/${to} exchange rate: ${error.message}`);
      
      // Log detailed error information
      if (error.response) {
        this.logger.error(`Error Status: ${error.response.status}`);
        this.logger.error(`Error Data: ${JSON.stringify(error.response.data, null, 2)}`);
        
        if (error.response.status === 401) {
          this.logger.error('🔑 Exchange rate API authentication failed - Check your TATUM_API_KEY');
        } else if (error.response.status === 429) {
          this.logger.error('⏱️ Exchange rate API rate limit exceeded');
        } else if (error.response.status === 402) {
          this.logger.error('💰 Exchange rate API payment required - Check credits');
        }
      }
      
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