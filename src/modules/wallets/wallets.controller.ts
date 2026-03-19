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

  // FIX #7 — Added missing @ApiBearerAuth so Swagger shows the lock icon
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

  // Webhooks are public (no JWT guard) — secured via HMAC signature instead
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
    // FIX #1 — Read the HMAC signature Tatum sends in this header
    @Headers("x-payload-hash") signature: string,
    @Req() req: any,
  ): Promise<StandardResponse<any>> {
    // FIX #1 — Reject any request that doesn't carry a valid HMAC signature.
    // req.rawBody requires { rawBody: true } in NestFactory.create() — see main.ts note below.
    const isValid = this.tatumService.verifyWebhookSignature(
      req.rawBody,
      signature,
    );

    if (!isValid) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    // FIX #3 — Tatum sends amounts in native coin units (e.g. 0.001 BTC, 0.05 ETH).
    // Conversion to satoshis happens inside processCryptoDeposit.
    const { address, txId, chain, amount } = payload;
    const currency = chain as "BTC" | "ETH";

    return this.walletsService.processCryptoDeposit(
      address,
      parseFloat(amount),
      txId,
      currency,
    );
  }

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

/*
 * NOTE — main.ts change required for req.rawBody to work:
 *
 *   const app = await NestFactory.create(AppModule, { rawBody: true });
 *
 * Without this, req.rawBody will be undefined and every webhook will be rejected.
 */
