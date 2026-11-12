const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaTraceAttestation UUPS Upgradeable Proxy", function () {
  let attestation;
  let owner;
  let regulator;
  let manufacturer;
  let unauthorized;

  beforeEach(async function () {
    [owner, regulator, manufacturer, unauthorized] = await ethers.getSigners();

    const PharmaTraceAttestation = await ethers.getContractFactory("PharmaTraceAttestation");
    const impl = await PharmaTraceAttestation.deploy();
    await impl.waitForDeployment();

    const PharmaUUPSProxy = await ethers.getContractFactory("PharmaUUPSProxy");
    const initData = PharmaTraceAttestation.interface.encodeFunctionData("initialize", [owner.address]);
    const proxy = await PharmaUUPSProxy.deploy(await impl.getAddress(), initData);
    await proxy.waitForDeployment();

    attestation = PharmaTraceAttestation.attach(await proxy.getAddress());

    const regulatorRole = await attestation.REGULATOR_ROLE();
    const manufacturerRole = await attestation.MANUFACTURER_ROLE();
    await attestation.grantRole(regulatorRole, regulator.address);
    await attestation.grantRole(manufacturerRole, manufacturer.address);
  });

  describe("Initialization & Access Control", function () {
    it("should set deployer as contract owner", async function () {
      expect(await attestation.owner()).to.equal(owner.address);
    });

    it("should grant default roles to initial owner", async function () {
      const regulatorRole = await attestation.REGULATOR_ROLE();
      expect(await attestation.hasRole(regulatorRole, owner.address)).to.equal(true);
    });

    it("should reject re-initialization calls", async function () {
      await expect(
        attestation.initialize(unauthorized.address)
      ).to.be.revertedWithCustomError(attestation, "InvalidInitialization");
    });
  });

  describe("Attestation Registration through Proxy", function () {
    it("should register attestation hash correctly", async function () {
      const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("SAMPLE_EVENT_PAYLOAD"));
      const serial = "SN-2026-VAX-01";

      const tx = await attestation.connect(manufacturer).registerAttestation(
        sampleHash,
        serial,
        "PRODUCTION_BATCH_RELEASED",
        "ipfs://bafybeiatest"
      );
      await tx.wait();

      const result = await attestation.verifyAttestation(sampleHash);
      expect(result.exists).to.equal(true);
      expect(result.isValid).to.equal(true);
      expect(result.drugSerialNumber).to.equal(serial);
      expect(result.signer).to.equal(manufacturer.address);
    });
  });

  describe("UUPS Upgradeability", function () {
    it("should allow owner to upgrade implementation", async function () {
      const PharmaTraceAttestationV2 = await ethers.getContractFactory("PharmaTraceAttestation");
      const newImpl = await PharmaTraceAttestationV2.deploy();
      await newImpl.waitForDeployment();

      await expect(
        attestation.upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.not.be.reverted;
    });

    it("should reject upgrade from non-owner", async function () {
      const PharmaTraceAttestationV2 = await ethers.getContractFactory("PharmaTraceAttestation");
      const newImpl = await PharmaTraceAttestationV2.deploy();
      await newImpl.waitForDeployment();

      await expect(
        attestation.connect(unauthorized).upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.be.revertedWithCustomError(attestation, "OnlyOwnerAuthorized");
    });
  });
});

