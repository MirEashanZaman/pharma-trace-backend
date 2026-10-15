import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { KmsSignerService, KmsKeyMetadata, KmsSignatureResult } from './kms-signer.service';

@Controller('blockchain/kms')
export class KmsController {
  constructor(private readonly kmsService: KmsSignerService) {}

  @Get('keys')
  listKeys(): KmsKeyMetadata[] {
    return this.kmsService.listKeys();
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
}
