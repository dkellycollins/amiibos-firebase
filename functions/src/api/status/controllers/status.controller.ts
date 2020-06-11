import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class StatusController {

  @ApiOperation({
    description: 'Checks the health of the API.',
    operationId: 'healthCheck',
  })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  @Get('/status')
  public healthCheck(): string {
    return 'Ok';
  }
}