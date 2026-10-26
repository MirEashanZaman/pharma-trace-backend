const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const hre = require('hardhat');
require('dotenv').config();

async function getDeployer() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    if (rpcUrl && privateKey) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            await provider.getBlockNumber();
            return new ethers.Wallet(privateKey, provider);
        } catch {
            const signers = await hre.ethers.getSigners();
            return signers[0];
        }
    }

    const signers = await hre.ethers.getSigners();
    return signers[0];
}

async function deployContract(contractName, deployer, args = []) {
    const factory = await hre.ethers.getContractFactory(contractName, deployer);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    return address;
}

function updateEnv(key, value) {
    const envPath = path.resolve(__dirname, '..', '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const regex = new RegExp(`^${key}=.*$`, 'm');

    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
        envContent = (envContent.trim() ? envContent.trim() + '\n' : '') + `${key}=${value}\n`;
    }

    fs.writeFileSync(envPath, envContent);
}

async function main() {
    console.log('Deploying Enterprise Smart Contracts...');

    const deployer = await getDeployer();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer Address: ${deployerAddress}`);

    const guardians = Array.from(new Set([
        deployerAddress,
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
    ]));
    const timelockDelay = process.env.TIMELOCK_MIN_DELAY ? parseInt(process.env.TIMELOCK_MIN_DELAY, 10) : 0;
    const timelockAddress = await deployContract('PharmaGovernanceTimelock', deployer, [guardians, 2, timelockDelay]);
    console.log(`PharmaGovernanceTimelock deployed: ${timelockAddress}`);

    const stakingToken = process.env.STAKING_TOKEN_ADDRESS || deployerAddress;
    const carrierStakingAddress = await deployContract('CarrierStakingEscrow', deployer, [stakingToken]);
    console.log(`CarrierStakingEscrow deployed: ${carrierStakingAddress}`);

    const digitalTwinAddress = await deployContract('PharmaDigitalTwin', deployer, []);
    console.log(`PharmaDigitalTwin deployed: ${digitalTwinAddress}`);

    const escrowEngineAddress = await deployContract('PharmaEscrowEngine', deployer, []);
    console.log(`PharmaEscrowEngine deployed: ${escrowEngineAddress}`);

    const attestationAddress = await deployContract('PharmaTraceAttestation', deployer, []);
    console.log(`PharmaTraceAttestation deployed: ${attestationAddress}`);

    const paymasterAddress = await deployContract('PharmaPaymaster', deployer, [deployerAddress]);
    console.log(`PharmaPaymaster deployed: ${paymasterAddress}`);

    try {
        const fundTx = await deployer.sendTransaction({
            to: paymasterAddress,
            value: ethers.parseEther('2.0')
        });
        await fundTx.wait();
        console.log(`PharmaPaymaster funded with 2.0 ETH gas sponsorship deposit`);
    } catch (fundErr) {
        console.log(`PharmaPaymaster fund deposit skipped: ${fundErr.message}`);
    }

    const zkVerifierAddress = await deployContract('ZkColdChainVerifier', deployer, []);
    console.log(`ZkColdChainVerifier deployed: ${zkVerifierAddress}`);

    const deployedAddresses = {
        deployer: deployerAddress,
        deployedAt: new Date().toISOString(),
        contracts: {
            PharmaGovernanceTimelock: timelockAddress,
            CarrierStakingEscrow: carrierStakingAddress,
            PharmaDigitalTwin: digitalTwinAddress,
            PharmaEscrowEngine: escrowEngineAddress,
            PharmaTraceAttestation: attestationAddress,
            PharmaPaymaster: paymasterAddress,
            ZkColdChainVerifier: zkVerifierAddress
        }
    };

    const artifactsDir = path.resolve(__dirname, '..', 'src', 'blockchain', 'artifacts');
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(artifactsDir, 'deployed-addresses.json'),
        JSON.stringify(deployedAddresses, null, 2)
    );
    console.log('Saved deployed contract addresses to src/blockchain/artifacts/deployed-addresses.json');

    updateEnv('BLOCKCHAIN_CONTRACT_ADDRESS', attestationAddress);
    updateEnv('TIMELOCK_CONTRACT_ADDRESS', timelockAddress);
    updateEnv('CARRIER_STAKING_CONTRACT_ADDRESS', carrierStakingAddress);
    updateEnv('DIGITAL_TWIN_CONTRACT_ADDRESS', digitalTwinAddress);
    updateEnv('ESCROW_ENGINE_CONTRACT_ADDRESS', escrowEngineAddress);
    updateEnv('PAYMASTER_CONTRACT_ADDRESS', paymasterAddress);
    updateEnv('ZK_VERIFIER_CONTRACT_ADDRESS', zkVerifierAddress);

    console.log('Updated .env with all deployed contract addresses successfully');
}

main().catch((error) => {
    console.error('Deployment orchestrator failed:', error);
    process.exit(1);
});
