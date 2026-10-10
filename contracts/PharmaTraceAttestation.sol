// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PharmaTraceAttestation
 * @dev Anchors cryptographic hashes and attestations for pharmaceutical track-and-trace lifecycle events.
 * Keeps detailed event payloads off-chain while guaranteeing tamper-evident on-chain integrity.
 */
contract PharmaTraceAttestation {
    struct Attestation {
        bytes32 dataHash;
        string drugSerialNumber;
        string eventType;
        address signer;
        uint256 blockTimestamp;
        bool isRevoked;
        string metadataUri; // IPFS / Off-chain JSON link
    }

    // Mapping from dataHash -> Attestation
    mapping(bytes32 => Attestation) public attestations;

    // Mapping from drugSerialNumber -> array of dataHashes
    mapping(string => bytes32[]) public drugHistory;

    // Contract Owner / Admin
    address public owner;

    // Events
    event AttestationRegistered(
        bytes32 indexed dataHash,
        string indexed drugSerialNumber,
        string eventType,
        address indexed signer,
        uint256 timestamp,
        string metadataUri
    );

    event AttestationRevoked(
        bytes32 indexed dataHash,
        address indexed revoker,
        uint256 timestamp,
        string reason
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register a new tamper-evident attestation anchor on-chain.
     * @param dataHash Cryptographic SHA-256 / Keccak-256 hash of the off-chain event record
     * @param drugSerialNumber Serial identifier of the drug package/batch
     * @param eventType Lifecycle stage (e.g., MANUFACTURED, QUALITY_CHECKED, SHIPPED, RECEIVED)
     * @param metadataUri Optional off-chain URI / IPFS CID / CID pointer
     */
    function registerAttestation(
        bytes32 dataHash,
        string calldata drugSerialNumber,
        string calldata eventType,
        string calldata metadataUri
    ) external returns (bool) {
        require(dataHash != bytes32(0), "Invalid data hash");
        require(attestations[dataHash].blockTimestamp == 0, "Attestation already exists");

        attestations[dataHash] = Attestation({
            dataHash: dataHash,
            drugSerialNumber: drugSerialNumber,
            eventType: eventType,
            signer: msg.sender,
            blockTimestamp: block.timestamp,
            isRevoked: false,
            metadataUri: metadataUri
        });

        drugHistory[drugSerialNumber].push(dataHash);

        emit AttestationRegistered(
            dataHash,
            drugSerialNumber,
            eventType,
            msg.sender,
            block.timestamp,
            metadataUri
        );

        return true;
    }

    /**
     * @notice Revoke or flag an attestation if custody dispute or counterfeit is detected.
     */
    function revokeAttestation(bytes32 dataHash, string calldata reason) external {
        Attestation storage record = attestations[dataHash];
        require(record.blockTimestamp > 0, "Attestation not found");
        require(
            msg.sender == record.signer || msg.sender == owner,
            "Unauthorized to revoke"
        );
        require(!record.isRevoked, "Already revoked");

        record.isRevoked = true;

        emit AttestationRevoked(dataHash, msg.sender, block.timestamp, reason);
    }

    /**
     * @notice Verify whether an attestation exists and is valid on-chain.
     */
    function verifyAttestation(bytes32 dataHash)
        external
        view
        returns (
            bool exists,
            bool isValid,
            string memory drugSerialNumber,
            string memory eventType,
            address signer,
            uint256 timestamp,
            string memory metadataUri
        )
    {
        Attestation memory record = attestations[dataHash];
        if (record.blockTimestamp == 0) {
            return (false, false, "", "", address(0), 0, "");
        }

        return (
            true,
            !record.isRevoked,
            record.drugSerialNumber,
            record.eventType,
            record.signer,
            record.blockTimestamp,
            record.metadataUri
        );
    }

    /**
     * @notice Get all on-chain attestation hashes for a drug serial number.
     */
    function getDrugHistory(string calldata drugSerialNumber)
        external
        view
        returns (bytes32[] memory)
    {
        return drugHistory[drugSerialNumber];
    }
}
