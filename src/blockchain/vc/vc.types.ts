export interface CredentialSubject {
  id: string;
  [key: string]: any;
}

export interface BatchReleaseSubject extends CredentialSubject {
  id: string;
  drugSerialNumber: string;
  batchNumber: string;
  gtin: string;
  drugName: string;
  manufacturer: string;
  gmpCertified: boolean;
  qualifiedPersonName: string;
  qualifiedPersonLicense: string;
  regulatoryAuthority: string;
  coldChainSpecs: {
    minTemp: number;
    maxTemp: number;
  };
}

export interface CarrierAccreditationSubject extends CredentialSubject {
  id: string;
  carrierName: string;
  gdpLicenseNumber: string;
  authorizedVehicleFleet: string[];
  fipsHsmEnabled: boolean;
  jurisdiction: string;
}

export interface CredentialStatus {
  id: string;
  type: 'StatusList2021Entry';
  statusPurpose: 'revocation' | 'suspension';
  statusListIndex: number;
  statusListCredential: string;
}

export interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

export interface VerifiableCredential<T extends CredentialSubject = CredentialSubject> {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name?: string;
    ethereumAddress: string;
  };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: T;
  credentialStatus?: CredentialStatus;
  proof: CredentialProof;
}

export interface PresentationProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  challenge: string;
  domain: string;
  proofValue: string;
}

export interface VerifiablePresentation {
  '@context': string[];
  id: string;
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof: PresentationProof;
}

export interface PresentationDefinition {
  id: string;
  purpose: string;
  input_descriptors: {
    id: string;
    purpose: string;
    schema: string;
    constraints?: {
      fields: {
        path: string[];
        filter?: {
          type?: string;
          pattern?: string;
          const?: any;
        };
      }[];
    };
  }[];
}

export interface PresentationExchangeVerificationResult {
  isValid: boolean;
  holder: string;
  verifiedCredentialsCount: number;
  reasons?: string[];
  claims: Record<string, any>;
}
