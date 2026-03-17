import { TatumService } from './src/modules/wallets/tatum.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

async function generateWallets() {
  const configService = new ConfigService();
  const httpService = new HttpService();
  const tatumService = new TatumService(configService, httpService);

  try {
    const btcWallet = await tatumService.generateBTCWallet();
    console.log('BTC Wallet:', btcWallet);

    const ethWallet = await tatumService.generateETHWallet();
    console.log('ETH Wallet:', ethWallet);
  } catch (error) {
    console.error('Error generating wallets:', error);
  }
}

generateWallets();