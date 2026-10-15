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
| **Hardware Cryptographic Oracle** | IoT Security | `src/iot/oracle/hardware-oracle.service.ts` | Hardware-enclave authenticated telemetry (ATECC608A / SE050) with ECDSA on-chip signatures, monotonic nonces, and anti-tamper rejection. |
| **Singleton** | Creational | NestJS IoC Dependency Injection | Services (`@Injectable()`) are managed as thread-safe singletons across the entire application runtime. |

All design patterns are verified with automated unit tests in `src/patterns.spec.ts`.

---

##  Folder Structure

```text
pharma-trace-backend/
├── contracts/
│   └── PharmaTraceAttestation.sol     # Solidity Smart Contract for On-Chain Attestations
├── scripts/
│   └── compile.js                     # Standalone Solidity Optimizer & Compiler
├── src/
│   ├── auth/                          # Authentication & Wallet Signature Verification
│   ├── blockchain/                    # Ethers.js Web3 Provider & Attestation Service
│   ├── drugs/                         # Drug Registration and Batch Management
│   ├── events/                        # Event Sourcing, CQRS & Custody Saga Engine
│   ├── iot/                           # Temperature/Humidity Telemetry Checkpoints
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
