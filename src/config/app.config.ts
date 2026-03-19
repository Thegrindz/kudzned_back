export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3001",

  jwt: {
    secret: process.env.JWT_SECRET || "your_super_secret_jwt_key_here",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  btc: {
    network: process.env.BTC_NETWORK || "testnet",
    apiKey: process.env.BTC_API_KEY,
    webhookSecret: process.env.BTC_WEBHOOK_SECRET,
  },

  email: {
    apiKey: process.env.EMAIL_API_KEY,
    fromEmail: process.env.FROM_EMAIL || "noreply@kudzned.com",
  },

  kyc: {
    apiKey: process.env.KYC_API_KEY,
    apiSecret: process.env.KYC_API_SECRET,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  storage: {
    bucket: process.env.STORAGE_BUCKET || "kudzned-files",
    region: process.env.STORAGE_REGION || "us-east-1",
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
  },
});
