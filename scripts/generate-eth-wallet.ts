import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const TATUM_API_KEY = process.env.TATUM_API_KEY;

async function generateETHWallet() {
  if (!TATUM_API_KEY) {
    console.error('❌ TATUM_API_KEY is not set in .env');
    process.exit(1);
  }

  console.log('⏳ Generating ETH Wallet via Tatum API...');

  try {
    const response = await axios.get('https://api.tatum.io/v3/ethereum/wallet', {
      headers: { 'x-api-key': TATUM_API_KEY }
    });

    const { xpub, mnemonic } = response.data;

    console.log('\n✅ ETH Wallet Generated Successfully!');
    console.log('-----------------------------------');
    console.log(`XPUB: ${xpub}`);
    console.log(`Mnemonic: ${mnemonic}`);
    console.log('-----------------------------------');
    console.log('⚠️  IMPORTANT: Save the mnemonic securely. It is the only way to recover your private keys.');
    console.log('I will now update your .env file with this XPUB.');

    return xpub;
  } catch (error) {
    console.error('❌ Failed to generate ETH wallet:', error.response?.data || error.message);
    process.exit(1);
  }
}

generateETHWallet();
