# PharmaTrace-ES: Backend & Smart Contract Layer

PharmaTrace-ES is an event-driven pharmaceutical supply chain tracking and attestation backend built with **NestJS**, **TypeORM**, **PostgreSQL**, and **Solidity Smart Contracts (EVM / Ethers.js)**.

---

## Architecture & Features

* **Event Sourcing & CQRS**: Segregates lifecycle event commands from trace queries.
* **Saga Custody Validation**: Orchestrates and enforces valid lifecycle transitions (e.g. `MANUFACTURED` -> `QUALITY_CHECKED` -> `PACKAGED` -> `SHIPPED` -> `RECEIVED` -> `DISTRIBUTED`).
* **Web3 / Smart Contract Attestation Anchor**: Anchors SHA-256 data hashes immutably to Ethereum/EVM contracts via `contracts/PharmaTraceAttestation.sol`.
* **IoT Telemetry Ingestion**: Captures temperature and humidity readings with threshold breach alerts.
* **Tamper-Evident Ledger**: Validates audit-trail integrity and detects 100% of injected data alterations.

---

## Software Architecture & Production Design Patterns Matrix

PharmaTrace-ES implements real-world enterprise design patterns directly within domain modules (Package-by-Feature) rather than artificial academic directory wrappers:

| Design Pattern | Category | Concrete Implementation | Production Engineering Rationale |
|---|---|---|---|
| **Strategy** | Behavioral | `src/auth/jwt.strategy.ts`<br>`src/events/strategies/*.strategy.ts` | Pluggable JWT passport validation and event-specific verification routines (`ManufacturedStrategy`, `ShippedStrategy`, `ReceivedStrategy`, `TemperatureMonitoredStrategy`). |
| **Factory** | Creational | `src/events/strategies/event-strategy.factory.ts` | Resolves and instantiates appropriate event processing strategies dynamically from incoming event types. |
| **Builder** | Creational | `src/drugs/builders/compliance-dossier.builder.ts` | Chainable step-by-step construction of complex WHO/FDA GxP compliance audit dossiers across drug metadata, event logs, and temperature analytics. |
| **Adapter** | Structural | `src/iot/adapters/iot-sensor.adapter.ts` | Normalizes heterogeneous external hardware streams (raw ESP32 strings, industrial Modbus register arrays, and REST JSON) into a unified domain telemetry schema. |
| **Facade** | Structural | `src/blockchain/blockchain.facade.ts` | Hides low-level EVM RPC, gas estimation, ABI encoding, and transaction receipt polling behind a high-level attestation interface. |
| **Circuit Breaker** | Resilience | `src/iot/circuit-breaker/cold-chain.circuit-breaker.ts` | Monitors cold-chain threshold compliance (2°C - 8°C); transitions between `CLOSED`, `OPEN`, and `HALF_OPEN` to halt shipments upon consecutive temperature breaches. |
| **Observer** | Behavioral | `src/events/observers/audit.observer.ts`<br>`src/iot/iot.gateway.ts` | Decouples event generation from asynchronous notification subscribers, audit loggers, and WebSocket live cartography broadcasts. |
| **Saga** | Architectural | `src/events/saga/custody-transfer.saga.ts` | Orchestrates distributed custody transitions across supply chain roles (Manufacturer, Distributor, Pharmacy) with compensatory rollback on invalid handovers. |
| **Compensating Rollback** | Resilience / Saga | `src/events/saga/custody-rollback.engine.ts` | Reverses invalid forward custody transitions into compensatory regulatory states (`QUARANTINED`, `RETURN_TO_MANUFACTURER`, `REVERT_TO_DISTRIBUTED`) with full audit provenance. |
| **Load Balancer** | Scalability / Resiliency | `src/blockchain/load-balancer/rpc-load-balancer.ts` | Multi-node Web3 RPC traffic distribution and failover across local and testnet nodes supporting `ROUND_ROBIN`, `LEAST_CONNECTIONS`, and `PRIORITY_FAILOVER` strategies with circuit-style node health tracking. |
| **Merkle Batching** | Scalability / Gas Optimization | `src/blockchain/merkle/batch-attestation.engine.ts`<br>`contracts/PharmaTraceAttestation.sol` | Aggregates high-frequency serialization events into 32-byte cryptographic Merkle roots, anchoring thousands of events in a single L1/L2 transaction with IPFS CIDs and inclusion proofs. |
| **EIP-712 Dual Handshake** | Cryptographic Security | `src/blockchain/eip712/eip712-custody.ts` | Enforces structured two-phase cryptographic handshakes (`TransferOffer` and `TransferAccept`) preventing unilateral handovers and cross-chain replay attacks. |
| **EPCIS Packaging Hierarchy** | Domain Modeling | `src/blockchain/epcis/epcis-aggregator.ts` | GS1 EPCIS 2.0 parent-child logistics hierarchy (Item -> Case -> Pallet -> Container) with recursive SSCC provenance and custody inheritance. |
| **GS1 EPCIS 2.0 JSON-LD CBV** | Interoperability / Cryptographic Anchoring | `src/blockchain/epcis/epcis-jsonld.service.ts` | Standard GS1 EPCIS 2.0 JSON-LD CBV event documents (Object, Aggregation, Transaction) with deterministic canonicalization and SHA-256 hash anchoring for FDA DSCSA compliance. |
| **Hardware Cryptographic Oracle** | IoT Security | `src/iot/oracle/hardware-oracle.service.ts` | Hardware-enclave authenticated telemetry (ATECC608A / SE050) with ECDSA on-chip signatures, monotonic nonces, and anti-tamper rejection. |
| **IPFS Storage Pinning** | Decentralized Storage | `src/blockchain/ipfs/ipfs.service.ts` | Pins full regulatory audit dossiers off-chain with deterministic SHA-256 base32 CIDv1 identifiers anchored on-chain for tamper-evident data availability. |
| **Zero-Knowledge Proofs (ZK-SNARK)** | Privacy-Preserving Compliance | `src/blockchain/zk/zk-proof.engine.ts` | Groth16 zero-knowledge proofs verifying cold-chain temperature boundaries and private batch membership without disclosing proprietary formulation or logistics data. |
| **ERC-4337 Account Abstraction Paymaster** | Gasless Enterprise UX | `src/blockchain/account-abstraction/paymaster.service.ts` | Enterprise gas sponsorship relay for authorized supply chain operations (packaging, transit, custody handovers) removing cryptocurrency barriers for operators. |
| **Soulbound Accreditation (ERC-5192)** | Identity & Compliance Badges | `src/blockchain/sbt/soulbound-accreditation.service.ts`<br>`contracts/PharmaTraceAttestation.sol` | Non-transferable cryptographic credentials (GMP, GDP, GSP licenses) bound to organization identities with on-chain regulatory verification and revocation. |
| **Physical-Digital Twin (ERC-1155)** | Anti-Recirculation Defense | `src/blockchain/digital-twin/digital-twin.service.ts`<br>`contracts/PharmaDigitalTwin.sol` | On-chain multi-token representation with burn-on-dispense mechanics permanently destroying serial balance upon patient dispensing to prevent package reuse. |
| **Conditional Delivery Escrow (DvP)** | Commercial Settlement | `src/blockchain/escrow/pharma-escrow.service.ts`<br>`contracts/PharmaEscrowEngine.sol` | Automated delivery-vs-payment escrow locking invoice funds and releasing payment upon EIP-712 acceptance and verified cold-chain compliance. |
| **Chainlink Automation & DON Keepers** | Autonomous Settlement | `contracts/PharmaEscrowEngine.sol`<br>`src/blockchain/escrow/pharma-escrow.service.ts` | Decentralized oracle automation (`checkUpkeep` / `performUpkeep`) triggering autonomous settlement payouts and delivery SLA breach refunds without central intermediaries. |
| **W3C DID & GS1 GLN Resolver** | Identity & Interoperability | `src/blockchain/did/did-resolver.service.ts` | Resolves did:ethr identifiers into standard W3C DID documents with GS1 Global Location Numbers and FDA Establishment Identifiers for DSCSA compliance. |
| **GS1 Digital Link 1.2 Resolver** | Web Standard Identification | `src/blockchain/digital-link/digital-link.service.ts`<br>`src/blockchain/digital-link/digital-link.controller.ts` | Resolves standard GS1 URIs (`/01/{gtin}/21/{serial}`) to RFC 9264 linksets (e-Leaflets, CoA, EPCIS 2.0, DID accreditation, and on-chain burn checks) with Modulo-10 checksum validation. |
| **Dynamic NFC (AES-128 CMAC)** | Anti-Cloning Hardware Security | `src/iot/nfc/nfc-verification.service.ts` | Validates NTAG 424 DNA Secure Unique NFC tokens with dynamic CMAC cryptographic digests and strictly monotonic counter progression. |
| **The Graph Decentralized Indexer** | Query Optimization & Indexing | `subgraph/schema.graphql`<br>`subgraph/subgraph.yaml`<br>`subgraph/src/mapping.ts` | High-performance GraphQL indexing protocol mapping emitted contract events into queryable relational entities. |
| **Singleton** | Creational | NestJS IoC Dependency Injection | Services (`@Injectable()`) are managed as thread-safe singletons across the entire application runtime. |

