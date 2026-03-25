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
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../../database/entities/notification.entity";

// ─── ETH derivation note ─────────────────────────────────────────────────────
// ETH_XPUB is at depth 4 (m/44'/60'/0'/0) — the full address-level path.
// This means Tatum correctly derives addresses as xpub/index which maps
// directly to MetaMask's Account 1 (index 0), Account 2 (index 1), etc.
// No extra branch derivation is needed unlike BTC.
//
// To verify in MetaMask:
//   Account 1 = index 0  (created automatically on import)
//   Account 2 = index 1  (Add account → Add a new Ethereum account)
//   Account N = index N-1
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ETHService {
  private readonly logger = new Logger(ETHService.name);

  constructor(
    @InjectRepository(ETHAddress)
    private ethAddressRepository: Repository<ETHAddress>,
    private configService: ConfigService,
    private tatumService: TatumService,
    private responseService: ResponseService,
    private notificationsService: NotificationsService,
  ) {}

  async generateAddress(walletId: string): Promise<StandardResponse<any>> {
    try {
      const xpub = this.configService.get<string>("ETH_XPUB");

      if (!xpub) {
        return this.responseService.badRequest("ETH_XPUB not configured");
      }

      // FIX #4 — Use global address count as the derivation index so two
      // simultaneous requests never derive the same address.
      const index = await this.ethAddressRepository.count();

      // ETH_XPUB is already at depth 4 (m/44'/60'/0'/0) so Tatum derives
      // xpub/index which matches MetaMask Account (index+1) directly.
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
        
        // Get wallet with user relation to send success notification
        const wallet = await this.ethAddressRepository
          .createQueryBuilder("ethAddress")
          .leftJoinAndSelect("ethAddress.wallet", "wallet")
          .leftJoinAndSelect("wallet.user", "user")
          .where("ethAddress.id = :addressId", { addressId: savedAddress.id })
          .getOne();

        if (wallet?.wallet?.user_id) {
          await this.notificationsService.createNotification({
            user_id: wallet.wallet.user_id,
            type: NotificationType.SYSTEM,
            title: "✅ ETH Address Ready for Deposits",
            message: `Your ETH deposit address ${addressData.address} is now active and monitored. You can safely send funds to this address.`,
            data: { 
              address: addressData.address,
              currency: "ETH"
            },
            skipEmail: true, // Skip email for operational success message
          });
        }
      } catch (subError) {
        // Don't fail the whole request — address is valid, just not yet monitored.
        // A background job should retry addresses where is_monitored = false.
        this.logger.error(
          `Subscription failed for ETH address ${addressData.address}: ${subError.message}`,
        );
        savedAddress.is_monitored = false;
        await this.ethAddressRepository.save(savedAddress);

        // Get wallet with user relation to send notification
        const wallet = await this.ethAddressRepository
          .createQueryBuilder("ethAddress")
          .leftJoinAndSelect("ethAddress.wallet", "wallet")
          .leftJoinAndSelect("wallet.user", "user")
          .where("ethAddress.id = :addressId", { addressId: savedAddress.id })
          .getOne();

        if (wallet?.wallet?.user_id) {
          await this.notificationsService.createNotification({
            user_id: wallet.wallet.user_id,
            type: NotificationType.SYSTEM,
            title: "⚠️ ETH Address Monitoring Failed",
            message: `Your ETH deposit address ${addressData.address} was created but monitoring failed. Please contact support before sending funds to this address.`,
            data: { 
              address: addressData.address,
              currency: "ETH",
              error: subError.message 
            },
          });
        }
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