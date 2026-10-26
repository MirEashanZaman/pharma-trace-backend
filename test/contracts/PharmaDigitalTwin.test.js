const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaDigitalTwin Contract", function () {
  let digitalTwin;
  let owner;
  let manufacturer;
  let distributor;
  let dispenser;
  let unauthorized;

  const sampleGtin = "00300010000012";
  const sampleBatch = "BATCH-2026-X1";
  const sampleSerial = "SN-TEST-88001";
  const sampleCid = "QmZtmD2qt8fJpq3rBsEQZRiZyiN4a4Q44VkJ5Emjt2vwpP";

  beforeEach(async function () {
    [owner, manufacturer, distributor, dispenser, unauthorized] = await ethers.getSigners();

    const PharmaDigitalTwin = await ethers.getContractFactory("PharmaDigitalTwin");
    digitalTwin = await PharmaDigitalTwin.deploy();
    await digitalTwin.waitForDeployment();

    const manufacturerRole = await digitalTwin.MANUFACTURER_ROLE();
    const dispenserRole = await digitalTwin.DISPENSER_ROLE();

    await digitalTwin.grantRole(manufacturerRole, manufacturer.address);
    await digitalTwin.grantRole(dispenserRole, dispenser.address);
  });

  describe("Deployment & Role Initialization", function () {
    it("should set deployer as contract owner", async function () {
      expect(await digitalTwin.owner()).to.equal(owner.address);
    });

    it("should assign correct token collection name and symbol", async function () {
      expect(await digitalTwin.name()).to.equal("PharmaTrace Digital Twin");
      expect(await digitalTwin.symbol()).to.equal("PTDT");
    });

    it("should grant initial roles to contract owner", async function () {
      const manufacturerRole = await digitalTwin.MANUFACTURER_ROLE();
      const dispenserRole = await digitalTwin.DISPENSER_ROLE();

      expect(await digitalTwin.roles(manufacturerRole, owner.address)).to.equal(true);
      expect(await digitalTwin.roles(dispenserRole, owner.address)).to.equal(true);
    });

    it("should reject role grants from non-owners", async function () {
      const manufacturerRole = await digitalTwin.MANUFACTURER_ROLE();
      await expect(
        digitalTwin.connect(unauthorized).grantRole(manufacturerRole, unauthorized.address)
      ).to.be.revertedWith("Only owner authorized");
    });
  });

  describe("Digital Twin Minting", function () {
    it("should allow an authorized manufacturer to mint a digital twin", async function () {
      const expirationDate = Math.floor(Date.now() / 1000) + 86400 * 365;

      const tx = await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        expirationDate,
        sampleCid
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const tokenId = await digitalTwin.serialToTokenId(sampleSerial);
      expect(tokenId).to.not.equal(0n);

      const balance = await digitalTwin.balances(tokenId, manufacturer.address);
      expect(balance).to.equal(1n);

      const metadata = await digitalTwin.itemDetails(tokenId);
      expect(metadata.gtin).to.equal(sampleGtin);
      expect(metadata.batchNumber).to.equal(sampleBatch);
      expect(metadata.serialNumber).to.equal(sampleSerial);
      expect(metadata.currentHolder).to.equal(manufacturer.address);
      expect(metadata.status).to.equal(0n);
    });

    it("should emit ItemMinted event on minting", async function () {
      const expirationDate = Math.floor(Date.now() / 1000) + 86400 * 365;

      await expect(
        digitalTwin.connect(manufacturer).mintTwin(
          manufacturer.address,
          sampleGtin,
          sampleBatch,
          sampleSerial,
          expirationDate,
          sampleCid
        )
      ).to.emit(digitalTwin, "ItemMinted");
    });

    it("should reject minting from unauthorized accounts", async function () {
      const expirationDate = Math.floor(Date.now() / 1000) + 86400 * 365;

      await expect(
        digitalTwin.connect(unauthorized).mintTwin(
          unauthorized.address,
          sampleGtin,
          sampleBatch,
          sampleSerial,
          expirationDate,
          sampleCid
        )
      ).to.be.revertedWith("Unauthorized to mint digital twin");
    });

    it("should reject duplicate minting for identical serial numbers", async function () {
      const expirationDate = Math.floor(Date.now() / 1000) + 86400 * 365;

      await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        expirationDate,
        sampleCid
      );

      await expect(
        digitalTwin.connect(manufacturer).mintTwin(
          manufacturer.address,
          sampleGtin,
          sampleBatch,
          sampleSerial,
          expirationDate,
          sampleCid
        )
      ).to.be.revertedWith("Serial twin already exists");
    });
  });

  describe("Custody Transfers", function () {
    let tokenId;

    beforeEach(async function () {
      const expirationDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        expirationDate,
        sampleCid
      );
      tokenId = await digitalTwin.serialToTokenId(sampleSerial);
    });

    it("should allow current holder to transfer custody", async function () {
      const tx = await digitalTwin.connect(manufacturer).transferCustody(
        manufacturer.address,
        distributor.address,
        tokenId
      );

      await expect(tx).to.emit(digitalTwin, "CustodyTransferred").withArgs(tokenId, manufacturer.address, distributor.address, 1n);

      expect(await digitalTwin.balances(tokenId, manufacturer.address)).to.equal(0n);
      expect(await digitalTwin.balances(tokenId, distributor.address)).to.equal(1n);

      const metadata = await digitalTwin.itemDetails(tokenId);
      expect(metadata.currentHolder).to.equal(distributor.address);
      expect(metadata.status).to.equal(1n);
    });

    it("should allow contract owner to mediate custody transfer", async function () {
      await digitalTwin.connect(owner).transferCustody(
        manufacturer.address,
        distributor.address,
        tokenId
      );

      expect(await digitalTwin.balances(tokenId, distributor.address)).to.equal(1n);
    });

    it("should reject custody transfer by unauthorized non-holder", async function () {
      await expect(
        digitalTwin.connect(unauthorized).transferCustody(
          manufacturer.address,
          distributor.address,
          tokenId
        )
      ).to.be.revertedWith("Caller not authorized to transfer");
    });

    it("should reject custody transfer if from address lacks balance", async function () {
      await expect(
        digitalTwin.connect(owner).transferCustody(
          distributor.address,
          dispenser.address,
          tokenId
        )
      ).to.be.revertedWith("Insufficient balance to transfer");
    });
  });

  describe("Dispense & Burn Lifecycle", function () {
    let tokenId;

    beforeEach(async function () {
      const expirationDate = Math.floor(Date.now() / 1000) + 86400 * 365;
      await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        expirationDate,
        sampleCid
      );
      tokenId = await digitalTwin.serialToTokenId(sampleSerial);

      await digitalTwin.connect(manufacturer).transferCustody(
        manufacturer.address,
        dispenser.address,
        tokenId
      );
    });

    it("should allow authorized dispenser to burn digital twin on dispense", async function () {
      const tx = await digitalTwin.connect(dispenser).burnOnDispense(sampleSerial, dispenser.address);

      await expect(tx).to.emit(digitalTwin, "ItemBurnedOnDispense");

      expect(await digitalTwin.balances(tokenId, dispenser.address)).to.equal(0n);

      const metadata = await digitalTwin.itemDetails(tokenId);
      expect(metadata.status).to.equal(4n);
      expect(metadata.currentHolder).to.equal(ethers.ZeroAddress);
    });

    it("should reject burn attempts from unauthorized non-dispensers", async function () {
      await expect(
        digitalTwin.connect(unauthorized).burnOnDispense(sampleSerial, dispenser.address)
      ).to.be.revertedWith("Caller not authorized to dispense");
    });

    it("should prevent duplicate burn on already burned digital twin", async function () {
      await digitalTwin.connect(dispenser).burnOnDispense(sampleSerial, dispenser.address);

      await expect(
        digitalTwin.connect(dispenser).burnOnDispense(sampleSerial, dispenser.address)
      ).to.be.revertedWith("Dispenser does not hold item");
    });

    it("should prevent custody transfer after burning", async function () {
      await digitalTwin.connect(dispenser).burnOnDispense(sampleSerial, dispenser.address);

      await expect(
        digitalTwin.connect(owner).transferCustody(
          dispenser.address,
          distributor.address,
          tokenId
        )
      ).to.be.revertedWith("Insufficient balance to transfer");
    });
  });

  describe("Authenticity Verification", function () {
    it("should return false existence for non-registered serial", async function () {
      const result = await digitalTwin.verifyAuthenticity("NON-EXISTENT-SERIAL");
      expect(result.exists).to.equal(false);
      expect(result.isAuthentic).to.equal(false);
      expect(result.isBurned).to.equal(false);
    });

    it("should verify valid authentic digital twin before expiration", async function () {
      const futureExpiration = Math.floor(Date.now() / 1000) + 86400 * 180;
      await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        futureExpiration,
        sampleCid
      );

      const result = await digitalTwin.verifyAuthenticity(sampleSerial);
      expect(result.exists).to.equal(true);
      expect(result.isAuthentic).to.equal(true);
      expect(result.isBurned).to.equal(false);
      expect(result.holder).to.equal(manufacturer.address);
    });

    it("should return isAuthentic=false and isBurned=true after dispense", async function () {
      const futureExpiration = Math.floor(Date.now() / 1000) + 86400 * 180;
      await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        futureExpiration,
        sampleCid
      );
      const tokenId = await digitalTwin.serialToTokenId(sampleSerial);

      await digitalTwin.connect(manufacturer).transferCustody(
        manufacturer.address,
        dispenser.address,
        tokenId
      );

      await digitalTwin.connect(dispenser).burnOnDispense(sampleSerial, dispenser.address);

      const result = await digitalTwin.verifyAuthenticity(sampleSerial);
      expect(result.exists).to.equal(true);
      expect(result.isAuthentic).to.equal(false);
      expect(result.isBurned).to.equal(true);
    });

    it("should mark expired digital twins as unauthentic", async function () {
      const pastExpiration = Math.floor(Date.now() / 1000) - 3600;
      await digitalTwin.connect(manufacturer).mintTwin(
        manufacturer.address,
        sampleGtin,
        sampleBatch,
        sampleSerial,
        pastExpiration,
        sampleCid
      );

      const result = await digitalTwin.verifyAuthenticity(sampleSerial);
      expect(result.exists).to.equal(true);
      expect(result.isAuthentic).to.equal(false);
      expect(result.isBurned).to.equal(false);
    });
  });
});
