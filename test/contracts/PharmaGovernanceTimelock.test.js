const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaGovernanceTimelock Contract", function () {
  let timelock;
  let mockToken;
  let guardianA;
  let guardianB;
  let guardianC;
  let nonGuardian;

  const minDelay = 172800;
  const requiredThreshold = 2;
  const sampleDescription = "Urgent Regulatory Drug Recall Directive 2026-X";

  beforeEach(async function () {
    [guardianA, guardianB, guardianC, nonGuardian] = await ethers.getSigners();

    const guardians = [guardianA.address, guardianB.address, guardianC.address];

    const PharmaGovernanceTimelock = await ethers.getContractFactory("PharmaGovernanceTimelock");
    timelock = await PharmaGovernanceTimelock.deploy(guardians, requiredThreshold, minDelay);
    await timelock.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Gov Token", "GOV");
    await mockToken.waitForDeployment();
  });

  describe("Constructor & Initialization", function () {
    it("should correctly store guardian addresses and required threshold", async function () {
      expect(await timelock.requiredThreshold()).to.equal(2n);
      expect(await timelock.minDelay()).to.equal(172800n);
      expect(await timelock.getGuardianCount()).to.equal(3n);

      expect(await timelock.isGuardian(guardianA.address)).to.equal(true);
      expect(await timelock.isGuardian(guardianB.address)).to.equal(true);
      expect(await timelock.isGuardian(guardianC.address)).to.equal(true);
      expect(await timelock.isGuardian(nonGuardian.address)).to.equal(false);
    });

    it("should reject deployment with zero guardians", async function () {
      const PharmaGovernanceTimelock = await ethers.getContractFactory("PharmaGovernanceTimelock");
      await expect(
        PharmaGovernanceTimelock.deploy([], 1, minDelay)
      ).to.be.revertedWith("Guardians required");
    });

    it("should reject deployment with invalid threshold", async function () {
      const PharmaGovernanceTimelock = await ethers.getContractFactory("PharmaGovernanceTimelock");
      await expect(
        PharmaGovernanceTimelock.deploy([guardianA.address], 0, minDelay)
      ).to.be.revertedWith("Invalid confirmation threshold");

      await expect(
        PharmaGovernanceTimelock.deploy([guardianA.address], 2, minDelay)
      ).to.be.revertedWith("Invalid confirmation threshold");
    });

    it("should reject deployment with duplicate guardians", async function () {
      const PharmaGovernanceTimelock = await ethers.getContractFactory("PharmaGovernanceTimelock");
      await expect(
        PharmaGovernanceTimelock.deploy([guardianA.address, guardianA.address], 1, minDelay)
      ).to.be.revertedWith("Duplicate guardian");
    });
  });

  describe("Proposal Creation", function () {
    let callData;

    beforeEach(async function () {
      callData = mockToken.interface.encodeFunctionData("mint", [guardianA.address, ethers.parseEther("100")]);
    });

    it("should allow an authorized guardian to create a queued proposal", async function () {
      const tx = await timelock.connect(guardianA).propose(
        await mockToken.getAddress(),
        0n,
        callData,
        sampleDescription
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const filter = timelock.filters.ProposalCreated();
      const events = await timelock.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
      expect(events.length).to.equal(1);

      const proposalId = events[0].args.proposalId;
      const proposal = await timelock.getProposal(proposalId);

      expect(proposal.proposer).to.equal(guardianA.address);
      expect(proposal.target).to.equal(await mockToken.getAddress());
      expect(proposal.value).to.equal(0n);
      expect(proposal.description).to.equal(sampleDescription);
      expect(proposal.confirmations).to.equal(1n);
      expect(proposal.status).to.equal(1n);

      expect(await timelock.isConfirmedBy(proposalId, guardianA.address)).to.equal(true);
      expect(await timelock.isConfirmedBy(proposalId, guardianB.address)).to.equal(false);
    });

    it("should reject proposals created by non-guardians", async function () {
      await expect(
        timelock.connect(nonGuardian).propose(
          await mockToken.getAddress(),
          0n,
          callData,
          sampleDescription
        )
      ).to.be.revertedWith("Caller is not an authorized regulatory guardian");
    });

    it("should reject proposals targeting zero address", async function () {
      await expect(
        timelock.connect(guardianA).propose(
          ethers.ZeroAddress,
          0n,
          callData,
          sampleDescription
        )
      ).to.be.revertedWith("Target cannot be zero address");
    });
  });

  describe("Proposal Confirmations", function () {
    let proposalId;

    beforeEach(async function () {
      const callData = mockToken.interface.encodeFunctionData("mint", [guardianA.address, ethers.parseEther("100")]);
      const tx = await timelock.connect(guardianA).propose(
        await mockToken.getAddress(),
        0n,
        callData,
        sampleDescription
      );
      const receipt = await tx.wait();
      const events = await timelock.queryFilter(timelock.filters.ProposalCreated(), receipt.blockNumber, receipt.blockNumber);
      proposalId = events[0].args.proposalId;
    });

    it("should allow a second guardian to confirm the proposal", async function () {
      const tx = await timelock.connect(guardianB).confirmProposal(proposalId);

      await expect(tx).to.emit(timelock, "ProposalConfirmed").withArgs(proposalId, guardianB.address, 2n);

      const proposal = await timelock.getProposal(proposalId);
      expect(proposal.confirmations).to.equal(2n);
      expect(await timelock.isConfirmedBy(proposalId, guardianB.address)).to.equal(true);
    });

    it("should reject duplicate confirmation by the same guardian", async function () {
      await expect(
        timelock.connect(guardianA).confirmProposal(proposalId)
      ).to.be.revertedWith("Guardian already confirmed proposal");
    });

    it("should reject confirmations from non-guardians", async function () {
      await expect(
        timelock.connect(nonGuardian).confirmProposal(proposalId)
      ).to.be.revertedWith("Caller is not an authorized regulatory guardian");
    });
  });

  describe("Proposal Execution & Timelock Delay Enforcement", function () {
    let proposalId;
    let callData;
    const mintAmount = ethers.parseEther("500");

    beforeEach(async function () {
      callData = mockToken.interface.encodeFunctionData("mint", [guardianB.address, mintAmount]);
      const tx = await timelock.connect(guardianA).propose(
        await mockToken.getAddress(),
        0n,
        callData,
        sampleDescription
      );
      const receipt = await tx.wait();
      const events = await timelock.queryFilter(timelock.filters.ProposalCreated(), receipt.blockNumber, receipt.blockNumber);
      proposalId = events[0].args.proposalId;

      await timelock.connect(guardianB).confirmProposal(proposalId);
    });

    it("should reject execution before timelock delay has elapsed", async function () {
      await expect(
        timelock.connect(guardianA).executeProposal(proposalId)
      ).to.be.revertedWith("Timelock delay has not elapsed");
    });

    it("should reject execution if confirmation threshold is not met", async function () {
      const singleTx = await timelock.connect(guardianA).propose(
        await mockToken.getAddress(),
        0n,
        callData,
        "Single confirmation proposal"
      );
      const singleReceipt = await singleTx.wait();
      const singleEvents = await timelock.queryFilter(timelock.filters.ProposalCreated(), singleReceipt.blockNumber, singleReceipt.blockNumber);
      const singleProposalId = singleEvents[0].args.proposalId;

      await ethers.provider.send("evm_increaseTime", [minDelay + 10]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        timelock.connect(guardianA).executeProposal(singleProposalId)
      ).to.be.revertedWith("Insufficient guardian threshold confirmations");
    });

    it("should execute proposal successfully after timelock delay elapses", async function () {
      await ethers.provider.send("evm_increaseTime", [minDelay + 10]);
      await ethers.provider.send("evm_mine", []);

      const initialTokenBalance = await mockToken.balanceOf(guardianB.address);

      const tx = await timelock.connect(guardianA).executeProposal(proposalId);
      await expect(tx).to.emit(timelock, "ProposalExecuted");

      const proposal = await timelock.getProposal(proposalId);
      expect(proposal.status).to.equal(2n);

      const finalTokenBalance = await mockToken.balanceOf(guardianB.address);
      expect(finalTokenBalance - initialTokenBalance).to.equal(mintAmount);
    });

    it("should reject execution if grace period has expired", async function () {
      const gracePeriod = 14 * 86400;
      await ethers.provider.send("evm_increaseTime", [minDelay + gracePeriod + 100]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        timelock.connect(guardianA).executeProposal(proposalId)
      ).to.be.revertedWith("Proposal expired past grace period");
    });
  });

  describe("Proposal Cancellation", function () {
    let proposalId;

    beforeEach(async function () {
      const callData = mockToken.interface.encodeFunctionData("mint", [guardianA.address, ethers.parseEther("100")]);
      const tx = await timelock.connect(guardianA).propose(
        await mockToken.getAddress(),
        0n,
        callData,
        sampleDescription
      );
      const receipt = await tx.wait();
      const events = await timelock.queryFilter(timelock.filters.ProposalCreated(), receipt.blockNumber, receipt.blockNumber);
      proposalId = events[0].args.proposalId;
    });

    it("should allow an authorized guardian to cancel a queued proposal", async function () {
      const cancellationReason = "Audit detected erroneous recipient parameter";
      const tx = await timelock.connect(guardianC).cancelProposal(proposalId, cancellationReason);

      await expect(tx).to.emit(timelock, "ProposalCancelled").withArgs(proposalId, guardianC.address, cancellationReason);

      const proposal = await timelock.getProposal(proposalId);
      expect(proposal.status).to.equal(3n);
    });

    it("should reject execution of a cancelled proposal", async function () {
      await timelock.connect(guardianB).confirmProposal(proposalId);
      await timelock.connect(guardianC).cancelProposal(proposalId, "Emergency halt");

      await ethers.provider.send("evm_increaseTime", [minDelay + 10]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        timelock.connect(guardianA).executeProposal(proposalId)
      ).to.be.revertedWith("Proposal not queued");
    });
  });
});
