import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { ConnectorsModule } from './connectors/connectors.module.js';
import { PromptsModule } from './prompts/prompts.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HealthController } from './system/health.controller.js';
import { HealthService } from './system/health.service.js';
import { ReadinessService } from './system/readiness.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ProjectsModule,
    ConnectorsModule,
    PromptsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, ReadinessService],
})
export class AppModule {}