All design patterns are verified with automated unit tests in `src/patterns.spec.ts`.

---

## Cybersecurity & Defense-in-Depth Controls

PharmaTrace-ES enforces enterprise application and Web3 security standards across the system perimeter:

* **EIP-4361 SIWE Challenge-Nonce Authentication**: Server-issued, time-bounded challenge nonces prevent wallet signature replay attacks on Web3 login routes (`/auth/challenge/:walletAddress`).
* **Privilege Escalation Immunity**: Strict server-side role enforcement prevents clients from claiming administrative privileges during self-registration.
* **API Rate Limiting & DDoS Mitigation**: Global NestJS `ThrottlerGuard` enforces request quotas across authentication, IoT ingest, and mutation routes.
* **HTTP Security Headers & Restricted CORS**: Helmet middleware enforces secure headers (HSTS, CSP, X-Frame-Options), while CORS strictly whitelists verified client origins.
* **Hardware Enclave Telemetry Authentication**: Ingest routes enforce on-chip ECDSA signature verification (`HardwareOracleService`), halting spoofed sensor readings and anti-replay violations.
* **GxP Append-Only Audit Trail**: Destructive deletion routes are eliminated; lifecycle records are strictly append-only in compliance with US FDA 21 CFR Part 11 and EU GxP Annex 11.
* **On-Chain Role-Based Access Control**: Smart contract mutation functions (`registerAttestation`, `anchorBatch`) restrict execution strictly to verified enterprise roles.

