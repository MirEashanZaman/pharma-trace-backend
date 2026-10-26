const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CarrierStakingEscrow Contract", function () {
  let stakingEscrow;
  let mockToken;
  let owner;
  let carrier;
  let manufacturer;
  let unauthorized;

  const initialCarrierBalance = ethers.parseEther("100000");
  const sampleStakeAmount = ethers.parseEther("25000");
  const sampleBondAmount = ethers.parseEther("10000");
  const sampleShipmentId = ethers.keccak256(ethers.toUtf8Bytes("SHIPMENT-STAKE-001"));
  const sampleConsensusHash = ethers.keccak256(ethers.toUtf8Bytes("CONSENSUS-REPORT-HASH-001"));

  beforeEach(async function () {
    [owner, carrier, manufacturer, unauthorized] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock USDC", "USDC");
    await mockToken.waitForDeployment();

    const CarrierStakingEscrow = await ethers.getContractFactory("CarrierStakingEscrow");
    stakingEscrow = await CarrierStakingEscrow.deploy(await mockToken.getAddress());
    await stakingEscrow.waitForDeployment();

    await mockToken.mint(carrier.address, initialCarrierBalance);
    await mockToken.connect(carrier).approve(await stakingEscrow.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment & Configuration", function () {
    it("should set deployer as contract owner", async function () {
      expect(await stakingEscrow.owner()).to.equal(owner.address);
    });

    it("should correctly store staking token address", async function () {
      expect(await stakingEscrow.stakingToken()).to.equal(await mockToken.getAddress());
    });
  });

  describe("Collateral Staking", function () {
    it("should allow carrier to stake collateral tokens", async function () {
      const tx = await stakingEscrow.connect(carrier).stakeCollateral(sampleStakeAmount);

      await expect(tx).to.emit(stakingEscrow, "CarrierStaked").withArgs(carrier.address, sampleStakeAmount, sampleStakeAmount);

      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.totalStaked).to.equal(sampleStakeAmount);
      expect(account.lockedCollateral).to.equal(0n);
      expect(account.isAccredited).to.equal(true);

      expect(await mockToken.balanceOf(await stakingEscrow.getAddress())).to.equal(sampleStakeAmount);
    });

    it("should reject staking zero tokens", async function () {
      await expect(
        stakingEscrow.connect(carrier).stakeCollateral(0n)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should reject staking when allowance is insufficient", async function () {
      await mockToken.connect(carrier).approve(await stakingEscrow.getAddress(), 0n);

      await expect(
        stakingEscrow.connect(carrier).stakeCollateral(sampleStakeAmount)
      ).to.be.reverted;
    });
  });

  describe("Collateral Unstaking", function () {
    beforeEach(async function () {
      await stakingEscrow.connect(carrier).stakeCollateral(sampleStakeAmount);
    });

    it("should allow carrier to unstake unlocked collateral", async function () {
      const unstakeAmount = ethers.parseEther("5000");
      const tx = await stakingEscrow.connect(carrier).unstakeCollateral(unstakeAmount);

      await expect(tx).to.emit(stakingEscrow, "CarrierUnstaked").withArgs(carrier.address, unstakeAmount, sampleStakeAmount - unstakeAmount);

      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.totalStaked).to.equal(sampleStakeAmount - unstakeAmount);
      expect(account.isAccredited).to.equal(true);
    });

    it("should revoke accreditation if total stake drops to zero", async function () {
      await stakingEscrow.connect(carrier).unstakeCollateral(sampleStakeAmount);

      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.totalStaked).to.equal(0n);
      expect(account.isAccredited).to.equal(false);
    });

    it("should reject unstaking more than unlocked collateral", async function () {
      await stakingEscrow.connect(owner).lockShipmentBond(
        sampleShipmentId,
        carrier.address,
        manufacturer.address,
        sampleBondAmount
      );

      const excessiveUnstake = ethers.parseEther("20000");
      await expect(
        stakingEscrow.connect(carrier).unstakeCollateral(excessiveUnstake)
      ).to.be.revertedWith("Insufficient unlocked collateral");
    });
  });

  describe("Shipment Bond Locking", function () {
    beforeEach(async function () {
      await stakingEscrow.connect(carrier).stakeCollateral(sampleStakeAmount);
    });

    it("should allow owner to lock shipment bond for accredited carrier", async function () {
      const tx = await stakingEscrow.connect(owner).lockShipmentBond(
        sampleShipmentId,
        carrier.address,
        manufacturer.address,
        sampleBondAmount
      );

      await expect(tx).to.emit(stakingEscrow, "BondLocked").withArgs(
        sampleShipmentId,
        carrier.address,
        manufacturer.address,
        sampleBondAmount
      );

      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.lockedCollateral).to.equal(sampleBondAmount);

      const bond = await stakingEscrow.getShipmentBond(sampleShipmentId);
      expect(bond.carrier).to.equal(carrier.address);
      expect(bond.manufacturer).to.equal(manufacturer.address);
      expect(bond.bondAmount).to.equal(sampleBondAmount);
      expect(bond.status).to.equal(1n);
    });

    it("should reject locking shipment bond from unauthorized caller", async function () {
      await expect(
        stakingEscrow.connect(unauthorized).lockShipmentBond(
          sampleShipmentId,
          carrier.address,
          manufacturer.address,
          sampleBondAmount
        )
      ).to.be.revertedWith("Only owner authorized");
    });

    it("should reject locking bond for unaccredited carrier", async function () {
      await expect(
        stakingEscrow.connect(owner).lockShipmentBond(
          sampleShipmentId,
          unauthorized.address,
          manufacturer.address,
          sampleBondAmount
        )
      ).to.be.revertedWith("Carrier not accredited");
    });

    it("should reject locking bond exceeding available carrier collateral", async function () {
      const excessiveBond = ethers.parseEther("30000");
      await expect(
        stakingEscrow.connect(owner).lockShipmentBond(
          sampleShipmentId,
          carrier.address,
          manufacturer.address,
          excessiveBond
        )
      ).to.be.revertedWith("Insufficient available collateral");
    });

    it("should reject duplicate bond creation for same shipment identifier", async function () {
      await stakingEscrow.connect(owner).lockShipmentBond(
        sampleShipmentId,
        carrier.address,
        manufacturer.address,
        sampleBondAmount
      );

      await expect(
        stakingEscrow.connect(owner).lockShipmentBond(
          sampleShipmentId,
          carrier.address,
          manufacturer.address,
          sampleBondAmount
        )
      ).to.be.revertedWith("Bond already exists for shipment");
    });
  });

  describe("Shipment Bond Resolution & Slashing", function () {
    beforeEach(async function () {
      await stakingEscrow.connect(carrier).stakeCollateral(sampleStakeAmount);
      await stakingEscrow.connect(owner).lockShipmentBond(
        sampleShipmentId,
        carrier.address,
        manufacturer.address,
        sampleBondAmount
      );
    });

    it("should allow owner to release bond upon compliant delivery", async function () {
      const tx = await stakingEscrow.connect(owner).releaseShipmentBond(sampleShipmentId);

      await expect(tx).to.emit(stakingEscrow, "BondReleased").withArgs(
        sampleShipmentId,
        carrier.address,
        sampleBondAmount
      );

      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.lockedCollateral).to.equal(0n);
      expect(account.totalStaked).to.equal(sampleStakeAmount);

      const bond = await stakingEscrow.getShipmentBond(sampleShipmentId);
      expect(bond.status).to.equal(2n);
    });

    it("should reject releasing already released bond", async function () {
      await stakingEscrow.connect(owner).releaseShipmentBond(sampleShipmentId);

      await expect(
        stakingEscrow.connect(owner).releaseShipmentBond(sampleShipmentId)
      ).to.be.revertedWith("Bond is not locked");
    });

    it("should slash bond and indemnify manufacturer on cold-chain excursion breach", async function () {
      const initialManufacturerBalance = await mockToken.balanceOf(manufacturer.address);
      const excursionReason = "Temperature exceeded 8.0C threshold for 45 minutes";

      const tx = await stakingEscrow.connect(owner).slashShipmentBond(
        sampleShipmentId,
        100n,
        excursionReason,
        sampleConsensusHash
      );

      await expect(tx).to.emit(stakingEscrow, "BondSlashed").withArgs(
        sampleShipmentId,
        carrier.address,
        manufacturer.address,
        sampleBondAmount,
        excursionReason,
        sampleConsensusHash
      );

      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.lockedCollateral).to.equal(0n);
      expect(account.totalStaked).to.equal(sampleStakeAmount - sampleBondAmount);
      expect(account.totalSlashed).to.equal(sampleBondAmount);
      expect(account.totalIndemnified).to.equal(sampleBondAmount);

      const bond = await stakingEscrow.getShipmentBond(sampleShipmentId);
      expect(bond.status).to.equal(3n);
      expect(bond.resolutionReason).to.equal(excursionReason);

      const finalManufacturerBalance = await mockToken.balanceOf(manufacturer.address);
      expect(finalManufacturerBalance - initialManufacturerBalance).to.equal(sampleBondAmount);
    });

    it("should allow partial slashing with proportional indemnity payout", async function () {
      const initialManufacturerBalance = await mockToken.balanceOf(manufacturer.address);
      const excursionReason = "Minor temperature excursion within buffer";

      await stakingEscrow.connect(owner).slashShipmentBond(
        sampleShipmentId,
        50n,
        excursionReason,
        sampleConsensusHash
      );

      const expectedSlashed = sampleBondAmount / 2n;
      const account = await stakingEscrow.getCarrierAccount(carrier.address);
      expect(account.lockedCollateral).to.equal(0n);
      expect(account.totalStaked).to.equal(sampleStakeAmount - expectedSlashed);
      expect(account.totalSlashed).to.equal(expectedSlashed);

      const finalManufacturerBalance = await mockToken.balanceOf(manufacturer.address);
      expect(finalManufacturerBalance - initialManufacturerBalance).to.equal(expectedSlashed);
    });

    it("should reject slashing with invalid percentage bounds", async function () {
      await expect(
        stakingEscrow.connect(owner).slashShipmentBond(sampleShipmentId, 0n, "Zero slash", sampleConsensusHash)
      ).to.be.revertedWith("Invalid slash percentage");

      await expect(
        stakingEscrow.connect(owner).slashShipmentBond(sampleShipmentId, 101n, "Over 100", sampleConsensusHash)
      ).to.be.revertedWith("Invalid slash percentage");
    });
  });
});
