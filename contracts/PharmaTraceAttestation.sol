
pragma solidity ^0.8.20;


contract PharmaTraceAttestation {
    struct Attestation {
        bytes32 dataHash;
        string drugSerialNumber;
        string eventType;
        address signer;
        uint256 blockTimestamp;
        bool isRevoked;
        string metadataUri; 
    }

    
    mapping(bytes32 => Attestation) public attestations;

    
    mapping(string => bytes32[]) public drugHistory;

    
    address public owner;

    
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

    
    function getDrugHistory(string calldata drugSerialNumber)
        external
        view
        returns (bytes32[] memory)
    {
        return drugHistory[drugSerialNumber];
    }
}
