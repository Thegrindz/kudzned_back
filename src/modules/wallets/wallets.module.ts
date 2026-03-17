import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";

import { WalletsController } from "./wallets.controller";
import { WalletsService } from "./wallets.service";
import { BTCService } from "./btc.service";
import { ETHService } from "./eth.service";
import { TatumService } from "./tatum.service";
import { TransactionService } from "./transaction.service";

import { Wallet } from "../../database/entities/wallet.entity";
import { Transaction } from "../../database/entities/transaction.entity";
import { BTCAddress } from "../../database/entities/btc-address.entity";
import { ETHAddress } from "../../database/entities/eth-address.entity";
import { ResponseService } from "@/common/services/response.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, BTCAddress, ETHAddress]),
    HttpModule,
  ],
  controllers: [WalletsController],
  providers: [
    WalletsService,
    BTCService,
    ETHService,
    TatumService,
    TransactionService,
    ResponseService,
  ],
  exports: [WalletsService],
})
export class WalletsModule {}