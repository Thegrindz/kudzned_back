import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mailer.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          service: configService.get('SERVICE'),
          host: configService.get('HOST'),
          port: configService.get('PORT_MAIL'),
          secure: false, // true for 465, false for other ports
          auth: {
            user: configService.get('AUTH_EMAIL'),
            pass: configService.get('AUTH_PASS'),
          },
        },
        defaults: {
          from: '"SONNET.SHOP" <' + configService.get('AUTH_EMAIL') + '>',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
