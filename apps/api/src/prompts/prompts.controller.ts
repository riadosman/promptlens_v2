import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ingestPromptRequestSchema, type IngestPromptRequest } from '@promptlens/contracts';
import { DeviceAuthorizationService } from '../connectors/device-authorization.service.js';
import { parseBody } from '../http/parse-body.js';
import { PromptsService } from './prompts.service.js';

function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

@Controller('ingest/prompts')
export class PromptsController {
  constructor(
    @Inject(DeviceAuthorizationService) private readonly connectors: DeviceAuthorizationService,
    @Inject(PromptsService) private readonly prompts: PromptsService,
  ) {}

  @Post()
  @HttpCode(202)
  async ingest(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: IngestPromptRequest,
  ) {
    const connector = await this.connectors.authenticate(bearerToken(authorization));
    return this.prompts.ingest(connector, parseBody(ingestPromptRequestSchema, body));
  }
}
