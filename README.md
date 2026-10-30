# PharmaTrace-ES: Backend Architecture and Smart Contract Suite

PharmaTrace-ES is an enterprise-grade, event-driven pharmaceutical supply chain tracking, serialization, and cryptographic attestation backend built with NestJS, TypeORM, PostgreSQL, and Solidity Smart Contracts deployed on EVM-compatible networks.

The platform provides end-to-end verification compliant with US FDA 21 CFR Part 11, EU GxP Annex 11, US Drug Supply Chain Security Act (DSCSA), and GS1 EPCIS 2.0 standards.

---

## Architectural Highlights

* **Event Sourcing and CQRS Engine**: Strict segregation of command mutators from high-throughput query projections.
* **Distributed Custody Transfer Saga**: Compensating transaction coordinator managing multi-party handovers across Manufacturers, Distributors, and Pharmacies.
* **OpenAPI / Swagger 3.0 Documentation**: Live API documentation and interactive testing portal available at `/api/docs`.
* **Centralized Global Exception Filter**: Sanitizes PostgreSQL and TypeORM errors, preventing schema leaks while returning standardized RFC-7807 compliant JSON envelopes.
* **FDA 21 CFR Part 11 Audit Logging Interceptor**: Records authenticated caller identities, roles, IP addresses, endpoint routes, and execution latency (`X-Response-Time`).
* **Strict Role-Based Access Control (RBAC)**: User roles are immutable post-registration. Administrative accounts are protected against unauthorized self-registration, deletions, and compliance warnings.
* **Dual Authentication Modes**: Enterprise JWT bearer tokens paired with cryptographic Web3 wallet signatures (EIP-191 personal signatures).
* **Smart Contract Integration Suite**: On-chain attestation anchoring, ERC-721 physical-digital twin burn-on-dispense mechanics, and automated Chainlink escrow.
* **IoT Cold-Chain Telemetry Ingestion**: Automated threshold monitoring (2 deg C to 8 deg C) with circuit-breaker quarantine triggers upon excursion detection.

---

## Software Architecture and Production Design Patterns

PharmaTrace-ES implements real-world enterprise design patterns directly within domain modules (Package-by-Feature):

