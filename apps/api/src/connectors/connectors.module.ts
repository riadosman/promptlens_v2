import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DeviceAuthorizationController } from './device-authorization.controller.js';
import { DeviceAuthorizationService } from './device-authorization.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DeviceAuthorizationController],
  providers: [DeviceAuthorizationService],
  exports: [DeviceAuthorizationService],
})
export class ConnectorsModule {}
