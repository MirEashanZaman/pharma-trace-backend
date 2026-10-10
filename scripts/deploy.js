const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
    console.log('🚀 Deploying PharmaTraceAttestation Smart Contract...');

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let deployer;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    if (privateKey) {
        deployer = new ethers.Wallet(privateKey, provider);
    } else {
        // Fallback to default first Hardhat node account
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            deployer = await provider.getSigner(0);
        } else {
            console.error('❌ No available accounts found on the RPC provider.');
            process.exit(1);
        }
    }

    const deployerAddress = await deployer.getAddress();
    console.log(`👤 Deployer Address: ${deployerAddress}`);

    // Load compiled artifact
    const artifactPath = path.resolve(__dirname, '..', 'src', 'blockchain', 'artifacts', 'PharmaTraceAttestation.json');
    if (!fs.existsSync(artifactPath)) {
        console.error('❌ Contract artifact not found. Please run: node scripts/compile.js first.');
        process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

    console.log('⏳ Broadcasting deployment transaction to blockchain...');
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log(`\n🎉 PharmaTraceAttestation deployed successfully!`);
    console.log(`📍 Contract Address: ${contractAddress}\n`);

    // Update .env file with contract address
    const envPath = path.resolve(__dirname, '..', '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    if (envContent.includes('BLOCKCHAIN_CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(/BLOCKCHAIN_CONTRACT_ADDRESS=.*/, `BLOCKCHAIN_CONTRACT_ADDRESS=${contractAddress}`);
    } else {
        envContent += `\nBLOCKCHAIN_CONTRACT_ADDRESS=${contractAddress}`;
    }

    if (!envContent.includes('BLOCKCHAIN_RPC_URL=')) {
        envContent += `\nBLOCKCHAIN_RPC_URL=${rpcUrl}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`📝 Updated .env with BLOCKCHAIN_CONTRACT_ADDRESS=${contractAddress}`);
}

main().catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
});
