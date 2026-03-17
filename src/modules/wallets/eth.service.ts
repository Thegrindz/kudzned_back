import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";

import { ETHAddress } from "../../database/entities/eth-address.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { TatumService } from "./tatum.service";

@Injectable()
export class ETHService {
  private readonly logger = new Logger(ETHService.name);

  constructor(
    @InjectRepository(ETHAddress)
    private ethAddressRepository: Repository<ETHAddress>,
    private configService: ConfigService,
    private tatumService: TatumService,
    private responseService: ResponseService,
  ) {}

  async generateAddress(walletId: string): Promise<StandardResponse<any>> {
    try {
      const xpub = this.configService.get<string>("ETH_XPUB");

      if (!xpub) {
        return this.responseService.badRequest("ETH_XPUB not configured");
      }

      // FIX #4 — Use the global address count (across ALL wallets) as the HD
      // derivation index. Using a per-wallet count meant two simultaneous requests
      // for different wallets could both derive index 0 from the same xpub and
      // produce the same address.
      const index = await this.ethAddressRepository.count();

      const addressData = await this.tatumService.generateETHAddress(
        xpub,
        index,
      );

      const ethAddress = this.ethAddressRepository.create({
        wallet_id: walletId,
        address: addressData.address,
        is_used: false,
        is_active: true,
      });

      // FIX #9 — Persist the address first, then attempt subscription.
      // If subscription fails the address is still saved and flagged for retry.
      const savedAddress = await this.ethAddressRepository.save(ethAddress);

      try {
        await this.tatumService.createSubscription(addressData.address, "ETH");
      } catch (subError) {
        // Don't fail the whole request — the address is valid, just not yet monitored.
        // A background job should retry any address where is_monitored = false.
        this.logger.error(
          `Subscription failed for ETH address ${addressData.address}: ${subError.message}`,
        );
        savedAddress.is_monitored = false;
        await this.ethAddressRepository.save(savedAddress);
      }

      return this.responseService.success(
        "ETH address generated successfully",
        savedAddress,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to generate ETH address",
        { error: error.message },
      );
    }
  }
}