import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres",
      host: this.configService.get("DB_HOST") || "localhost",
      port: parseInt(this.configService.get("DB_PORT")) || 5432,
      username: this.configService.get("DB_USERNAME") || "postgres",
      password: this.configService.get("DB_PASSWORD"),
      database: this.configService.get("DB_NAME") || "kudzned",
      entities: [__dirname + "/../**/*.entity{.ts,.js}"],
      migrations: [__dirname + "/../database/migrations/*{.ts,.js}"],
      synchronize: this.configService.get("NODE_ENV") === "development",
      logging: this.configService.get("NODE_ENV") === "development",
      ssl:
        this.configService.get("NODE_ENV") === "production"
          ? { rejectUnauthorized: false }
          : false,
    };
  }
}
