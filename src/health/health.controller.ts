import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResponseService, StandardResponse } from '../common/services/response.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

class HealthResponseDto {
  status: string;
  timestamp: string;
  service: string;
  version: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly responseService: ResponseService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Health check',
    description: 'Check if the service is running'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    type: HealthResponseDto
  })
  check(): StandardResponse<HealthResponseDto> {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'KUDZNED Backend',
      version: '1.0.0',
    };

    return this.responseService.success('Service is healthy', healthData);
  }

  @Get('ready')
  @ApiOperation({ 
    summary: 'Readiness check',
    description: 'Check if the service is ready to accept requests'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is ready'
  })
  ready(): StandardResponse<{ status: string; timestamp: string }> {
    const readyData = {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };

    return this.responseService.success('Service is ready', readyData);
  }

  @Get('cloudinary')
  @ApiOperation({ 
    summary: 'Cloudinary configuration check',
    description: 'Check if Cloudinary is properly configured'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cloudinary configuration status'
  })
  checkCloudinary(): StandardResponse<any> {
    const config = this.cloudinaryService.testConfiguration();
    return this.responseService.success('Cloudinary configuration', config);
  }
}