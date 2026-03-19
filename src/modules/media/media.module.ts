import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

import { DigitalFile } from "../../database/entities/digital-file.entity";
import { CloudinaryService } from "../../common/services/cloudinary.service";
import { ResponseService } from "../../common/services/response.service";

@Module({
  imports: [TypeOrmModule.forFeature([DigitalFile])],
  controllers: [MediaController],
  providers: [MediaService, CloudinaryService, ResponseService],
  exports: [MediaService, CloudinaryService],
})
export class MediaModule {}
