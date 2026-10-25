const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractsDir = path.resolve(__dirname, '..', 'contracts');
const artifactsDir = path.resolve(__dirname, '..', 'src', 'blockchain', 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
const sources = {};
for (const file of files) {
  sources[file] = {
    content: fs.readFileSync(path.join(contractsDir, file), 'utf8'),
  };
}

const input = {
  language: 'Solidity',
  sources,
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

function findImports(importPath) {
  try {
    let resolvedPath;
    if (importPath.startsWith('@openzeppelin/')) {
      resolvedPath = path.resolve(__dirname, '..', 'node_modules', importPath);
    } else {
      resolvedPath = path.resolve(contractsDir, importPath);
    }
    if (fs.existsSync(resolvedPath)) {
      return { contents: fs.readFileSync(resolvedPath, 'utf8') };
    }
    return { error: 'File not found: ' + importPath };
  } catch (err) {
    return { error: err.message };
  }
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  output.errors.forEach((err) => {
    console.error(err.formattedMessage);
  });
  if (output.errors.some((err) => err.severity === 'error')) {
    process.exit(1);
  }
}

for (const file of files) {
  const contractsInFile = output.contracts[file];
  if (!contractsInFile) continue;
  for (const contractName of Object.keys(contractsInFile)) {
    const contract = contractsInFile[contractName];
    const artifact = {
      contractName,
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
    };
    fs.writeFileSync(
      path.join(artifactsDir, `${contractName}.json`),
      JSON.stringify(artifact, null, 2)
    );
    console.log(`Compiled -> ${contractName}.json`);
  }
}

