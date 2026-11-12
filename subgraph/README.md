# PharmaTrace Graph Protocol Subgraph

The Graph Protocol Subgraph indexing pharmaceutical supply chain provenance across the PharmaTrace smart contract ecosystem.

## Overview

The subgraph indexes events emitted across the core EVM smart contracts:
- `PharmaDigitalTwin`: Tokenized item and batch twins, serial numbers, GTINs, and custody transfers with burn-on-dispense state.
- `PharmaEscrowEngine`: Commercial payment escrows, conditional cold-chain releases, and breach refunds.
- `PharmaTraceAttestation`: Cryptographic attestations, Merkle batch rollups, and soulbound compliance accreditations.
- `CarrierStakingEscrow`: Carrier bonds, slashes, and performance stakes.
- `ZkColdChainVerifier`: Groth16 zero-knowledge proof verification records.
- `ColdChainAutomationOracle`: Automated IoT telemetry events, excursion alerts, and automated penalties.
- `PharmaCrossChainBridge`: Cross-chain bridge messages and digital twin locks across Layer-2 rollups.

## Directory Structure

- `schema.graphql`: GraphQL schema defining indexed entities.
- `subgraph.yaml`: Subgraph manifest configuring data sources, ABIs, and event handlers.
- `src/mapping.ts`: AssemblyScript event handler routines with input sanitization.
- `queries.graphql`: Pre-built GraphQL queries for provenance timelines and audits.

## Commands

```bash
cd subgraph
npm install
npm run codegen
npm run build
npm run create:local
npm run deploy:local
```

## Author & License

Engineered by **Mir Eashan Zaman**. Licensed under the MIT License.
