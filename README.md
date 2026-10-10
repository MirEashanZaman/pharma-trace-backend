# PharmaTrace-ES: Backend & Smart Contract Layer

PharmaTrace-ES is an event-driven pharmaceutical supply chain tracking and attestation backend built with **NestJS**, **TypeORM**, **PostgreSQL**, and **Solidity Smart Contracts (EVM / Ethers.js)**.

---

## 🏛️ Architecture & Features

* **Event Sourcing & CQRS**: Segregates lifecycle event commands from trace queries.
* **Saga Custody Validation**: Orchestrates and enforces valid lifecycle transitions (e.g. `MANUFACTURED` -> `QUALITY_CHECKED` -> `PACKAGED` -> `SHIPPED` -> `RECEIVED` -> `DISTRIBUTED`).
* **Web3 / Smart Contract Attestation Anchor**: Anchors SHA-256 data hashes immutably to Ethereum/EVM contracts via `contracts/PharmaTraceAttestation.sol`.
* **IoT Telemetry Ingestion**: Captures temperature and humidity readings with threshold breach alerts.
* **Tamper-Evident Ledger**: Validates audit-trail integrity and detects 100% of injected data alterations.

---

## 📁 Folder Structure

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

## 🚀 Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Smart Contracts
```bash
node scripts/compile.js
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
