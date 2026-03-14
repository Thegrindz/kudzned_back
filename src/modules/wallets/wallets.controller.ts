import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StandardResponse } from '../../common/services/response.service';
import { TopupDto } from './dto/topup.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { BTCWebhookDto } from './dto/btc-webhook.dto';

@ApiTags('Wallets')
@ApiBearerAuth('JWT-auth')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get wallet info',
    description: 'Get user wallet information including BTC addresses and balance'
  })

  async getWallet(@Req() req: any): Promise<StandardResponse<any>> {
    return this.walletsService.getWalletByUserId(req.user.id);
  }

  @Get('balance')
  @ApiOperation({ 
    summary: 'Get wallet balance',
    description: 'Get current wallet balance and transaction summary'
  })
  async getBalance(@Req() req: any): Promise<StandardResponse<any>> {
    return this.walletsService.getBalance(req.user.id);
  }

  @Post('topup')
  @ApiOperation({ 
    summary: 'Create deposit address',
    description: 'Generate a new BTC address for wallet deposit. Address expires in 24 hours.'
  })
  async createTopup(@Req() req: any, @Body() topupDto: TopupDto): Promise<StandardResponse<any>> {
    return this.walletsService.createTopup(req.user.id, topupDto.amount);
  }

  @Get('transactions')
  @ApiOperation({ 
    summary: 'Get transaction history',
    description: 'Get paginated transaction history for the user\'s wallet'
  })
  @ApiQuery({ type: TransactionQueryDto })
  async getTransactions(@Req() req: any, @Query() query: TransactionQueryDto): Promise<StandardResponse<any>> {
    return this.walletsService.getTransactions(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @Get('transactions/:id')
  @ApiOperation({ 
    summary: 'Get transaction details',
    description: 'Get detailed information about a specific transaction'
  })
  async getTransaction(@Req() req: any, @Param('id') id: string): Promise<StandardResponse<any>> {
    return this.walletsService.getTransaction(req.user.id, id);
  }

  @Post('webhooks/btc-payment')
  @ApiOperation({ 
    summary: 'BTC payment webhook',
    description: 'Handle BTC payment confirmation webhook from payment processor (internal use only)'
  })
  @ApiBody({ type: BTCWebhookDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'BTC deposit processed successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            btc_tx_hash: { type: 'string' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Transaction already processed' })
  @ApiResponse({ status: 404, description: 'BTC address not found' })
  async handleBTCPayment(@Body() webhookDto: BTCWebhookDto): Promise<StandardResponse<any>> {
    const result = await this.walletsService.processBTCDeposit(
      webhookDto.address,
      webhookDto.amount,
      webhookDto.tx_hash,
    );
    
    return result;
  }
}