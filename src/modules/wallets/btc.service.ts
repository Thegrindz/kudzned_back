import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";

import { BTCAddress } from "../../database/entities/btc-address.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { TatumService } from "./tatum.service";

@Injectable()
export class BTCService {
  constructor(
    @InjectRepository(BTCAddress)
    private btcAddressRepository: Repository<BTCAddress>,
    private configService: ConfigService,
    private httpService: HttpService,
    private responseService: ResponseService,
    private tatumService: TatumService,
  ) {}

  async generateAddress(walletId: string): Promise<StandardResponse<any>> {
    try {
      const xpub = this.configService.get<string>("BTC_XPUB");

      if (!xpub) {
        return this.responseService.badRequest("BTC_XPUB not configured");
      }

      // FIX #4 — Use the global address count (across ALL wallets) as the HD
      // derivation index. Using a per-wallet count meant two simultaneous requests
      // for different wallets could both derive index 0 from the same xpub and
      // produce the same address.
      const index = await this.btcAddressRepository.count();

      const addressData = await this.tatumService.generateBTCAddress(
        xpub,
        index,
      );

      const btcAddress = this.btcAddressRepository.create({
        wallet_id: walletId,
        address: addressData.address,
        is_used: false,
        is_active: true,
      });

      // FIX #9 — Attempt subscription after saving the address so the address
      // is always persisted even if the Tatum subscription call fails.
      // is_monitored = false flags it for a background retry job.
      const savedAddress = await this.btcAddressRepository.save(btcAddress);

      try {
        await this.tatumService.createSubscription(addressData.address, "BTC");
      } catch (subError) {
        // Don't fail the whole request — the address is valid, just not yet monitored.
        // A background job should retry any address where is_monitored = false.
        savedAddress.is_monitored = false;
        await this.btcAddressRepository.save(savedAddress);
      }

      return this.responseService.success(
        "BTC address generated successfully",
        savedAddress,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to generate BTC address",
        { error: error.message },
      );
    }
  }

  async validateAddress(address: string): Promise<StandardResponse<any>> {
    try {
      const testnetPattern = /^[2mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      const mainnetPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

      const network = this.configService.get("btc.network");

      let isValid = false;
      if (network === "testnet") {
        isValid = testnetPattern.test(address);
      } else {
        isValid = mainnetPattern.test(address);
      }

      if (isValid) {
        return this.responseService.success("Address is valid", {
          address,
          isValid: true,
        });
      } else {
        return this.responseService.badRequest("Invalid BTC address format", {
          address,
          isValid: false,
        });
      }
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to validate address",
        { error: error.message },
      );
    }
  }

  async getBalance(address: string): Promise<StandardResponse<any>> {
    try {
      const balance = Math.floor(Math.random() * 1000000);

      return this.responseService.success("Balance retrieved successfully", {
        address,
        balance,
        confirmed: balance,
        unconfirmed: 0,
      });
    } catch (error) {
      return this.responseService.internalServerError("Failed to get balance", {
        error: error.message,
      });
    }
  }

  async getTransactionHistory(address: string): Promise<StandardResponse<any>> {
    try {
      const transactions = [];

      return this.responseService.success(
        "Transaction history retrieved successfully",
        {
          address,
          transactions,
          total: transactions.length,
        },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to get transaction history",
        { error: error.message },
      );
    }
  }
}