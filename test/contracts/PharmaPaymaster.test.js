const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaPaymaster Contract", function () {
  let paymaster;
  let deployer;
  let paymasterSigner;
  let user;
  let unauthorized;

  const sampleUserOpHash = ethers.keccak256(ethers.toUtf8Bytes("USER_OP_TEST_HASH_001"));
  const sampleUserOpHash2 = ethers.keccak256(ethers.toUtf8Bytes("USER_OP_TEST_HASH_002"));

  beforeEach(async function () {
    [deployer, paymasterSigner, user, unauthorized] = await ethers.getSigners();

    const PharmaPaymaster = await ethers.getContractFactory("PharmaPaymaster");
    paymaster = await PharmaPaymaster.deploy(paymasterSigner.address);
    await paymaster.waitForDeployment();
  });

  describe("Deployment & Configuration", function () {
    it("should set deployer as contract owner", async function () {
      expect(await paymaster.owner()).to.equal(deployer.address);
    });

    it("should set the initial corporate verifying signer", async function () {
      expect(await paymaster.verifyingSigner()).to.equal(paymasterSigner.address);
    });

    it("should allow owner to update verifying signer", async function () {
      const tx = await paymaster.connect(deployer).setVerifyingSigner(unauthorized.address);
      await expect(tx).to.emit(paymaster, "SignerUpdated").withArgs(paymasterSigner.address, unauthorized.address);
      expect(await paymaster.verifyingSigner()).to.equal(unauthorized.address);
    });

    it("should reject updating verifying signer from non-owner", async function () {
      await expect(
        paymaster.connect(unauthorized).setVerifyingSigner(unauthorized.address)
      ).to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount");
    });
  });

  describe("Funds Deposit & Withdrawal", function () {
    it("should accept native ether deposits to sponsor gas", async function () {
      const depositAmount = ethers.parseEther("2.0");
      const tx = await deployer.sendTransaction({
        to: await paymaster.getAddress(),
        value: depositAmount,
      });

      await expect(tx).to.emit(paymaster, "FundsDeposited").withArgs(deployer.address, depositAmount);
      expect(await ethers.provider.getBalance(await paymaster.getAddress())).to.equal(depositAmount);
    });

    it("should allow owner to withdraw funds", async function () {
      const depositAmount = ethers.parseEther("1.0");
      await deployer.sendTransaction({
        to: await paymaster.getAddress(),
        value: depositAmount,
      });

      const initialBalance = await ethers.provider.getBalance(deployer.address);
      const tx = await paymaster.connect(deployer).withdraw(deployer.address, depositAmount);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(deployer.address);
      expect(finalBalance - initialBalance + gasCost).to.equal(depositAmount);
    });

    it("should reject withdrawals from unauthorized accounts", async function () {
      await expect(
        paymaster.connect(unauthorized).withdraw(unauthorized.address, ethers.parseEther("1.0"))
      ).to.be.revertedWithCustomError(paymaster, "OwnableUnauthorizedAccount");
    });
  });

  describe("Gas Sponsorship Validation & Execution", function () {
    let validUntil;
    let validAfter;
    let signature;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      validAfter = block.timestamp - 10;
      validUntil = block.timestamp + 3600;

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint48", "uint48", "address", "bytes32"],
        [await paymaster.getAddress(), validUntil, validAfter, user.address, sampleUserOpHash]
      );

      signature = await paymasterSigner.signMessage(ethers.getBytes(messageHash));
    });

    it("should successfully validate genuine corporate paymaster signature", async function () {
      const isValid = await paymaster.validateSponsorship(
        user.address,
        sampleUserOpHash,
        validUntil,
        validAfter,
        signature
      );

      expect(isValid).to.equal(true);
    });

    it("should reject validation when signature originates from unauthorized signer", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint48", "uint48", "address", "bytes32"],
        [await paymaster.getAddress(), validUntil, validAfter, user.address, sampleUserOpHash]
      );
      const forgedSignature = await unauthorized.signMessage(ethers.getBytes(messageHash));

      const isValid = await paymaster.validateSponsorship(
        user.address,
        sampleUserOpHash,
        validUntil,
        validAfter,
        forgedSignature
      );

      expect(isValid).to.equal(false);
    });

    it("should reject validation when timestamp envelope is expired", async function () {
      const expiredUntil = validAfter - 50;

      const isValid = await paymaster.validateSponsorship(
        user.address,
        sampleUserOpHash,
        expiredUntil,
        validAfter - 100,
        signature
      );

      expect(isValid).to.equal(false);
    });

    it("should execute transaction sponsorship and emit GasSponsored event", async function () {
      const tx = await paymaster.connect(user).sponsorTransaction(
        user.address,
        sampleUserOpHash,
        validUntil,
        validAfter,
        signature
      );

      await expect(tx).to.emit(paymaster, "GasSponsored").withArgs(
        user.address,
        validUntil,
        validAfter,
        sampleUserOpHash
      );

      expect(await paymaster.executedUserOpHashes(sampleUserOpHash)).to.equal(true);
    });

    it("should prevent duplicate replay execution of the same UserOperation hash", async function () {
      await paymaster.connect(user).sponsorTransaction(
        user.address,
        sampleUserOpHash,
        validUntil,
        validAfter,
        signature
      );

      await expect(
        paymaster.connect(user).sponsorTransaction(
          user.address,
          sampleUserOpHash,
          validUntil,
          validAfter,
          signature
        )
      ).to.be.revertedWith("UserOperation hash already executed");
    });
  });
});