---

##  Folder Structure

```text
pharma-trace-backend/
├── contracts/
│   ├── PharmaTraceAttestation.sol     # Multi-Role Attestations and Soulbound SBTs
│   ├── PharmaDigitalTwin.sol          # Physical-Digital Twin with Anti-Recirculation Burn
│   └── PharmaEscrowEngine.sol         # DvP Escrow Engine with Chainlink Automation
├── scripts/
│   ├── compile.js                     # Multi-Contract Solidity Optimizer & Compiler
│   └── deploy.js                      # Deployment Pipeline
├── subgraph/
│   ├── schema.graphql                 # Decentralized GraphQL Relational Entities
│   ├── subgraph.yaml                  # The Graph Multi-Contract Manifest
│   └── src/mapping.ts                 # AssemblyScript Log Transformation Handlers
├── src/
│   ├── auth/                          # Authentication & Wallet Signature Verification
│   ├── blockchain/                    # Web3 Provider, Digital Twin, Escrow & GS1 Link
│   ├── drugs/                         # Drug Registration and Batch Management
│   ├── events/                        # Event Sourcing, CQRS & Custody Saga Engine
│   ├── iot/                           # Telemetry Checkpoints & Dynamic NFC Verification
│   ├── ledger/                        # Hash-Chain Verification Layer
│   ├── app.module.ts
│   └── main.ts
├── iot-simulation/                    # C++ Hardware / ESP32 Simulation
├── test/                              # Jest Unit & Integration Tests
├── package.json
└── tsconfig.json
```

---

##  Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile & Deploy Smart Contracts
```bash
# 1. Compile Solidity Contracts
npm run compile:contract

# 2. Deploy to local EVM / Hardhat / Testnet
npm run deploy:contract
```

### 3. Build & Run
```bash
# Development
npm run start:dev

# Production Build
npm run build
npm run start:prod
```

### 4. Run Tests
```bash
npm run test
```
