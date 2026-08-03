import { Module } from '@nestjs/common';
import { ConnectorsModule } from '../connectors/connectors.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PromptHistoryController } from './prompt-history.controller.js';
import { PromptHistoryService } from './prompt-history.service.js';
import { PromptsController } from './prompts.controller.js';
import { PromptsService } from './prompts.service.js';

@Module({
  imports: [ConnectorsModule, AuthModule],
  controllers: [PromptsController, PromptHistoryController],
  providers: [PromptsService, PromptHistoryService],
})
export class PromptsModule {}
