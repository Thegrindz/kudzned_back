import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Wallet } from "../../database/entities/wallet.entity";
import { Transaction } from "../../database/entities/transaction.entity";
import { BTCAddress } from "../../database/entities/btc-address.entity";
import { ETHAddress } from "../../database/entities/eth-address.entity";
import {
  TransactionType,
  TransactionStatus,
} from "../../common/enums/transaction.enum";
import {
  ResponseService,
  StandardResponse,
} from "../../common/services/response.service";
import { BTCService } from "./btc.service";
import { ETHService } from "./eth.service";
import { TatumService } from "./tatum.service";

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(BTCAddress)
    private btcAddressRepository: Repository<BTCAddress>,
    @InjectRepository(ETHAddress)
    private ethAddressRepository: Repository<ETHAddress>,
    private btcService: BTCService,
    private ethService: ETHService,
    private tatumService: TatumService,
    private responseService: ResponseService,
  ) {}

  async getWalletByUserId(userId: string): Promise<StandardResponse<any>> {
    try {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: userId },
        relations: ["btc_addresses"],
      });

      if (!wallet) {
        return this.responseService.notFound("Wallet not found");
      }

      return this.responseService.success(
        "Wallet retrieved successfully",
        wallet,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve wallet",
        { error: error.message },
      );
    }
  }

  async getBalance(userId: string): Promise<StandardResponse<any>> {
    try {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: userId },
      });

      if (!wallet) {
        return this.responseService.notFound("Wallet not found");
      }

      const balanceData = {
        balance: wallet.balance,
        available_balance: wallet.available_balance,
        total_deposited: wallet.total_deposited,
        total_withdrawn: wallet.total_withdrawn,
      };

      return this.responseService.success(
        "Balance retrieved successfully",
        balanceData,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve balance",
        { error: error.message },
      );
    }
  }

  async createTopup(
    userId: string,
    currency: "BTC" | "ETH" = "BTC",
    amount?: number,
  ): Promise<StandardResponse<any>> {
    try {
      const walletResponse = await this.getWalletByUserId(userId);
      if (!walletResponse.success) {
        return walletResponse;
      }

      const wallet = walletResponse.data;
      let addressResult;

      if (currency === "BTC") {
        addressResult = await this.btcService.generateAddress(wallet.id);
      } else {
        addressResult = await this.ethService.generateAddress(wallet.id);
      }

      if (!addressResult.success) {
        return addressResult;
      }

      const topupData = {
        address: addressResult.data.address,
        currency,
        amount_requested: amount || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      return this.responseService.success(
        "Deposit address created successfully",
        topupData,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to create topup address",
        { error: error.message },
      );
    }
  }

  async checkBalance(userId: string, amount: number): Promise<boolean> {
    try {
      const wallet = await this.walletRepository.findOne({
        where: { user_id: userId },
      });
      return wallet ? wallet.available_balance >= amount : false;
    } catch (error) {
      return false;
    }
  }

  async deductBalance(
    userId: string,
    amount: number,
    orderId: string,
  ): Promise<StandardResponse<any>> {
    try {
      return await this.walletRepository.manager.transaction(
        async (manager) => {
          const wallet = await manager.findOne(Wallet, {
            where: { user_id: userId },
            lock: { mode: "pessimistic_write" },
          });

          if (!wallet) {
            return this.responseService.notFound("Wallet not found");
          }

          if (wallet.available_balance < amount) {
            return this.responseService.badRequest("Insufficient balance", {
              required: amount,
              available: wallet.available_balance,
              deficit: amount - wallet.available_balance,
            });
          }

          wallet.balance -= amount;
          wallet.available_balance -= amount;
          await manager.save(wallet);

          const transaction = manager.create(Transaction, {
            wallet_id: wallet.id,
            type: TransactionType.PURCHASE,
            amount: -amount,
            status: TransactionStatus.CONFIRMED,
            order_id: orderId,
            description: `Purchase order ${orderId}`,
          });

          const savedTransaction = await manager.save(transaction);

          return this.responseService.success(
            "Balance deducted successfully",
            savedTransaction,
          );
        },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to deduct balance",
        { error: error.message },
      );
    }
  }

  async refund(
    userId: string,
    amount: number,
    orderId: string,
  ): Promise<StandardResponse<any>> {
    try {
      return await this.walletRepository.manager.transaction(
        async (manager) => {
          const wallet = await manager.findOne(Wallet, {
            where: { user_id: userId },
            lock: { mode: "pessimistic_write" },
          });

          if (!wallet) {
            return this.responseService.notFound("Wallet not found");
          }

          wallet.balance += amount;
          wallet.available_balance += amount;
          await manager.save(wallet);

          const transaction = manager.create(Transaction, {
            wallet_id: wallet.id,
            type: TransactionType.REFUND,
            amount: amount,
            status: TransactionStatus.CONFIRMED,
            order_id: orderId,
            description: `Refund for order ${orderId}`,
          });

          const savedTransaction = await manager.save(transaction);

          return this.responseService.success(
            "Refund processed successfully",
            savedTransaction,
          );
        },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to process refund",
        { error: error.message },
      );
    }
  }

  async processCryptoDeposit(
    address: string,
    amount: number,
    txHash: string,
    currency: "BTC" | "ETH",
  ): Promise<StandardResponse<any>> {
    try {
      let cryptoAddressRecord;
      if (currency === "BTC") {
        cryptoAddressRecord = await this.btcAddressRepository.findOne({
          where: { address },
          relations: ["wallet"],
        });
      } else {
        cryptoAddressRecord = await this.ethAddressRepository.findOne({
          where: { address },
          relations: ["wallet"],
        });
      }

      if (!cryptoAddressRecord) {
        return this.responseService.notFound(`${currency} address not found`);
      }

      // Check for duplicate transaction
      const existingTx = await this.transactionRepository.findOne({
        where: [{ btc_tx_hash: txHash }, { eth_tx_hash: txHash }],
      });

      if (existingTx) {
        return this.responseService.badRequest(
          "Transaction already processed",
          { txHash },
        );
      }

      // FIX #2 & #3 — Tatum sends amounts in native coin units (e.g. 0.001 BTC,
      // 0.05 ETH). All wallet balances are stored in satoshis, so we convert here.
      // BTC:  multiply by 10^8  →  satoshis
      // ETH:  convert ETH→BTC via live rate, then multiply by 10^8  →  satoshis
      let satoshiAmount: number;

      if (currency === "BTC") {
        satoshiAmount = Math.round(amount * 100_000_000);
      } else {
        // ETH path — rate is "how many BTC equals 1 ETH"
        const rate = await this.tatumService.getExchangeRate("ETH", "BTC");

        // FIX #2 — throw instead of silently falling through with a corrupt value
        if (!rate) {
          throw new Error(
            "Could not fetch ETH/BTC exchange rate — aborting deposit to prevent balance corruption",
          );
        }

        satoshiAmount = Math.round(amount * parseFloat(rate) * 100_000_000);
      }

      const result = await this.walletRepository.manager.transaction(
        async (manager) => {
          const wallet = await manager.findOne(Wallet, {
            where: { id: cryptoAddressRecord.wallet_id },
            lock: { mode: "pessimistic_write" },
          });

          if (!wallet) {
            throw new Error("Wallet not found");
          }

          wallet.balance += satoshiAmount;
          wallet.available_balance += satoshiAmount;
          wallet.total_deposited += satoshiAmount;
          await manager.save(wallet);

          const transaction = manager.create(Transaction, {
            wallet_id: wallet.id,
            type: TransactionType.DEPOSIT,
            amount: satoshiAmount,
            status: TransactionStatus.CONFIRMED,
            btc_tx_hash: currency === "BTC" ? txHash : null,
            eth_tx_hash: currency === "ETH" ? txHash : null,
            crypto_address: address,
            crypto_currency: currency,
            description: `${currency} deposit ${txHash}`,
          });

          const savedTransaction = await manager.save(transaction);

          // Mark address as used so it won't be re-issued
          cryptoAddressRecord.is_used = true;
          await manager.save(cryptoAddressRecord);

          return savedTransaction;
        },
      );

      return this.responseService.success(
        `${currency} deposit processed successfully`,
        result,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        `Failed to process ${currency} deposit`,
        { error: error.message },
      );
    }
  }

  // Deprecated: kept for backward compatibility — delegates to processCryptoDeposit
  async processBTCDeposit(
    address: string,
    amount: number,
    txHash: string,
  ): Promise<StandardResponse<any>> {
    return this.processCryptoDeposit(address, amount, txHash, "BTC");
  }

  async getTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<StandardResponse<any>> {
    try {
      const walletResponse = await this.getWalletByUserId(userId);
      if (!walletResponse.success) {
        return walletResponse;
      }

      const wallet = walletResponse.data;

      const [transactions, total] =
        await this.transactionRepository.findAndCount({
          where: { wallet_id: wallet.id },
          order: { created_at: "DESC" },
          skip: (page - 1) * limit,
          take: limit,
        });

      return this.responseService.paginated(
        transactions,
        page,
        limit,
        total,
        "Transactions retrieved successfully",
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve transactions",
        { error: error.message },
      );
    }
  }

  async getTransaction(
    userId: string,
    transactionId: string,
  ): Promise<StandardResponse<any>> {
    try {
      const walletResponse = await this.getWalletByUserId(userId);
      if (!walletResponse.success) {
        return walletResponse;
      }

      const wallet = walletResponse.data;

      const transaction = await this.transactionRepository.findOne({
        where: { id: transactionId, wallet_id: wallet.id },
      });

      if (!transaction) {
        return this.responseService.notFound("Transaction not found");
      }

      return this.responseService.success(
        "Transaction retrieved successfully",
        transaction,
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve transaction",
        { error: error.message },
      );
    }
  }
}
