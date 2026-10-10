const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '..', 'contracts', 'PharmaTraceAttestation.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'PharmaTraceAttestation.sol': {
      content: source,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  output.errors.forEach((err) => {
    console.error(err.formattedMessage);
  });
  if (output.errors.some((err) => err.severity === 'error')) {
    process.exit(1);
  }
}

const contract = output.contracts['PharmaTraceAttestation.sol']['PharmaTraceAttestation'];

const artifactsDir = path.resolve(__dirname, '..', 'src', 'blockchain', 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const artifact = {
  contractName: 'PharmaTraceAttestation',
  abi: contract.abi,
  bytecode: contract.evm.bytecode.object,
};

fs.writeFileSync(
  path.join(artifactsDir, 'PharmaTraceAttestation.json'),
  JSON.stringify(artifact, null, 2)
);

console.log(' Contract compiled successfully -> src/blockchain/artifacts/PharmaTraceAttestation.json');
