// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PharmaGovernanceTimelock {
    enum ProposalStatus { PENDING, QUEUED, EXECUTED, CANCELLED, EXPIRED }

    struct Proposal {
        bytes32 id;
        address proposer;
        address target;
        uint256 value;
        bytes data;
        string description;
        uint256 eta;
        uint256 confirmations;
        ProposalStatus status;
    }

    uint256 public constant GRACE_PERIOD = 14 days;
    uint256 public minDelay;
    uint256 public requiredThreshold;

    address[] public guardians;
    mapping(address => bool) public isGuardian;
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => mapping(address => bool)) public confirmations;

    event ProposalCreated(
        bytes32 indexed proposalId,
        address indexed proposer,
        address indexed target,
        uint256 value,
        string description,
        uint256 eta
    );
    event ProposalConfirmed(
        bytes32 indexed proposalId,
        address indexed guardian,
        uint256 currentConfirmations
    );
    event ProposalExecuted(
        bytes32 indexed proposalId,
        address indexed executor,
        bytes returnData
    );
    event ProposalCancelled(
        bytes32 indexed proposalId,
        address indexed guardian,
        string reason
    );

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Caller is not an authorized regulatory guardian");
        _;
    }

    constructor(
        address[] memory _guardians,
        uint256 _requiredThreshold,
        uint256 _minDelay
    ) {
        require(_guardians.length > 0, "Guardians required");
        require(
            _requiredThreshold > 0 && _requiredThreshold <= _guardians.length,
            "Invalid confirmation threshold"
        );

        for (uint256 i = 0; i < _guardians.length; i++) {
            address guardian = _guardians[i];
            require(guardian != address(0), "Invalid guardian address");
            require(!isGuardian[guardian], "Duplicate guardian");
            isGuardian[guardian] = true;
            guardians.push(guardian);
        }

        requiredThreshold = _requiredThreshold;
        minDelay = _minDelay;
    }

    function propose(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external onlyGuardian returns (bytes32) {
        require(target != address(0), "Target cannot be zero address");

        bytes32 proposalId = keccak256(
            abi.encode(target, value, data, description, block.timestamp, msg.sender)
        );
        require(proposals[proposalId].eta == 0, "Proposal ID collision");

        uint256 eta = block.timestamp + minDelay;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            target: target,
            value: value,
            data: data,
            description: description,
            eta: eta,
            confirmations: 1,
            status: ProposalStatus.QUEUED
        });

        confirmations[proposalId][msg.sender] = true;

        emit ProposalCreated(proposalId, msg.sender, target, value, description, eta);
        emit ProposalConfirmed(proposalId, msg.sender, 1);

        return proposalId;
    }

    function confirmProposal(bytes32 proposalId) external onlyGuardian {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.eta > 0, "Proposal does not exist");
        require(proposal.status == ProposalStatus.QUEUED, "Proposal is not in queued status");
        require(!confirmations[proposalId][msg.sender], "Guardian already confirmed proposal");

        confirmations[proposalId][msg.sender] = true;
        proposal.confirmations += 1;

        emit ProposalConfirmed(proposalId, msg.sender, proposal.confirmations);
    }

    function executeProposal(bytes32 proposalId) external payable onlyGuardian returns (bytes memory) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.eta > 0, "Proposal does not exist");
        require(proposal.status == ProposalStatus.QUEUED, "Proposal not queued");
        require(
            proposal.confirmations >= requiredThreshold,
            "Insufficient guardian threshold confirmations"
        );
        require(block.timestamp >= proposal.eta, "Timelock delay has not elapsed");
        require(block.timestamp <= proposal.eta + GRACE_PERIOD, "Proposal expired past grace period");

        proposal.status = ProposalStatus.EXECUTED;

        (bool success, bytes memory returnData) = proposal.target.call{value: proposal.value}(
            proposal.data
        );
        require(success, "Governance proposal call execution failed");

        emit ProposalExecuted(proposalId, msg.sender, returnData);
        return returnData;
    }

    function cancelProposal(bytes32 proposalId, string calldata reason) external onlyGuardian {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.eta > 0, "Proposal does not exist");
        require(proposal.status == ProposalStatus.QUEUED, "Proposal not in cancellable status");

        proposal.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId, msg.sender, reason);
    }

    function getProposal(bytes32 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function isConfirmedBy(bytes32 proposalId, address guardian) external view returns (bool) {
        return confirmations[proposalId][guardian];
    }

    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    function getGuardianCount() external view returns (uint256) {
        return guardians.length;
    }

    receive() external payable {}
}
