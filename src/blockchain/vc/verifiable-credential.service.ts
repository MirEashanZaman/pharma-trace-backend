import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  SigningKey,
  Wallet,
  keccak256,
  toUtf8Bytes,
  recoverAddress,
  computeAddress,
} from 'ethers';
import {
  VerifiableCredential,
  VerifiablePresentation,
  BatchReleaseSubject,
  CarrierAccreditationSubject,
  PresentationDefinition,
  PresentationExchangeVerificationResult,
} from './vc.types';
import { StatusList2021Registry } from './status-list-2021.registry';
import { DidResolverService } from '../did/did-resolver.service';

@Injectable()
export class VerifiableCredentialService {
  private readonly logger = new Logger(VerifiableCredentialService.name);
  private readonly credentialStore: Map<string, VerifiableCredential> = new Map();

  constructor(
    private readonly statusListRegistry: StatusList2021Registry,
    private readonly didResolver: DidResolverService,
  ) {}

  canonicalizeForSigning(obj: Record<string, any>): string {
    const replacer = (key: string, value: any) => {
      if (key === 'proof') return undefined;
      return value;
    };
    const sortObject = (item: any): any => {
      if (item === null || typeof item !== 'object') return item;
      if (Array.isArray(item)) return item.map(sortObject);
      const sortedKeys = Object.keys(item).sort();
      const result: Record<string, any> = {};
      for (const k of sortedKeys) {
        if (k !== 'proof') {
          result[k] = sortObject(item[k]);
        }
      }
      return result;
    };
    return JSON.stringify(sortObject(obj));
  }

  computeDigest(canonicalJson: string): string {
    return keccak256(toUtf8Bytes(canonicalJson));
  }

