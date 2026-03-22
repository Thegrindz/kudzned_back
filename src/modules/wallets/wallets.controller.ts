import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { WalletsService } from "./wallets.service";
import { TatumService } from "./tatum.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { StandardResponse } from "../../common/services/response.service";
import { TopupDto } from "./dto/topup.dto";
import { TransactionQueryDto } from "./dto/transaction-query.dto";
import { BTCWebhookDto } from "./dto/btc-webhook.dto";

@ApiTags("Wallets")
@Controller("wallets")
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly tatumService: TatumService,
  ) {}

  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: "Get wallet info",
    description:
      "Get user wallet information including BTC/ETH addresses and balance",
  })
  async getWallet(@Req() req: any): Promise<StandardResponse<any>> {
    return this.walletsService.getWalletByUserId(req.user.id);
  }

  // FIX #7 — Added missing @ApiBearerAuth so Swagger shows the auth lock icon
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("balance")
  @ApiOperation({
    summary: "Get wallet balance",
    description: "Get current wallet balance and transaction summary",
  })
  async getBalance(@Req() req: any): Promise<StandardResponse<any>> {
    return this.walletsService.getBalance(req.user.id);
  }

  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Post("topup")
  @ApiOperation({
    summary: "Create deposit address",
    description:
      "Generate a new BTC/ETH address for wallet deposit. Address expires in 24 hours.",
  })
  async createTopup(
    @Req() req: any,
    @Body() topupDto: TopupDto,
  ): Promise<StandardResponse<any>> {
    return this.walletsService.createTopup(
      req.user.id,
      topupDto.currency,
      topupDto.amount,
    );
  }

  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("transactions")
  @ApiOperation({
    summary: "Get transaction history",
    description: "Get paginated transaction history for the user's wallet",
  })
  @ApiQuery({ type: TransactionQueryDto })
  async getTransactions(
    @Req() req: any,
    @Query() query: TransactionQueryDto,
  ): Promise<StandardResponse<any>> {
    return this.walletsService.getTransactions(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("transactions/:id")
  @ApiOperation({
    summary: "Get transaction details",
    description: "Get detailed information about a specific transaction",
  })
  async getTransaction(
    @Req() req: any,
    @Param("id") id: string,
  ): Promise<StandardResponse<any>> {
    return this.walletsService.getTransaction(req.user.id, id);
  }

  // ─── Tatum Webhook (public — secured via HMAC signature) ────────────────────
  //
  // Tatum sends a POST with this JSON body shape (ADDRESS_EVENT subscription):
  // {
  //   address:          string   — the monitored address that was involved
  //   txId:             string   — the transaction hash
  //   blockNumber:      number   — block number (absent if mempool/pending)
  //   asset:            string   — "BTC", "ETH", or token contract address
  //   amount:           string   — coin amount as a string, in native units (e.g. "0.001")
  //   type:             string   — "incoming" | "outgoing" | "native" etc.
  //   chain:            string   — e.g. "bitcoin-mainnet", "ethereum-mainnet"
  //   subscriptionType: string   — "ADDRESS_EVENT"
  //   counterAddress:   string?  — the other side of the tx (may be absent on UTXO)
  //   mempool:          boolean? — true if tx is not yet in a block (EVM only)
  // }
  //
  // And an x-payload-hash header = Base64(HMAC-SHA512(JSON.stringify(body), secret))
  // ────────────────────────────────────────────────────────────────────────────
  @Post("webhooks/tatum")
  @ApiOperation({
    summary: "Tatum webhook",
    description: "Handle BTC/ETH payment confirmation webhook from Tatum",
  })
  @ApiResponse({ status: 200, description: "Webhook processed successfully" })
  @ApiResponse({ status: 400, description: "Transaction already processed" })
  @ApiResponse({ status: 401, description: "Invalid webhook signature" })
  async handleTatumWebhook(
    @Body() payload: any,
    @Headers("x-payload-hash") signature: string,
  ): Promise<StandardResponse<any>> {
    // FIX #1 — Verify the HMAC signature using the parsed body (not rawBody).
    // Per Tatum docs: they sign JSON.stringify(body) and encode as Base64.
    // No { rawBody: true } change to main.ts is needed.
    const isValid = this.tatumService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    // Only process confirmed (in-block) transactions.
    // Tatum sends a first webhook when the tx hits the mempool (EVM chains only)
    // with mempool: true — we skip that and wait for the confirmed one.
    if (payload.mempool === true) {
      return { success: true, message: "Mempool tx received, awaiting confirmation" } as any;
    }

    // Only credit incoming transactions
    if (payload.type === "outgoing") {
      return { success: true, message: "Outgoing tx ignored" } as any;
    }

    // Determine currency from the chain field Tatum sends.
    // e.g. "bitcoin-mainnet" → BTC, "ethereum-mainnet" → ETH
    const chainStr: string = (payload.chain ?? "").toLowerCase();
    let currency: "BTC" | "ETH";

    if (chainStr.includes("bitcoin")) {
      currency = "BTC";
    } else if (chainStr.includes("ethereum")) {
      currency = "ETH";
    } else {
      // Unsupported chain — log and acknowledge so Tatum doesn't keep retrying
      this.tatumService["logger"].warn(`Unsupported chain in webhook: ${payload.chain}`);
      return { success: true, message: `Chain ${payload.chain} not handled` } as any;
    }

    // FIX #3 — amount arrives as a string in native coin units ("0.001" BTC etc.)
    // Conversion to satoshis happens inside processCryptoDeposit.
    return this.walletsService.processCryptoDeposit(
      payload.address,
      parseFloat(payload.amount),
      payload.txId,
      currency,
    );
  }

  // ─── Admin: one-time wallet setup ───────────────────────────────────────────
  // Call this ONCE to generate your BTC and ETH HD wallets.
  // The response contains the mnemonics and xpubs.
  //
  // ⚠️  DELETE THIS ENDPOINT immediately after your first call.
  // It should never be reachable in production — it returns mnemonics.
  //
  // Steps:
  //   1. Call GET /api/v1/wallets/admin/setup-wallets
  //   2. Copy btc.mnemonic and eth.mnemonic → store in password manager
  //   3. Copy btc.xpub → paste into BTC_XPUB in your .env
  //   4. Copy eth.xpub → paste into ETH_XPUB in your .env
  //   5. Delete this endpoint and redeploy
  // ────────────────────────────────────────────────────────────────────────────
  @Get("admin/setup-wallets")
  @ApiOperation({
    summary: "⚠️ ONE-TIME SETUP ONLY — Generate BTC & ETH HD wallets",
    description:
      "Returns mnemonics and xpubs. DELETE THIS ENDPOINT after first use. Never expose in production.",
  })
  @ApiResponse({
    status: 200,
    description: "Wallets generated. Copy mnemonics immediately — they are not stored anywhere.",
  })
  async setupWallets() {
    return this.tatumService.setupWallets();
  }

  // Legacy webhook kept for backward compatibility
  @Post("webhooks/btc-payment")
  @ApiOperation({
    summary: "BTC payment webhook (Legacy)",
    description: "Handle BTC payment confirmation webhook (internal use only)",
  })
  @ApiBody({ type: BTCWebhookDto })
  @ApiResponse({ status: 200, description: "Webhook processed successfully" })
  async handleBTCPayment(
    @Body() webhookDto: BTCWebhookDto,
  ): Promise<StandardResponse<any>> {
    return this.walletsService.processBTCDeposit(
      webhookDto.address,
      webhookDto.amount,
      webhookDto.tx_hash,
    );
  }
}