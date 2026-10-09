import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ContactDto } from './contact.dto';
import { ContactService } from './contact.service';

@Controller()
export class AppController {
  constructor(private readonly contact: ContactService) {}

  @Get('health')
  @SkipThrottle()
  health(): { status: 'ok' } { return { status: 'ok' }; }

  @Get('contact/status')
  contactStatus(): { configured: boolean } { return { configured: this.contact.configured() }; }

  @Post('contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async sendContact(@Body() dto: ContactDto): Promise<{ status: 'sent' }> {
    if (dto.website) throw new BadRequestException('Solicitud no válida.');
    return this.contact.send(dto);
  }
}