  async issueBatchReleaseCredential(
    subject: Omit<BatchReleaseSubject, 'id'>,
    issuerWalletOrKey: Wallet | SigningKey,
  ): Promise<VerifiableCredential<BatchReleaseSubject>> {
    const issuerAddress =
      issuerWalletOrKey instanceof Wallet
        ? issuerWalletOrKey.address
        : computeAddress(issuerWalletOrKey.publicKey);

    const issuerDid = `did:ethr:${issuerAddress}`;
    const credentialId = `urn:uuid:batch-vc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const statusIndex = this.statusListRegistry.allocateIndex();

    const fullSubject: BatchReleaseSubject = {
      id: `urn:sgtin:${subject.gtin}.${subject.drugSerialNumber}`,
      ...subject,
    };

    const unsignedVc: Omit<VerifiableCredential<BatchReleaseSubject>, 'proof'> = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://pharmatrace.org/credentials/v1',
      ],
      id: credentialId,
      type: ['VerifiableCredential', 'PharmaceuticalBatchReleaseCredential'],
      issuer: {
        id: issuerDid,
        name: subject.regulatoryAuthority || 'Authorized Health Authority QP',
        ethereumAddress: issuerAddress,
      },
      issuanceDate: new Date().toISOString(),
      credentialSubject: fullSubject,
      credentialStatus: {
        id: `https://pharmatrace.org/status/list/1#${statusIndex}`,
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        statusListIndex: statusIndex,
        statusListCredential: 'https://pharmatrace.org/status/list/1',
      },
    };

    const canonical = this.canonicalizeForSigning(unsignedVc);
    const digest = this.computeDigest(canonical);
    const signature =
      issuerWalletOrKey instanceof Wallet
        ? await issuerWalletOrKey.signMessage(digest)
        : issuerWalletOrKey.sign(digest).serialized;

    const vc: VerifiableCredential<BatchReleaseSubject> = {
      ...unsignedVc,
      proof: {
        type: 'EthereumEip191Signature2021',
        created: new Date().toISOString(),
        verificationMethod: `${issuerDid}#controller`,
        proofPurpose: 'assertionMethod',
        proofValue: signature,
      },
    };

    this.credentialStore.set(credentialId, vc);
    this.logger.log(`Issued W3C BatchReleaseCredential ${credentialId} for serial ${subject.drugSerialNumber} by ${issuerDid}`);

    return vc;
  }

  async issueCarrierAccreditationCredential(
    subject: Omit<CarrierAccreditationSubject, 'id'>,
    carrierDidAddress: string,
    issuerWalletOrKey: Wallet | SigningKey,
  ): Promise<VerifiableCredential<CarrierAccreditationSubject>> {
    const issuerAddress =
      issuerWalletOrKey instanceof Wallet
        ? issuerWalletOrKey.address
        : computeAddress(issuerWalletOrKey.publicKey);

    const issuerDid = `did:ethr:${issuerAddress}`;
    const credentialId = `urn:uuid:carrier-vc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const statusIndex = this.statusListRegistry.allocateIndex();

    const fullSubject: CarrierAccreditationSubject = {
      id: `did:ethr:${carrierDidAddress}`,
      ...subject,
    };

    const unsignedVc: Omit<VerifiableCredential<CarrierAccreditationSubject>, 'proof'> = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://pharmatrace.org/credentials/v1',
      ],
      id: credentialId,
      type: ['VerifiableCredential', 'CarrierAccreditationCredential'],
      issuer: {
        id: issuerDid,
        name: 'Ministry of Health & Transport Logistics Authority',
        ethereumAddress: issuerAddress,
      },
      issuanceDate: new Date().toISOString(),
      credentialSubject: fullSubject,
      credentialStatus: {
        id: `https://pharmatrace.org/status/list/1#${statusIndex}`,
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        statusListIndex: statusIndex,
        statusListCredential: 'https://pharmatrace.org/status/list/1',
      },
    };

    const canonical = this.canonicalizeForSigning(unsignedVc);
    const digest = this.computeDigest(canonical);
    const signature =
      issuerWalletOrKey instanceof Wallet
        ? await issuerWalletOrKey.signMessage(digest)
        : issuerWalletOrKey.sign(digest).serialized;

    const vc: VerifiableCredential<CarrierAccreditationSubject> = {
      ...unsignedVc,
      proof: {
        type: 'EthereumEip191Signature2021',
        created: new Date().toISOString(),
        verificationMethod: `${issuerDid}#controller`,
        proofPurpose: 'assertionMethod',
        proofValue: signature,
      },
    };

    this.credentialStore.set(credentialId, vc);
    this.logger.log(`Issued W3C CarrierAccreditationCredential ${credentialId} for carrier ${subject.carrierName}`);

    return vc;
  }

  async verifyCredential(vc: VerifiableCredential): Promise<{ isValid: boolean; reason?: string }> {
    if (!vc.proof || !vc.proof.proofValue) {
      return { isValid: false, reason: 'Missing cryptographic proof in credential' };
    }

    if (vc.expirationDate && new Date(vc.expirationDate).getTime() < Date.now()) {
      return { isValid: false, reason: 'Verifiable credential has expired' };
    }

    if (vc.credentialStatus) {
      const isRevoked = this.statusListRegistry.isRevoked(vc.credentialStatus.statusListIndex);
      if (isRevoked) {
        const audit = this.statusListRegistry.getRevocationRecord(vc.credentialStatus.statusListIndex);
        return {
          isValid: false,
          reason: `Credential is revoked on StatusList2021 registry. Reason: ${audit?.reason || 'Non-compliance'}`,
        };
      }
    }

    const canonical = this.canonicalizeForSigning(vc);
    const digest = this.computeDigest(canonical);

    try {
      const recoveredSigner = recoverAddress(digest, vc.proof.proofValue);
      const expectedSigner = vc.issuer.ethereumAddress;

      if (recoveredSigner.toLowerCase() !== expectedSigner.toLowerCase()) {
        return {
          isValid: false,
          reason: `Signer mismatch: expected ${expectedSigner}, recovered ${recoveredSigner}`,
        };
      }
    } catch (e: any) {
      return { isValid: false, reason: `Cryptographic signature recovery failure: ${e.message}` };
    }

    return { isValid: true };
  }

  revokeCredential(
    credentialId: string,
    statusListIndex: number,
    revokedBy: string,
    reason?: string,
  ): { success: boolean; stateHash: string } {
    const result = this.statusListRegistry.revoke(statusListIndex, credentialId, revokedBy, reason);
    return {
      success: true,
      stateHash: result.stateHash,
    };
  }

  async createVerifiablePresentation(
    credentials: VerifiableCredential[],
    holderWallet: Wallet,
    challenge: string,
    domain: string = 'pharmatrace.org',
  ): Promise<VerifiablePresentation> {
    const presentationId = `urn:uuid:vp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const holderDid = `did:ethr:${holderWallet.address}`;

    const unsignedVp: Omit<VerifiablePresentation, 'proof'> = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: presentationId,
      type: ['VerifiablePresentation'],
      holder: holderDid,
      verifiableCredential: credentials,
    };

    const canonical = this.canonicalizeForSigning(unsignedVp);
    const presentationPayload = `${canonical}:${challenge}:${domain}`;
    const digest = this.computeDigest(presentationPayload);
    const signature = await holderWallet.signMessage(digest);

    return {
      ...unsignedVp,
      proof: {
        type: 'EthereumEip191Signature2021',
        created: new Date().toISOString(),
        verificationMethod: `${holderDid}#controller`,
        proofPurpose: 'authentication',
        challenge,
        domain,
        proofValue: signature,
      },
    };
  }

  async verifyPresentationExchange(
    vp: VerifiablePresentation,
    definition: PresentationDefinition,
    expectedChallenge: string,
    expectedDomain: string = 'pharmatrace.org',
  ): Promise<PresentationExchangeVerificationResult> {
    const reasons: string[] = [];
    const claims: Record<string, any> = {};

    if (!vp.proof || vp.proof.challenge !== expectedChallenge) {
      reasons.push('Presentation challenge does not match expected anti-replay challenge nonce');
    }

    if (vp.proof && vp.proof.domain !== expectedDomain) {
      reasons.push('Presentation domain does not match expected verification domain');
    }

    const canonical = this.canonicalizeForSigning(vp);
    const presentationPayload = `${canonical}:${expectedChallenge}:${expectedDomain}`;
    const digest = this.computeDigest(presentationPayload);

    try {
      const recoveredHolder = recoverAddress(digest, vp.proof.proofValue);
      const expectedHolderAddress = vp.holder.replace('did:ethr:', '');
      if (recoveredHolder.toLowerCase() !== expectedHolderAddress.toLowerCase()) {
        reasons.push(`Holder presentation signature mismatch: recovered ${recoveredHolder}`);
      }
    } catch (e: any) {
      reasons.push(`Failed to verify holder presentation signature: ${e.message}`);
    }

    let verifiedCount = 0;
    for (const vc of vp.verifiableCredential) {
      const vcCheck = await this.verifyCredential(vc);
      if (!vcCheck.isValid) {
        reasons.push(`Embedded credential ${vc.id} failed verification: ${vcCheck.reason}`);
      } else {
        verifiedCount++;
        Object.assign(claims, vc.credentialSubject);
      }
    }

    for (const descriptor of definition.input_descriptors) {
      const matchingVc = vp.verifiableCredential.find((vc) =>
        vc.type.includes(descriptor.schema),
      );
      if (!matchingVc) {
        reasons.push(`Presentation missing mandatory credential matching schema ${descriptor.schema}`);
      }
    }

    const isValid = reasons.length === 0;

    return {
      isValid,
      holder: vp.holder,
      verifiedCredentialsCount: verifiedCount,
      reasons: isValid ? undefined : reasons,
      claims,
    };
  }

  async enforceCustodyHandoverPrerequisites(
    vp: VerifiablePresentation,
    targetSerialNumber: string,
    expectedHolderAddress: string,
    challenge: string,
  ): Promise<{ authorized: boolean; qpName: string; batchNumber: string }> {
    const definition: PresentationDefinition = {
      id: 'custody-handover-gmp-gate',
      purpose: 'Enforce valid Qualified Person GMP batch release credential before physical custody transition',
      input_descriptors: [
        {
          id: 'batch-release-descriptor',
          purpose: 'Verify pharmaceutical batch release authorization',
          schema: 'PharmaceuticalBatchReleaseCredential',
        },
      ],
    };

    const pexResult = await this.verifyPresentationExchange(vp, definition, challenge);
    if (!pexResult.isValid) {
      throw new BadRequestException(
        `Custody handover blocked by W3C Presentation Exchange: ${pexResult.reasons?.join('; ')}`,
      );
    }

    const holderDid = `did:ethr:${expectedHolderAddress.toLowerCase()}`;
    if (vp.holder.toLowerCase() !== holderDid) {
      throw new BadRequestException(
        `Presentation holder ${vp.holder} does not match active handover stakeholder ${holderDid}`,
      );
    }

    const batchVc = vp.verifiableCredential.find((vc) =>
      vc.type.includes('PharmaceuticalBatchReleaseCredential'),
    );
    if (!batchVc) {
      throw new BadRequestException('Presentation does not contain PharmaceuticalBatchReleaseCredential');
    }

    const subject = batchVc.credentialSubject as BatchReleaseSubject;
    if (subject.drugSerialNumber !== targetSerialNumber) {
      throw new BadRequestException(
        `Credential drug serial ${subject.drugSerialNumber} does not match handover target serial ${targetSerialNumber}`,
      );
    }

    if (!subject.gmpCertified) {
      throw new BadRequestException('Batch release credential indicates non-compliant GMP status');
    }

    this.logger.log(
      `Custody handover authorized for serial ${targetSerialNumber}. QP: ${subject.qualifiedPersonName} (${subject.qualifiedPersonLicense})`,
    );

    return {
      authorized: true,
      qpName: subject.qualifiedPersonName,
      batchNumber: subject.batchNumber,
    };
  }
}
