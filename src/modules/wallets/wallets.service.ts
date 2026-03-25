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
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../../database/entities/notification.entity";
import { MailService, WalletFundingData } from "../../common/mailer/mailer.service";

// ─── Balance storage convention ──────────────────────────────────────────────
// All wallet balances are stored in USD CENTS (integer).
//
//   $1.00  = 100 cents
//   $87.50 = 8750 cents
//
// Why cents and not dollars?
//   Floating point math is unreliable for money.
//   Storing 8750 (integer) is always exact.
//   Storing 87.50 (float) can silently become 87.49999999...
//
// On deposit:
//   1. Tatum sends the crypto amount in native units (e.g. 0.001 BTC)
//   2. We fetch the live USD rate from Tatum at that exact moment
//   3. We calculate: amount × rate × 100  →  cents (integer)
//   4. We store that fixed cent value — it never changes with crypto price
//
// On display (frontend):
//   cents / 100  →  dollars   e.g. 8750 / 100 = $87.50
// ─────────────────────────────────────────────────────────────────────────────

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
    private notificationsService: NotificationsService,
    private responseService: ResponseService,
    private mailService: MailService,
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

      // Return both cents (raw) and dollars (display) so the frontend
      // can use whichever it needs without doing its own conversion
      const balanceData = {
        // Raw cent values (what the DB stores)
        balance_cents: wallet.balance,
        available_balance_cents: wallet.available_balance,
        total_deposited_cents: wallet.total_deposited,
        total_withdrawn_cents: wallet.total_withdrawn,

        // Dollar display values (divide by 100)
        balance_usd: (wallet.balance / 100).toFixed(2),
        available_balance_usd: (wallet.available_balance / 100).toFixed(2),
        total_deposited_usd: (wallet.total_deposited / 100).toFixed(2),
        total_withdrawn_usd: (wallet.total_withdrawn / 100).toFixed(2),
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
        amount_requested_usd: amount || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      // Send notification for deposit address creation
      await this.notificationsService.createNotification({
        user_id: userId,
        type: NotificationType.SYSTEM,
        title: "Deposit Address Generated",
        message: `A new ${currency} deposit address has been generated for you. Send ${currency} to this address to fund your wallet.`,
        data: { 
          address: addressResult.data.address,
          currency,
          expires_at: topupData.expires_at
        },
        skipEmail: true, // Skip email for this operational notification
      });

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
      // amount is expected in cents
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
      const result = await this.walletRepository.manager.transaction(
        async (manager) => {
          const wallet = await manager.findOne(Wallet, {
            where: { user_id: userId },
            lock: { mode: "pessimistic_write" },
          });

          if (!wallet) {
            return this.responseService.notFound("Wallet not found");
          }

          // amount is in cents
          if (wallet.available_balance < amount) {
            return this.responseService.badRequest("Insufficient balance", {
              required_usd: (amount / 100).toFixed(2),
              available_usd: (wallet.available_balance / 100).toFixed(2),
              deficit_usd: ((amount - wallet.available_balance) / 100).toFixed(2),
            });
          }

          wallet.balance -= amount;
          wallet.available_balance -= amount;
          await manager.save(wallet);

          const transaction = manager.create(Transaction, {
            wallet_id: wallet.id,
            type: TransactionType.PURCHASE,
            amount: -amount, // negative = money leaving wallet
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

      // Send notification for successful purchase if transaction was successful
      if (result.success) {
        await this.notificationsService.createNotification({
          user_id: userId,
          type: NotificationType.PAYMENT_RECEIVED,
          title: "Payment Processed",
          message: `Your payment of $${(amount / 100).toFixed(2)} USD for order ${orderId} has been processed successfully.`,
          data: { 
            amount_usd: (amount / 100).toFixed(2),
            amount_cents: amount,
            orderId 
          },
        });
      }

      return result;
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
      const result = await this.walletRepository.manager.transaction(
        async (manager) => {
          const wallet = await manager.findOne(Wallet, {
            where: { user_id: userId },
            lock: { mode: "pessimistic_write" },
          });

          if (!wallet) {
            return this.responseService.notFound("Wallet not found");
          }

          // amount is in cents
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

      // Send notification for successful refund if transaction was successful
      if (result.success) {
        await this.notificationsService.createNotification({
          user_id: userId,
          type: NotificationType.PAYMENT_RECEIVED,
          title: "Refund Processed",
          message: `Your refund of $${(amount / 100).toFixed(2)} USD for order ${orderId} has been processed and added to your wallet.`,
          data: { 
            amount_usd: (amount / 100).toFixed(2),
            amount_cents: amount,
            orderId,
            type: 'refund'
          },
        });
      }

      return result;
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

      // Check for duplicate transaction — idempotency guard
      const existingTx = await this.transactionRepository.findOne({
        where: [{ btc_tx_hash: txHash }, { eth_tx_hash: txHash }],
      });

      if (existingTx) {
        return this.responseService.badRequest(
          "Transaction already processed",
          { txHash },
        );
      }

      // ── OPTION B: Convert crypto → USD cents ──────────────────────────────
      // We fetch the live USD rate at the moment of deposit and lock it in.
      // The user's balance will always show a stable USD value regardless of
      // what BTC/ETH price does after this point.
      //
      // Example:
      //   User sends 0.001 BTC, rate = $87,000/BTC
      //   usdCents = round(0.001 × 87,000 × 100) = 8,700 cents = $87.00
      //   We store 8,700 — that never changes even if BTC drops to $50,000
      // ─────────────────────────────────────────────────────────────────────
      let usdCents: number;

      if (currency === "BTC") {
        const btcUsdRate = await this.tatumService.getExchangeRate("BTC", "USD");
        if (!btcUsdRate) {
          throw new Error(
            "Could not fetch BTC/USD exchange rate — aborting deposit to prevent balance corruption",
          );
        }
        usdCents = Math.round(amount * parseFloat(btcUsdRate) * 100);
        this.logger.log(
          `BTC deposit: ${amount} BTC × $${btcUsdRate} = $${(usdCents / 100).toFixed(2)} USD`,
        );
      } else {
        const ethUsdRate = await this.tatumService.getExchangeRate("ETH", "USD");
        if (!ethUsdRate) {
          throw new Error(
            "Could not fetch ETH/USD exchange rate — aborting deposit to prevent balance corruption",
          );
        }
        usdCents = Math.round(amount * parseFloat(ethUsdRate) * 100);
        this.logger.log(
          `ETH deposit: ${amount} ETH × $${ethUsdRate} = $${(usdCents / 100).toFixed(2)} USD`,
        );
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

          // All amounts stored in USD cents
          wallet.balance += usdCents;
          wallet.available_balance += usdCents;
          wallet.total_deposited += usdCents;
          await manager.save(wallet);

          const transaction = manager.create(Transaction, {
            wallet_id: wallet.id,
            type: TransactionType.DEPOSIT,
            amount: usdCents,
            status: TransactionStatus.CONFIRMED,
            btc_tx_hash: currency === "BTC" ? txHash : null,
            eth_tx_hash: currency === "ETH" ? txHash : null,
            crypto_address: address,
            crypto_currency: currency,
            // Store the original crypto amount for reference/auditing
            description: `${currency} deposit — ${amount} ${currency} = $${(usdCents / 100).toFixed(2)} USD (tx: ${txHash})`,
          });

          const savedTransaction = await manager.save(transaction);

          // Mark address as used so it won't be re-issued to another user
          cryptoAddressRecord.is_used = true;
          await manager.save(cryptoAddressRecord);

          return savedTransaction;
        },
      );

      // Send notification for successful deposit
      const wallet = await this.walletRepository.findOne({
        where: { id: cryptoAddressRecord.wallet_id },
      });
      
      if (wallet) {
        await this.notificationsService.createNotification({
          user_id: wallet.user_id,
          type: NotificationType.DEPOSIT_CONFIRMED,
          title: `${currency} Deposit Confirmed`,
          message: `Your ${currency} deposit of ${amount} ${currency} ($${(usdCents / 100).toFixed(2)} USD) has been confirmed and added to your wallet.`,
          data: { 
            amount, 
            currency, 
            amount_usd: (usdCents / 100).toFixed(2),
            txHash,
            address 
          },
        });

        // Send wallet funding email
        try {
          const exchangeRate = currency === "BTC" 
            ? await this.tatumService.getExchangeRate("BTC", "USD")
            : await this.tatumService.getExchangeRate("ETH", "USD");

          // Get user details for email
          const userWallet = await this.walletRepository.findOne({
            where: { id: wallet.id },
            relations: ["user"],
          });

          if (userWallet?.user) {
            const emailData: WalletFundingData = {
              recipientName: userWallet.user.first_name ? `${userWallet.user.first_name} ${userWallet.user.last_name || ''}`.trim() : "Valued Customer",
              amount: (usdCents / 100).toFixed(2),
              cryptoCurrency: currency,
              cryptoAmount: amount.toString(),
              exchangeRate: exchangeRate || "N/A",
              cryptoAddress: address,
              transactionReference: txHash,
              processedDate: new Date().toLocaleDateString(),
            };

            await this.mailService.sendWalletFundedMail(userWallet.user.email, emailData);
          }
        } catch (emailError) {
          console.error("Failed to send wallet funding email:", emailError);
          // Don't fail the deposit if email fails
        }
      }

      return this.responseService.success(
        `${currency} deposit processed successfully`,
        {
          ...result,
          // Include human-readable amounts in the response
          amount_crypto: amount,
          currency,
          amount_usd: (usdCents / 100).toFixed(2),
          amount_cents: usdCents,
        },
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
    limit = 50,
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

      // Attach a human-readable USD display value to each transaction
      const transactionsWithUsd = transactions.map((tx) => ({
        ...tx,
        amount_usd: (Math.abs(tx.amount) / 100).toFixed(2),
        // Negative amount = money left the wallet (purchase/withdrawal)
        direction: tx.amount >= 0 ? "credit" : "debit",
      }));

      return this.responseService.paginated(
        transactionsWithUsd,
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
        {
          ...transaction,
          amount_usd: (Math.abs(transaction.amount) / 100).toFixed(2),
          direction: transaction.amount >= 0 ? "credit" : "debit",
        },
      );
    } catch (error) {
      return this.responseService.internalServerError(
        "Failed to retrieve transaction",
        { error: error.message },
      );
    }
  }
}