| Design Pattern | Category | Concrete Implementation | Production Engineering Rationale |
|---|---|---|---|
| Strategy | Behavioral | `src/auth/jwt.strategy.ts`<br>`src/events/strategies/*.strategy.ts` | Pluggable JWT passport validation and event-specific verification routines (`ManufacturedStrategy`, `ShippedStrategy`, `ReceivedStrategy`, `TemperatureMonitoredStrategy`). |
| Factory | Creational | `src/events/strategies/event-strategy.factory.ts` | Resolves and instantiates appropriate event processing strategies dynamically from incoming event types. |
| Builder | Creational | `src/drugs/builders/compliance-dossier.builder.ts` | Chainable step-by-step construction of complex WHO/FDA GxP compliance audit dossiers across drug metadata, event logs, and temperature analytics. |
| Adapter | Structural | `src/iot/adapters/iot-sensor.adapter.ts` | Normalizes heterogeneous external hardware streams (raw ESP32 strings, industrial Modbus register arrays, and REST JSON) into a unified domain telemetry schema. |
| Facade | Structural | `src/blockchain/blockchain.facade.ts` | Hides low-level EVM RPC, gas estimation, ABI encoding, and transaction receipt polling behind a high-level attestation interface. |
| Circuit Breaker | Resilience | `src/iot/circuit-breaker/cold-chain.circuit-breaker.ts` | Monitors cold-chain threshold compliance (2 deg C to 8 deg C); transitions between CLOSED, OPEN, and HALF_OPEN to halt shipments upon consecutive temperature breaches. |
| Observer | Behavioral | `src/events/observers/audit.observer.ts`<br>`src/iot/iot.gateway.ts` | Decouples event generation from asynchronous notification subscribers, audit loggers, and WebSocket live cartography broadcasts. |
| Saga | Architectural | `src/events/saga/custody-transfer.saga.ts` | Orchestrates distributed custody transitions across supply chain roles (Manufacturer, Distributor, Pharmacy) with compensatory rollback on invalid handovers. |
| Compensating Rollback | Resilience / Saga | `src/events/saga/custody-rollback.engine.ts` | Reverses invalid forward custody transitions into compensatory regulatory states (`QUARANTINED`, `RETURN_TO_MANUFACTURER`, `REVERT_TO_DISTRIBUTED`) with full audit provenance. |
| Merkle Batching | Scalability / Gas Optimization | `src/blockchain/merkle/batch-attestation.engine.ts`<br>`contracts/PharmaTraceAttestation.sol` | Aggregates high-frequency serialization events into 32-byte cryptographic Merkle roots, anchoring thousands of events in a single L1/L2 transaction with IPFS CIDs. |
| EIP-712 Dual Handshake | Cryptographic Security | `src/blockchain/eip712/eip712-custody.ts` | Enforces structured two-phase cryptographic handshakes (`TransferOffer` and `TransferAccept`) preventing unilateral handovers and cross-chain replay attacks. |
| GS1 EPCIS 2.0 JSON-LD CBV | Interoperability / Cryptographic Anchoring | `src/blockchain/epcis/epcis-jsonld.service.ts` | Standard GS1 EPCIS 2.0 JSON-LD CBV event documents (Object, Aggregation, Transaction) with deterministic canonicalization and SHA-256 hash anchoring for FDA DSCSA compliance. |
| Hardware Cryptographic Oracle | IoT Security | `src/iot/oracle/hardware-oracle.service.ts` | Hardware-enclave authenticated telemetry (ATECC608A / SE050) with ECDSA on-chip signatures, monotonic nonces, and anti-tamper rejection. |
| Physical-Digital Twin (ERC-721) | Anti-Recirculation Defense | `src/blockchain/digital-twin/digital-twin.service.ts`<br>`contracts/PharmaDigitalTwin.sol` | On-chain token representation with burn-on-dispense mechanics permanently destroying serial balance upon patient dispensing to prevent package reuse. |
| Conditional Delivery Escrow (DvP) | Commercial Settlement | `src/blockchain/escrow/pharma-escrow.service.ts`<br>`contracts/PharmaEscrowEngine.sol` | Automated delivery-vs-payment escrow locking invoice funds and releasing payment upon EIP-712 acceptance and verified cold-chain compliance. |
| Medianized Multi-Sensor Consensus | Fault Tolerance / Consensus | `src/iot/consensus/sensor-consensus.engine.ts`<br>`src/blockchain/escrow/pharma-escrow.service.ts` | Quorum-based Byzantine fault tolerance evaluating multi-probe cold-chain telemetry via statistical median filtering, isolating aberrant hardware sensor spikes. |
| W3C DID and GS1 GLN Resolver | Identity and Interoperability | `src/blockchain/did/did-resolver.service.ts` | Resolves did:ethr identifiers into standard W3C DID documents with GS1 Global Location Numbers and FDA Establishment Identifiers for DSCSA compliance. |
| GS1 Digital Link 1.2 Resolver | Web Standard Identification | `src/blockchain/digital-link/digital-link.service.ts`<br>`src/blockchain/digital-link/digital-link.controller.ts` | Resolves standard GS1 URIs (`/01/{gtin}/21/{serial}`) to RFC 9264 linksets (e-Leaflets, CoA, EPCIS 2.0, DID accreditation, and on-chain burn checks). |
| Dynamic NFC (AES-128 CMAC) | Anti-Cloning Hardware Security | `src/iot/nfc/nfc-verification.service.ts` | Validates NTAG 424 DNA Secure Unique NFC tokens with dynamic CMAC cryptographic digests and strictly monotonic counter progression. |
| Regulatory Multi-Sig and Timelock | Decentralized Governance / Security | `contracts/PharmaGovernanceTimelock.sol`<br>`src/blockchain/governance/governance-timelock.service.ts` | M-of-N threshold quorum across regulatory authorities (FDA, EMA, MHRA) with mandatory timelock delay before executing sensitive parameter changes. |
| Carrier Collateral Staking and Slashing | Economic Security / Smart Escrow | `contracts/CarrierStakingEscrow.sol`<br>`src/blockchain/escrow/carrier-staking.service.ts`<br>`src/blockchain/escrow/carrier-staking.controller.ts` | ERC-20 security deposit staking for cold-chain carriers requiring collateral bonds per shipment, coupled with autonomous bond slashing upon temperature excursions. |
| SOLID Architectural Principles Suite | Software Architecture | `src/compliance/solid/`<br>`src/compliance/compliance.module.ts` | Complete production realization of SRP, OCP, LSP, ISP, and DIP for regulatory compliance evaluation and multi-target attestation anchoring. |

---

## SOLID Architectural Principles Implementation

PharmaTrace-ES adheres strictly to SOLID object-oriented design principles within the `src/compliance/solid/` domain:

* **Single Responsibility Principle (SRP)**:
  * `RegulatoryRuleEvaluator`: Exclusively responsible for executing regulatory rule checks across payloads.
  * `DossierCryptographicSigner`: Exclusively responsible for HMAC/SHA-256 cryptographic signing and digest generation.
  * `ComplianceAuditLogger`: Exclusively responsible for append-only audit trail formatting and persistent event logging.
