import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { createHmac, createHash, createECDH } from "node:crypto";

import { BTCAddress } from "../../database/entities/btc-address.entity";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { TatumService } from "./tatum.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../../database/entities/notification.entity";

// ─── HD derivation helpers (no external deps) ───────────────────────────────
// These are needed because BTC_XPUB is the account xpub at depth m/84'/0'/0'.
// Tatum derives addresses as xpub/index (one level deep) but Sparrow BIP84
// expects xpub/0/index (two levels — receive branch 0, then address index).
// So we pre-derive the receive-branch child xpub (xpub/0) and pass THAT to
// Tatum, making both tools derive identical addresses.

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str: string): Buffer {
  let num = BigInt(0);
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base58 char: ${char}`);
    num = num * 58n + BigInt(idx);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return Buffer.from(hex, "hex");
}

function base58CheckDecode(str: string): Buffer {
  return base58Decode(str).slice(0, -4);
}

function base58Encode(buf: Buffer): string {
  let num = BigInt("0x" + buf.toString("hex"));
  let result = "";
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)] + result;
    num /= 58n;
  }
  for (const b of buf) {
    if (b === 0) result = "1" + result;
    else break;
  }
  return result;
}

function base58CheckEncode(buf: Buffer): string {
  const h1 = createHash("sha256").update(buf).digest();
  const h2 = createHash("sha256").update(h1).digest();
  return base58Encode(Buffer.concat([buf, h2.slice(0, 4)]));
}

const SECP256K1_P =
  0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

function decompressPoint(c: Buffer): { x: bigint; y: bigint } {
  const x = BigInt("0x" + c.slice(1).toString("hex"));
  const prefix = c[0];
  let y = modPow(x ** 3n + 7n, (SECP256K1_P + 1n) / 4n, SECP256K1_P);
  if (y % 2n !== BigInt(prefix - 2)) y = SECP256K1_P - y;
  return { x, y };
}

function pointAdd(
  A: { x: bigint; y: bigint },
  B: { x: bigint; y: bigint },
): { x: bigint; y: bigint } {
  const lam =
    ((B.y - A.y) * modPow(B.x - A.x, SECP256K1_P - 2n, SECP256K1_P)) %
    SECP256K1_P;
  const x = (lam * lam - A.x - B.x + SECP256K1_P * 3n) % SECP256K1_P;
  const y = (lam * (A.x - x) - A.y + SECP256K1_P * 2n) % SECP256K1_P;
  return { x, y };
}

function compressPoint(pt: { x: bigint; y: bigint }): Buffer {
  return Buffer.from(
    (pt.y % 2n === 0n ? "02" : "03") +
      pt.x.toString(16).padStart(64, "0"),
    "hex",
  );
}

function hash160(buf: Buffer): Buffer {
  const sha = createHash("sha256").update(buf).digest();
  return createHash("ripemd160").update(sha).digest();
}

/**
 * Derive a non-hardened child xpub at the given index.
 * Used to move from the account xpub (m/84'/0'/0') down to the
 * receive-branch xpub (m/84'/0'/0'/0) so Tatum and Sparrow agree.
 */
function deriveChildXpub(accountXpub: string, childIndex: number): string {
  const dec = base58CheckDecode(accountXpub);

  const version   = dec.slice(0, 4);
  const depth     = dec[4];
  const chainCode = dec.slice(13, 45);
  const pubKey    = dec.slice(45, 78);

  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32BE(childIndex);

  const I = createHmac("sha512", chainCode)
    .update(Buffer.concat([pubKey, indexBuf]))
    .digest();

  const IL = I.slice(0, 32);
  const IR = I.slice(32); // becomes new chain code

  // childPubKey = point(IL) + parentPubKey  (EC point addition)
  const ecdh = createECDH("secp256k1");
  ecdh.setPrivateKey(IL);
  const ILPub = Buffer.from(ecdh.getPublicKey(null, "compressed"));
  const childPub = compressPoint(
    pointAdd(decompressPoint(ILPub), decompressPoint(pubKey)),
  );

  // fingerprint = first 4 bytes of hash160(parentPubKey)
  const fingerprint  = hash160(pubKey).slice(0, 4);
  const childDepthBuf = Buffer.from([depth + 1]);
  const childIndexBuf = Buffer.alloc(4);
  childIndexBuf.writeUInt32BE(childIndex);

  return base58CheckEncode(
    Buffer.concat([
      version,
      childDepthBuf,
      fingerprint,
      childIndexBuf,
      IR,
      childPub,
    ]),
  );
}
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BTCService {
  private readonly logger = new Logger(BTCService.name);

  // Cached once at runtime — derived from BTC_XPUB on first use
  private receiveBranchXpub: string | null = null;

  constructor(
    @InjectRepository(BTCAddress)
    private btcAddressRepository: Repository<BTCAddress>,
    private configService: ConfigService,
    private httpService: HttpService,
    private responseService: ResponseService,
    private tatumService: TatumService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Returns the receive-branch xpub (accountXpub / 0).
   * Tatum is given this xpub so it derives addresses at
   * m/84'/0'/0'/0/index — exactly matching Sparrow's receive list.
   */
  private getReceiveBranchXpub(): string {
    if (this.receiveBranchXpub) return this.receiveBranchXpub;

    const accountXpub = this.configService.get<string>("BTC_XPUB");
    if (!accountXpub) throw new Error("BTC_XPUB is not configured");

    this.receiveBranchXpub = deriveChildXpub(accountXpub, 0);
    this.logger.log("BTC receive-branch xpub derived and cached");
    return this.receiveBranchXpub;
  }

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

      // DERIVATION FIX — Pass the receive-branch xpub (accountXpub/0) to Tatum
      // instead of the raw account xpub. This makes Tatum derive addresses at
      // m/84'/0'/0'/0/index which exactly matches Sparrow's BIP84 receive list.
      const receiveBranchXpub = this.getReceiveBranchXpub();

      const addressData = await this.tatumService.generateBTCAddress(
        receiveBranchXpub,
        index,
      );

      const btcAddress = this.btcAddressRepository.create({
        wallet_id: walletId,
        address: addressData.address,
        is_used: false,
        is_active: true,
      });

      // FIX #9 — Persist the address first, then subscribe.
      // If subscription fails, address is still saved and flagged for retry.
      const savedAddress = await this.btcAddressRepository.save(btcAddress);

      try {
        await this.tatumService.createSubscription(addressData.address, "BTC");
        
        // Get wallet with user relation to send success notification
        const wallet = await this.btcAddressRepository
          .createQueryBuilder("btcAddress")
          .leftJoinAndSelect("btcAddress.wallet", "wallet")
          .leftJoinAndSelect("wallet.user", "user")
          .where("btcAddress.id = :addressId", { addressId: savedAddress.id })
          .getOne();

        if (wallet?.wallet?.user_id) {
          await this.notificationsService.createNotification({
            user_id: wallet.wallet.user_id,
            type: NotificationType.SYSTEM,
            title: "✅ BTC Address Ready for Deposits",
            message: `Your BTC deposit address ${addressData.address} is now active and monitored. You can safely send funds to this address.`,
            data: { 
              address: addressData.address,
              currency: "BTC"
            },
            skipEmail: true, // Skip email for operational success message
          });
        }
      } catch (subError) {
        // Don't fail the whole request — address is valid, just not yet monitored.
        // A background job should retry addresses where is_monitored = false.
        this.logger.error(
          `Subscription failed for BTC address ${addressData.address}: ${subError.message}`,
        );
        savedAddress.is_monitored = false;
        await this.btcAddressRepository.save(savedAddress);

        // Get wallet with user relation to send notification
        const wallet = await this.btcAddressRepository
          .createQueryBuilder("btcAddress")
          .leftJoinAndSelect("btcAddress.wallet", "wallet")
          .leftJoinAndSelect("wallet.user", "user")
          .where("btcAddress.id = :addressId", { addressId: savedAddress.id })
          .getOne();

        if (wallet?.wallet?.user_id) {
          await this.notificationsService.createNotification({
            user_id: wallet.wallet.user_id,
            type: NotificationType.SYSTEM,
            title: "⚠️ BTC Address Monitoring Failed",
            message: `Your BTC deposit address ${addressData.address} was created but monitoring failed. Please contact support before sending funds to this address.`,
            data: { 
              address: addressData.address,
              currency: "BTC",
              error: subError.message 
            },
          });
        }
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
      // bc1q... native SegWit (BIP84) — the format our wallet uses
      const nativeSegwitPattern = /^bc1q[ac-hj-np-z02-9]{39,59}$/;
      // Also accept legacy formats in case they're ever needed
      const testnetPattern = /^[2mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      const mainnetLegacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

      const network = this.configService.get<string>("BTC_NETWORK") || "mainnet";

      let isValid = false;
      if (network === "testnet") {
        isValid = testnetPattern.test(address);
      } else {
        // Accept both native SegWit (bc1q) and legacy mainnet formats
        isValid =
          nativeSegwitPattern.test(address) ||
          mainnetLegacyPattern.test(address);
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