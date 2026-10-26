const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZkColdChainVerifier Contract", function () {
  let verifier;
  let deployer;
  let caller;

  const validProofA = [
    ethers.keccak256(ethers.toUtf8Bytes("A_POINT_X")),
    ethers.keccak256(ethers.toUtf8Bytes("A_POINT_Y")),
  ];

  const validProofB = [
    [
      ethers.keccak256(ethers.toUtf8Bytes("B_POINT_X1")),
      ethers.keccak256(ethers.toUtf8Bytes("B_POINT_X2")),
    ],
    [
      ethers.keccak256(ethers.toUtf8Bytes("B_POINT_Y1")),
      ethers.keccak256(ethers.toUtf8Bytes("B_POINT_Y2")),
    ],
  ];

  const validProofC = [
    ethers.keccak256(ethers.toUtf8Bytes("C_POINT_X")),
    ethers.keccak256(ethers.toUtf8Bytes("C_POINT_Y")),
  ];

  const sampleBatchHash = ethers.keccak256(ethers.toUtf8Bytes("BATCH-ZK-VERIFY-001"));
  const minTempScaled = 200n;
  const maxTempScaled = 800n;

  beforeEach(async function () {
    [deployer, caller] = await ethers.getSigners();

    const ZkColdChainVerifier = await ethers.getContractFactory("ZkColdChainVerifier");
    verifier = await ZkColdChainVerifier.deploy();
    await verifier.waitForDeployment();
  });

  describe("Proof Verification", function () {
    it("should accept valid Groth16 proof with compliant signals", async function () {
      const publicInputs = [
        BigInt(sampleBatchHash),
        minTempScaled,
        maxTempScaled,
        1n,
      ];

      const tx = await verifier.connect(caller).verifyProof(
        validProofA,
        validProofB,
        validProofC,
        publicInputs
      );

      await expect(tx).to.emit(verifier, "ProofVerified").withArgs(
        sampleBatchHash,
        true,
        minTempScaled,
        maxTempScaled
      );
    });

    it("should return false when temperature signals indicate excursion", async function () {
      const publicInputs = [
        BigInt(sampleBatchHash),
        minTempScaled,
        maxTempScaled,
        0n,
      ];

      const isOk = await verifier.verifyProof.staticCall(
        validProofA,
        validProofB,
        validProofC,
        publicInputs
      );

      expect(isOk).to.equal(false);
    });

    it("should reject proof when point A contains zero coordinates", async function () {
      const zeroProofA = [0n, 0n];
      const publicInputs = [BigInt(sampleBatchHash), minTempScaled, maxTempScaled, 1n];

      await expect(
        verifier.verifyProof(zeroProofA, validProofB, validProofC, publicInputs)
      ).to.be.revertedWith("Invalid proof point A");
    });

    it("should reject proof when point C contains zero coordinates", async function () {
      const zeroProofC = [0n, 0n];
      const publicInputs = [BigInt(sampleBatchHash), minTempScaled, maxTempScaled, 1n];

      await expect(
        verifier.verifyProof(validProofA, validProofB, zeroProofC, publicInputs)
      ).to.be.revertedWith("Invalid proof point C");
    });

    it("should verify cold chain integrity through helper method", async function () {
      const isCompliant = await verifier.verifyColdChainIntegrity.staticCall(
        validProofA,
        validProofB,
        validProofC,
        sampleBatchHash,
        minTempScaled,
        maxTempScaled
      );

      expect(isCompliant).to.equal(true);
    });
  });
});
