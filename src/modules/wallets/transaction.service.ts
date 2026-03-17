import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Transaction } from "../../database/entities/transaction.entity";
import {
  TransactionType,
  TransactionStatus,
} from "../../common/enums/transaction.enum";

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async createTransaction(data: {
    wallet_id: string;
    type: TransactionType;
    amount: number;
    status?: TransactionStatus;
    btc_tx_hash?: string;
    // FIX #5 — eth_tx_hash was missing from the createTransaction input type
    eth_tx_hash?: string;
    order_id?: string;
    description?: string;
    metadata?: any;
  }): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      ...data,
      status: data.status || TransactionStatus.PENDING,
    });

    return this.transactionRepository.save(transaction);
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    metadata?: any,
  ): Promise<void> {
    const updateData: any = { status };
    if (metadata) {
      updateData.metadata = metadata;
    }

    await this.transactionRepository.update(transactionId, updateData);
  }

  async getTransactionsByWallet(
    walletId: string,
    page = 1,
    limit = 20,
    type?: TransactionType,
  ) {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder("transaction")
      .where("transaction.wallet_id = :walletId", { walletId })
      .orderBy("transaction.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (type) {
      queryBuilder.andWhere("transaction.type = :type", { type });
    }

    const [transactions, total] = await queryBuilder.getManyAndCount();

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionById(transactionId: string): Promise<Transaction> {
    return this.transactionRepository.findOne({
      where: { id: transactionId },
    });
  }

  async getTransactionByBTCHash(btcTxHash: string): Promise<Transaction> {
    return this.transactionRepository.findOne({
      where: { btc_tx_hash: btcTxHash },
    });
  }

  // FIX #5 — ETH equivalent of getTransactionByBTCHash was missing entirely
  async getTransactionByETHHash(ethTxHash: string): Promise<Transaction> {
    return this.transactionRepository.findOne({
      where: { eth_tx_hash: ethTxHash },
    });
  }
}