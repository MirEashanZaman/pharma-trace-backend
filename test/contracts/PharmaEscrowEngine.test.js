const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaEscrowEngine Contract", function () {
  let escrowEngine;
  let owner;
  let buyer;
  let seller;
  let keeper;
  let unauthorized;

  const sampleOrderId = ethers.keccak256(ethers.toUtf8Bytes("ORDER-ESCROW-001"));
  const sampleOrderId2 = ethers.keccak256(ethers.toUtf8Bytes("ORDER-ESCROW-002"));
  const sampleSerial = "SN-AMOX-BATCH-881";
  const depositAmount = ethers.parseEther("5.0");
  const timeoutDuration = 86400;

  beforeEach(async function () {
    [owner, buyer, seller, keeper, unauthorized] = await ethers.getSigners();

    const PharmaEscrowEngine = await ethers.getContractFactory("PharmaEscrowEngine");
    escrowEngine = await PharmaEscrowEngine.deploy();
    await escrowEngine.waitForDeployment();
  });

  describe("Deployment & Initialization", function () {
    it("should set deployer as contract owner", async function () {
      expect(await escrowEngine.owner()).to.equal(owner.address);
    });

    it("should initialize with zero active orders", async function () {
      expect(await escrowEngine.getActiveOrdersCount()).to.equal(0n);
    });
  });

  describe("Escrow Order Creation", function () {
    it("should allow buyer to fund an escrow order", async function () {
      const tx = await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId,
        seller.address,
        sampleSerial,
        timeoutDuration,
        { value: depositAmount }
      );

      await expect(tx).to.emit(escrowEngine, "EscrowFunded").withArgs(
        sampleOrderId,
        buyer.address,
        seller.address,
        depositAmount,
        sampleSerial
      );

      const order = await escrowEngine.getEscrow(sampleOrderId);
      expect(order.buyer).to.equal(buyer.address);
      expect(order.seller).to.equal(seller.address);
      expect(order.amountWei).to.equal(depositAmount);
      expect(order.drugSerialNumber).to.equal(sampleSerial);
      expect(order.status).to.equal(1n);
      expect(order.coldChainCompliant).to.equal(false);
      expect(order.custodyAccepted).to.equal(false);

      expect(await escrowEngine.getActiveOrdersCount()).to.equal(1n);
      expect(await ethers.provider.getBalance(await escrowEngine.getAddress())).to.equal(depositAmount);
    });

    it("should reject escrow creation with zero ether value", async function () {
      await expect(
        escrowEngine.connect(buyer).createEscrow(
          sampleOrderId,
          seller.address,
          sampleSerial,
          timeoutDuration,
          { value: 0n }
        )
      ).to.be.revertedWith("Escrow deposit must be greater than zero");
    });

    it("should reject duplicate escrow creation for same order identifier", async function () {
      await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId,
        seller.address,
        sampleSerial,
        timeoutDuration,
        { value: depositAmount }
      );

      await expect(
        escrowEngine.connect(buyer).createEscrow(
          sampleOrderId,
          seller.address,
          sampleSerial,
          timeoutDuration,
          { value: depositAmount }
        )
      ).to.be.revertedWith("Escrow order already exists");
    });

    it("should reject escrow creation with invalid zero address seller", async function () {
      await expect(
        escrowEngine.connect(buyer).createEscrow(
          sampleOrderId,
          ethers.ZeroAddress,
          sampleSerial,
          timeoutDuration,
          { value: depositAmount }
        )
      ).to.be.revertedWith("Invalid seller address");
    });
  });

  describe("Handshake & Direct Release", function () {
    beforeEach(async function () {
      await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId,
        seller.address,
        sampleSerial,
        timeoutDuration,
        { value: depositAmount }
      );
    });

    it("should record partial compliance update without premature payout", async function () {
      const tx = await escrowEngine.connect(seller).recordComplianceAndHandshake(
        sampleOrderId,
        true,
        false
      );

      await expect(tx).to.emit(escrowEngine, "ComplianceUpdated").withArgs(sampleOrderId, true, false);

      const order = await escrowEngine.getEscrow(sampleOrderId);
      expect(order.coldChainCompliant).to.equal(true);
      expect(order.custodyAccepted).to.equal(false);
      expect(order.status).to.equal(1n);
      expect(await escrowEngine.getActiveOrdersCount()).to.equal(1n);
    });

    it("should release escrow funds to seller upon full compliance and custody acceptance", async function () {
      const initialSellerBalance = await ethers.provider.getBalance(seller.address);

      const tx = await escrowEngine.connect(buyer).recordComplianceAndHandshake(
        sampleOrderId,
        true,
        true
      );

      await expect(tx).to.emit(escrowEngine, "EscrowReleased").withArgs(sampleOrderId, seller.address, depositAmount);

      const order = await escrowEngine.getEscrow(sampleOrderId);
      expect(order.status).to.equal(2n);
      expect(order.amountWei).to.equal(0n);
      expect(await escrowEngine.getActiveOrdersCount()).to.equal(0n);

      const finalSellerBalance = await ethers.provider.getBalance(seller.address);
      expect(finalSellerBalance - initialSellerBalance).to.equal(depositAmount);
    });

    it("should reject compliance update from unauthorized parties", async function () {
      await expect(
        escrowEngine.connect(unauthorized).recordComplianceAndHandshake(
          sampleOrderId,
          true,
          true
        )
      ).to.be.revertedWith("Unauthorized to record compliance");
    });
  });

  describe("Cold-Chain Breach & Refund", function () {
    beforeEach(async function () {
      await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId,
        seller.address,
        sampleSerial,
        timeoutDuration,
        { value: depositAmount }
      );
    });

    it("should refund buyer upon temperature breach trigger", async function () {
      const initialBuyerBalance = await ethers.provider.getBalance(buyer.address);
      const breachReason = "Critical freeze excursion: core temp dropped to -4.0C";

      const tx = await escrowEngine.connect(buyer).triggerSpoilageRefund(
        sampleOrderId,
        breachReason
      );

      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      await expect(tx).to.emit(escrowEngine, "EscrowRefunded").withArgs(
        sampleOrderId,
        buyer.address,
        depositAmount,
        breachReason
      );

      const order = await escrowEngine.getEscrow(sampleOrderId);
      expect(order.status).to.equal(3n);
      expect(order.amountWei).to.equal(0n);
      expect(await escrowEngine.getActiveOrdersCount()).to.equal(0n);

      const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);
      expect(finalBuyerBalance - initialBuyerBalance + gasCost).to.equal(depositAmount);
    });

    it("should reject refund triggers from unauthorized accounts", async function () {
      await expect(
        escrowEngine.connect(unauthorized).triggerSpoilageRefund(sampleOrderId, "Unauthorized refund")
      ).to.be.revertedWith("Unauthorized to trigger refund");
    });
  });

  describe("Chainlink Automation Keepers Integration", function () {
    beforeEach(async function () {
      await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId,
        seller.address,
        sampleSerial,
        timeoutDuration,
        { value: depositAmount }
      );
    });

    it("should signal upkeep needed when conditions are fulfilled", async function () {
      await escrowEngine.connect(owner).recordComplianceAndHandshake(sampleOrderId, true, true);

      const [upkeepNeeded, performData] = await escrowEngine.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(false);
    });

    it("should trigger upkeep release when flagged for release", async function () {
      await escrowEngine.connect(owner).recordComplianceAndHandshake(sampleOrderId, true, false);

      const EscrowOrder = await escrowEngine.getEscrow(sampleOrderId);
      expect(EscrowOrder.status).to.equal(1n);

      const tx = await escrowEngine.connect(owner).recordComplianceAndHandshake(sampleOrderId, true, true);
      await expect(tx).to.emit(escrowEngine, "EscrowReleased");
    });

    it("should execute automated timeout refund via performUpkeep", async function () {
      await ethers.provider.send("evm_increaseTime", [timeoutDuration + 10]);
      await ethers.provider.send("evm_mine", []);

      const [upkeepNeeded, performData] = await escrowEngine.checkUpkeep("0x");
      expect(upkeepNeeded).to.equal(true);

      const initialBuyerBalance = await ethers.provider.getBalance(buyer.address);

      const tx = await escrowEngine.connect(keeper).performUpkeep(performData);
      await expect(tx).to.emit(escrowEngine, "EscrowRefunded");
      await expect(tx).to.emit(escrowEngine, "UpkeepPerformed").withArgs(sampleOrderId, 2, await ethers.provider.getBlock("latest").then(b => b.timestamp));

      const order = await escrowEngine.getEscrow(sampleOrderId);
      expect(order.status).to.equal(3n);

      const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);
      expect(finalBuyerBalance - initialBuyerBalance).to.equal(depositAmount);
    });
  });

  describe("O(1) Active Order Swap-and-Pop Management", function () {
    it("should properly manage active orders array when multiple orders are created and removed", async function () {
      await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId,
        seller.address,
        "SN-ITEM-01",
        timeoutDuration,
        { value: depositAmount }
      );

      await escrowEngine.connect(buyer).createEscrow(
        sampleOrderId2,
        seller.address,
        "SN-ITEM-02",
        timeoutDuration,
        { value: depositAmount }
      );

      expect(await escrowEngine.getActiveOrdersCount()).to.equal(2n);

      await escrowEngine.connect(buyer).recordComplianceAndHandshake(sampleOrderId, true, true);
      expect(await escrowEngine.getActiveOrdersCount()).to.equal(1n);

      const remainingOrderId = await escrowEngine.activeOrderIds(0);
      expect(remainingOrderId).to.equal(sampleOrderId2);

      await escrowEngine.connect(buyer).triggerSpoilageRefund(sampleOrderId2, "Breach on remaining item");
      expect(await escrowEngine.getActiveOrdersCount()).to.equal(0n);
    });
  });
});
