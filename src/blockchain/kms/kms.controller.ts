import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { KmsSignerService } from './kms-signer.service';
import type { KmsKeyMetadata, KmsSignatureResult } from './kms-signer.service';

@Controller('blockchain/kms')
export class KmsController {
  constructor(private readonly kmsService: KmsSignerService) {}

  @Get('keys')
  listKeys(@Query('provider') provider?: string): KmsKeyMetadata[] {
    const keys = this.kmsService.listKeys();
    if (provider) {
      return keys.filter((k) => k.hsmProvider === provider);
    }
    return keys;
  }

  @Get('keys/:keyId')
  getKey(@Param('keyId') keyId: string): KmsKeyMetadata {
    return this.kmsService.getKeyMetadata(keyId);
  }

  @Post('sign-digest')
  async signDigest(@Body() body: any): Promise<KmsSignatureResult> {
    return this.kmsService.signDigest(body.keyId, body.digest);
  }

  @Post('sign-message')
  async signMessage(@Body() body: any): Promise<KmsSignatureResult> {
    return this.kmsService.signMessage(body.keyId, body.message);
  }

  @Post('verify')
  async verifySignature(@Body() body: any): Promise<{ valid: boolean }> {
    const valid = await this.kmsService.verifyKmsSignature(body.message, body.signature, body.keyId);
    return { valid };
  }

  @Post('register')
  registerKey(@Body() body: any): KmsKeyMetadata {
    return this.kmsService.registerCustomKey(
      body.keyId,
      body.label,
      body.hsmProvider,
      body.seedOrKeyHex,
    );
  }

  @Put('keys/:keyId')
  updateKey(
    @Param('keyId') keyId: string,
    @Body() body: { label?: string; enabled?: boolean },
  ): KmsKeyMetadata {
    return this.kmsService.updateKeyMetadata(keyId, body);
  }

  @Delete('keys/:keyId')
  deleteKey(@Param('keyId') keyId: string): { deleted: boolean; keyId: string } {
    const deleted = this.kmsService.deregisterKey(keyId);
    return { deleted, keyId };
  }
}
