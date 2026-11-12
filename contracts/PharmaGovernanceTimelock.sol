// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PharmaGovernanceTimelock {
    error NotAuthorizedGuardian();
    error GuardiansRequired();
    error InvalidConfirmationThreshold();
    error InvalidGuardianAddress();
    error DuplicateGuardian();
    error TargetZeroAddress();
    error ProposalCollision();
    error ProposalNotFound();
    error ProposalNotQueued();
    error GuardianAlreadyConfirmed();
    error InsufficientConfirmations();
    error TimelockDelayNotElapsed();
    error ProposalExpiredPastGracePeriod();
    error GovernanceCallExecutionFailed();
    error ProposalNotInCancellableStatus();

    enum ProposalStatus { PENDING, QUEUED, EXECUTED, CANCELLED, EXPIRED }

    struct Proposal {
        bytes32 id;
        uint256 value;
        address proposer;
        uint64 eta;
        ProposalStatus status;
        address target;
        uint32 confirmations;
        bytes data;
        string description;
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
        if (!isGuardian[msg.sender]) revert NotAuthorizedGuardian();
        _;
    }

    constructor(
        address[] memory _guardians,
        uint256 _requiredThreshold,
        uint256 _minDelay
    ) {
        if (_guardians.length == 0) revert GuardiansRequired();
        if (_requiredThreshold == 0 || _requiredThreshold > _guardians.length) revert InvalidConfirmationThreshold();

        for (uint256 i = 0; i < _guardians.length; i++) {
            address guardian = _guardians[i];
            if (guardian == address(0)) revert InvalidGuardianAddress();
            if (isGuardian[guardian]) revert DuplicateGuardian();
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
        if (target == address(0)) revert TargetZeroAddress();

        bytes32 proposalId = keccak256(
            abi.encode(target, value, data, description, block.timestamp, msg.sender)
        );
        if (proposals[proposalId].eta != 0) revert ProposalCollision();

        uint256 eta = block.timestamp + minDelay;

        proposals[proposalId] = Proposal({
            id: proposalId,
            value: value,
            proposer: msg.sender,
            eta: uint64(eta),
            status: ProposalStatus.QUEUED,
            target: target,
            confirmations: 1,
            data: data,
            description: description
        });

        confirmations[proposalId][msg.sender] = true;

        emit ProposalCreated(proposalId, msg.sender, target, value, description, eta);
        emit ProposalConfirmed(proposalId, msg.sender, 1);

        return proposalId;
    }

    function confirmProposal(bytes32 proposalId) external onlyGuardian {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.eta == 0) revert ProposalNotFound();
        if (proposal.status != ProposalStatus.QUEUED) revert ProposalNotQueued();
        if (confirmations[proposalId][msg.sender]) revert GuardianAlreadyConfirmed();

        confirmations[proposalId][msg.sender] = true;
        proposal.confirmations += 1;

        emit ProposalConfirmed(proposalId, msg.sender, proposal.confirmations);
    }

    function executeProposal(bytes32 proposalId) external payable onlyGuardian returns (bytes memory) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.eta == 0) revert ProposalNotFound();
        if (proposal.status != ProposalStatus.QUEUED) revert ProposalNotQueued();
        if (proposal.confirmations < requiredThreshold) revert InsufficientConfirmations();
        if (block.timestamp < proposal.eta) revert TimelockDelayNotElapsed();
        if (block.timestamp > proposal.eta + GRACE_PERIOD) revert ProposalExpiredPastGracePeriod();

        proposal.status = ProposalStatus.EXECUTED;

        (bool success, bytes memory returnData) = proposal.target.call{value: proposal.value}(
            proposal.data
        );
        if (!success) revert GovernanceCallExecutionFailed();

        emit ProposalExecuted(proposalId, msg.sender, returnData);
        return returnData;
    }

    function cancelProposal(bytes32 proposalId, string calldata reason) external onlyGuardian {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.eta == 0) revert ProposalNotFound();
        if (proposal.status != ProposalStatus.QUEUED) revert ProposalNotInCancellableStatus();

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
