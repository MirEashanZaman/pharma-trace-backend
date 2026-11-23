const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZkColdChainVerifier Contract", function () {
  let verifier;
  let deployer;
  let caller;

  const Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
  const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

  const validProofA = [1001n, 1002n];
  const validProofB = [
    [2001n, 2002n],
    [2003n, 2004n],
  ];
  const validProofC = [3001n, 3002n];

  const sampleBatchHashBigInt = 1234567890123456789n;
  const sampleBatchHash = ethers.zeroPadValue(ethers.toBeHex(sampleBatchHashBigInt), 32);
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
        sampleBatchHashBigInt,
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

      await expect(tx).to.emit(verifier, "ProofVerified");
    });

    it("should return false when temperature signals indicate excursion", async function () {
      const publicInputs = [
        sampleBatchHashBigInt,
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

    it("should reject proof when point A contains coordinates exceeding field size", async function () {
      const outOfBoundsProofA = [Q + 1n, 1002n];
      const publicInputs = [sampleBatchHashBigInt, minTempScaled, maxTempScaled, 1n];

      await expect(
        verifier.verifyProof(outOfBoundsProofA, validProofB, validProofC, publicInputs)
      ).to.be.revertedWith("Invalid proof point A coordinates");
    });

    it("should reject proof when point C contains coordinates exceeding field size", async function () {
      const outOfBoundsProofC = [3001n, Q + 1n];
      const publicInputs = [sampleBatchHashBigInt, minTempScaled, maxTempScaled, 1n];

      await expect(
        verifier.verifyProof(validProofA, validProofB, outOfBoundsProofC, publicInputs)
      ).to.be.revertedWith("Invalid proof point C coordinates");
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