* **Open/Closed Principle (OCP)**:
  * `IComplianceRule` interface defines an extensible evaluation contract open for new jurisdictions but closed for core modification.
  * Concrete rule implementations (`FdaDscsaRule`, `EuFmdRule`, `WhoColdChainRule`, `HealthCanadaRule`) can be added dynamically without altering engine logic.
* **Liskov Substitution Principle (LSP)**:
  * `AbstractAttestationAnchor` provides standard contracts for blockchain attestation.
  * Subclasses `DirectOnChainAnchor` (direct contract call) and `MerkleBatchedAnchor` (cryptographic Merkle root batching) can be substituted transparently anywhere an `AbstractAttestationAnchor` is consumed without violating system invariants.
* **Interface Segregation Principle (ISP)**:
  * Segregated client interfaces (`ISerializedTracker`, `IColdChainAuditor`, `ICustodySigner`, `ICollateralStakeholder`) ensure supply chain nodes depend only on capabilities relevant to their operational role.
* **Dependency Inversion Principle (DIP)**:
  * High-level orchestration module `ComplianceEngine` depends exclusively on abstractions (`IComplianceRule[]`, `AbstractAttestationAnchor`), injected dynamically via NestJS IoC dependency injection rather than tight coupling to low-level database or EVM RPC implementations.

---

## Core REST and Web3 API Endpoints

Interactive Swagger documentation is available at `http://localhost:3500/api/docs`.

### Authentication and User Management (`/auth`)

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register enterprise facility account (ADMIN role restricted). |
| POST | `/auth/login` | Public | Authenticate via email and password; returns JWT token. |
| POST | `/auth/web3-login` | Public | Authenticate via EIP-191 MetaMask personal signature. |
| POST | `/auth/forgot-password` | Public | Dispatch SHA-256 hashed 6-digit OTP to registered email. |
| POST | `/auth/reset-password` | Public | Verify OTP and update password credentials. |
| GET | `/auth/profile` | Authenticated | Retrieve authenticated caller profile. |
| PUT | `/auth/profile` | Authenticated | Update full name, organization, wallet address, or password. Role is immutable. |
| GET | `/auth/users` | Admin Only | List all registered facility accounts and compliance metrics. |
| POST | `/auth/users/:id/warn` | Admin Only | Issue formal compliance warning to non-admin accounts. |
| POST | `/auth/users/:id/clear-warnings` | Admin Only | Clear active compliance warnings for non-admin accounts. |
| PUT | `/auth/users/:id/disable` | Admin Only | Toggle temporary account suspension for non-admin accounts. |
| DELETE | `/auth/users/:id` | Admin Only | Permanently decommission facility account (admins protected). |

### Drug Inventory and Serialization (`/drugs`)

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| GET | `/drugs` | Public | Retrieve registered pharmaceutical drug catalog. |
| GET | `/drugs/:serialNumber` | Public | Retrieve drug specifications by unique serial number. |
| POST | `/drugs` | Manufacturer / Admin | Register new batch serial number with GS1 identifiers. |

### Custody and Supply Chain Events (`/drug-events`)

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| GET | `/drug-events/:serialNumber` | Public | Retrieve complete lifecycle event trail for a drug serial. |
| POST | `/drug-events` | Authenticated Stakeholder | Record lifecycle event (`MANUFACTURED`, `SHIPPED`, `RECEIVED`, `DISPENSED`, `RECALLED`). |

### On-Chain Attestation and Verification (`/blockchain`)

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| GET | `/blockchain/verify/:hash` | Public | Verify cryptographic attestation validity on-chain. |
| POST | `/blockchain/attestation` | Authorized Signer | Commit SHA-256 batch hash directly to EVM contract. |
| GET | `/blockchain/dossier/:serialNumber` | Public | Generate regulatory compliance dossier with hash anchor. |

---

## Getting Started

### Prerequisites

* Node.js v18+ or v20+
* PostgreSQL 15+
* Hardhat / Local EVM node (optional, for local contract development)

### Environment Configuration

Create a `.env` file in the root of `pharma-trace-backend`:

```env
PORT=3500
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=pharma_trace
DB_SYNCHRONIZE=true

JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION=24h

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
ATTESTATION_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Installation and Database Seeding

```bash
# Install dependencies
npm install

# Seed genesis accounts, drugs, and cryptographic attestation events
npm run seed
```

### Build and Start

```bash
# Build TypeScript artifacts
npm run build

# Start production server
npm run start:prod

# Start development server with live reload
npm run start:dev
```

### Running Test Suite

```bash
# Execute Jest unit tests and design pattern validations
npm run test

# Run tests with code coverage report
npm run test:cov
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for full details.
