# PharmaTrace Backend & Smart Contract Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-00D6B4.svg)](../LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.26-363636.svg)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-155%2F155%20Passing-00D6B4.svg)](https://github.com/MirEashanZaman/pharma-trace-backend)
[![Compliance](https://img.shields.io/badge/FDA-21%20CFR%20Part%2011-00D6B4.svg)](https://www.fda.gov)

PharmaTrace Backend is an enterprise-grade, event-driven pharmaceutical supply chain tracking, serialization, and cryptographic attestation engine built with NestJS, TypeORM, PostgreSQL, Redis, and Solidity smart contracts deployed on EVM-compatible networks.

The platform provides end-to-end provenance verification compliant with US FDA 21 CFR Part 11, EU GxP Annex 11, the US Drug Supply Chain Security Act (DSCSA Title II), and GS1 EPCIS 2.0 standards.

---

## Architectural Highlights

* **Event Sourcing and CQRS Engine**: Segregates command mutators from high-throughput query projections for immutable audit history.
* **Distributed Custody Transfer Saga**: Compensating transaction coordinator managing multi-party handovers across Manufacturers, Distributors, and Pharmacies with automatic rollbacks.
* **Groth16 ZK-SNARK Nullifier Registry**: Zero-knowledge proof verification with an on-chain and in-memory nullifier registry preventing proof-replay attacks on temperature excursions.
* **ERC-4337 Account Abstraction Paymaster**: Enterprise paymaster sponsoring gas fees for warehouse operations via UserOperations.
* **Double-Gated Authentication**: Dual support for HttpOnly SameSite Secure cookies and Authorization Bearer headers with Redis-backed session invalidation and rate throttling.
* **Automated ALCOA+ Audit Engine**: Evaluates records against FDA 21 CFR Part 11 data integrity standards (Attributable, Legible, Contemporaneous, Original, Accurate).
* **OpenAPI / Swagger 3.0 Portal**: Interactive API documentation and endpoint testing portal available at `/api/docs`.
* **Centralized Global Exception Filter**: Sanitizes database and ORM errors, preventing schema leaks while returning RFC-7807 compliant error envelopes.
* **Smart Contract Integration Suite**: On-chain attestation anchoring, ERC-721 physical-digital twin burn-on-dispense mechanics, and automated Chainlink upkeep.
* **IoT Cold-Chain Telemetry Ingestion**: Automated threshold monitoring (2 deg C to 8 deg C) with circuit-breaker quarantine triggers upon excursion detection.

---

## Smart Contract Registry (Solidity 0.8.26, viaIR)

| Contract | Purpose |
| :--- | :--- |
| `PharmaTraceAttestation.sol` | Anchors Keccak-256 batch digests and Merkle roots on-chain |
| `PharmaDigitalTwin.sol` | ERC-721 digital twin representing physical packages, burned on patient dispense |
| `PharmaEscrowEngine.sol` | Commercial delivery-versus-payment escrow with multi-sensor consensus release |
| `CarrierStakingEscrow.sol` | Logistics carrier collateral staking and breach slashing |
| `ColdChainAutomationOracle.sol` | Autonomous Chainlink upkeep oracle triggering breach penalties |
| `PharmaCrossChainBridge.sol` | Chainlink CCIP token messenger bridging digital twins across Layer-2 rollups |
| `PharmaGovernanceTimelock.sol` | Multi-signature regulatory timelock for emergency recalls and rule changes |
| `PharmaPaymaster.sol` | ERC-4337 gas sponsorship paymaster validating UserOperations |
| `ZkColdChainVerifier.sol` | Groth16 zero-knowledge temperature proof verification |
| `PharmaUUPSProxy.sol` | ERC-1967 UUPS upgradeability proxy implementation |
| `MockERC20.sol` | Testnet collateral token for escrow and staking tests |

---

## Software Architecture & Design Patterns

PharmaTrace implements enterprise design patterns directly within domain modules:

| Design Pattern | Category | Concrete Implementation | Production Rationale |
| :--- | :--- | :--- | :--- |
| **Strategy** | Behavioral | `src/auth/jwt.strategy.ts`<br>`src/events/strategies/*.strategy.ts` | Pluggable JWT passport validation and event-specific verification routines. |
| **Factory** | Creational | `src/events/strategies/event-strategy.factory.ts` | Resolves and instantiates appropriate event processing strategies dynamically. |
| **Builder** | Creational | `src/drugs/builders/compliance-dossier.builder.ts` | Step-by-step construction of complex WHO/FDA GxP compliance audit dossiers. |
| **Adapter** | Structural | `src/iot/adapters/iot-sensor.adapter.ts` | Normalizes heterogeneous hardware streams into a unified domain schema. |
| **Facade** | Structural | `src/blockchain/blockchain.facade.ts` | Encapsulates low-level EVM RPC, gas estimation, and receipt polling behind high-level interfaces. |
| **Circuit Breaker** | Resilience | `src/iot/circuit-breaker/cold-chain.circuit-breaker.ts` | Monitors cold-chain threshold compliance (2 deg C to 8 deg C) to halt shipments upon consecutive breaches. |
| **Observer** | Behavioral | `src/events/observers/audit.observer.ts`<br>`src/iot/iot.gateway.ts` | Decouples event generation from asynchronous audit logging and WebSocket live telemetry broadcasts. |
| **Saga** | Architectural | `src/events/saga/custody-transfer.saga.ts` | Orchestrates distributed custody transitions across supply chain roles with compensatory rollback. |
| **Merkle Batching** | Scalability | `src/blockchain/merkle/batch-attestation.engine.ts` | Aggregates high-frequency serialization events into 32-byte Merkle roots anchored on-chain. |
| **ZK Nullifier Registry** | Cryptography | `src/blockchain/zk/zk-proof.engine.ts` | Tracks proof nullifiers to prevent proof replay attacks on cold-chain excursions. |
| **Account Abstraction** | Web3 UX | `src/blockchain/account-abstraction/` | Bundles and sponsors UserOperations for gasless supply chain operations. |

---

## Core REST API Endpoints

Interactive Swagger documentation is available at `http://localhost:3500/api/docs`.

### Authentication & Users (`/auth`)

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | Public | Register enterprise stakeholder account |
| POST | `/auth/login` | Public | Authenticate via email and password; sets HttpOnly cookies |
| POST | `/auth/web3-login` | Public | Authenticate via EIP-191 MetaMask personal signature |
| POST | `/auth/refresh` | Public | Rotate refresh token and update session cookies |
| POST | `/auth/logout` | Authenticated | Revoke JWT session in Redis and clear authentication cookies |
| GET | `/auth/profile` | Authenticated | Retrieve authenticated user profile |
| PUT | `/auth/profile` | Authenticated | Update user name, organization, wallet address, or password |
| GET | `/auth/users` | Admin Only | List all registered facility accounts and compliance metrics |
| POST | `/auth/users/:id/warn` | Admin Only | Issue compliance warning flag to a stakeholder |
| PUT | `/auth/users/:id/disable` | Admin Only | Toggle account suspension status |
| DELETE | `/auth/users/:id` | Admin Only | Decommission stakeholder account |

### Drug Inventory & Serialization (`/drugs`)

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| GET | `/drugs` | Public | Retrieve registered pharmaceutical drug catalog |
| GET | `/drugs/:serialNumber` | Public | Retrieve drug specifications and provenance by serial number |
| POST | `/drugs` | Manufacturer / Admin | Commission new drug batch with GS1 DataMatrix identifiers |
| POST | `/drugs/bulk` | Manufacturer / Admin | Bulk commission serialized drug cartons |
| POST | `/drugs/qc-release` | Manufacturer / Admin | Sign laboratory QC release disposition |
| POST | `/drugs/dispatch` | Manufacturer / Admin | Dispatch sealed reefer consignment to logistics |
| POST | `/drugs/distributor/inbound` | Distributor / Admin | Verify container dock seals and receive consignment |
| POST | `/drugs/distributor/manifest` | Distributor / Admin | Generate outbound electronic Bill of Lading (e-BoL) manifest |
| POST | `/drugs/pharmacy/inbound` | Pharmacy / Admin | Verify delivery against manifest and admit to dispensary |
| POST | `/drugs/pharmacy/dispense` | Pharmacy / Admin | Dispense medication against prescription token and burn digital twin |

### Custody Events & Lineage (`/drug-events`)

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| GET | `/drug-events/:serialNumber` | Public | Retrieve complete lifecycle event trail for a drug serial |
| POST | `/drug-events` | Authenticated | Record lifecycle event (`MANUFACTURED`, `SHIPPED`, `RECEIVED`, `DISPENSED`, `RECALLED`) |

### Blockchain & Regulatory Attestation (`/blockchain`)

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| GET | `/blockchain/verify/:hash` | Public | Verify cryptographic attestation validity on-chain |
| POST | `/blockchain/attestation` | Authorized Signer | Commit SHA-256 batch hash directly to EVM contract |
| GET | `/blockchain/dossier/:serialNumber` | Public | Generate regulatory compliance dossier with hash anchor |
| POST | `/blockchain/zk/verify` | Authenticated | Submit and verify Groth16 zero-knowledge temperature proof |

---

## Getting Started

### Prerequisites

* Node.js >= 20.0.0
* PostgreSQL 16
* Redis 7

### Environment Configuration

Copy the example environment template:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3500` | HTTP application port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `12345` | Database password |
| `DB_DATABASE` | `pharma_trace` | Database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | `your_secret` | JWT signing secret |
| `RPC_URL` | `http://127.0.0.1:8545` | EVM JSON-RPC provider |

### Database Seeding

Seed default stakeholder accounts and multi-tier supply chain demo batches:

```bash
npm install
npm run compile:contract
npm run seed
```

### Execution

```bash
# Start development server with live reload
npm run start:dev

# Build production TypeScript artifacts
npm run build

# Start production server
npm run start:prod
```

### Automated Tests

```bash
# Execute Jest unit and integration test suite (155 tests)
npm run test

# Run tests with code coverage analysis
npm run test:cov
```

---

## Author & Engineering Credits

Engineered by **Mir Eashan Zaman** as part of the PharmaTrace enterprise platform.

## License

This software is released under the MIT License. See [LICENSE](../LICENSE) for details.
