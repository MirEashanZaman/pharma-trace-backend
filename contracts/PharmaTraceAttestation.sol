// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract PharmaTraceAttestation is Initializable, UUPSUpgradeable, IERC5192 {
    error OnlyOwnerAuthorized();
    error ContractPaused();
    error ContractNotPaused();
    error Unauthorized();
    error InvalidInitialOwner();
    error InvalidDataHash();
    error AttestationAlreadyExists();
    error InvalidMerkleRoot();
    error InvalidBatchSize();
    error BatchAlreadyAnchored();
    error BatchNotFound();
    error AlreadyRevoked();
    error AttestationNotFound();
    error InvalidRecipientAddress();
    error ExpirationMustBeInFuture();
    error TokenIdCollision();
    error AccreditationNotFound();

    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant DISPENSER_ROLE = keccak256("DISPENSER_ROLE");

    struct Attestation {
        bytes32 dataHash;
        address signer;
        uint64 blockTimestamp;
        bool isRevoked;
        string drugSerialNumber;
        string eventType;
        string metadataUri;
    }

    struct BatchRecord {
        bytes32 merkleRoot;
        address submitter;
        uint64 blockTimestamp;
        bool isRevoked;
        uint32 batchSize;
        string ipfsCid;
    }

    struct Accreditation {
        bytes32 tokenId;
        address recipient;
        uint64 validUntil;
        bool locked;
        bool revoked;
        address issuer;
        uint64 issuedAt;
        string accreditationType;
        string jurisdiction;
        string metadataCid;
    }

    mapping(bytes32 => Attestation) public attestations;
    mapping(string => bytes32[]) public drugHistory;
    mapping(bytes32 => BatchRecord) public batches;
    mapping(bytes32 => mapping(address => bool)) public roles;
    mapping(bytes32 => Accreditation) public accreditations;
    mapping(address => bytes32[]) public holderAccreditations;

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

    event BatchAnchored(
        bytes32 indexed merkleRoot,
        uint32 batchSize,
        string ipfsCid,
        address indexed submitter,
        uint256 timestamp
    );

    event BatchRevoked(
        bytes32 indexed merkleRoot,
        address indexed revoker,
        uint256 timestamp,
        string reason
    );

    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );

    event RoleRevoked(
        bytes32 indexed role,
        address indexed account,
        address indexed sender
    );

    event Locked(bytes32 indexed tokenId);
    event Unlocked(bytes32 indexed tokenId);
    event AccreditationIssued(
        bytes32 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        string accreditationType,
        string jurisdiction,
        uint256 validUntil,
        string metadataCid
    );
    event AccreditationRevoked(
        bytes32 indexed tokenId,
        address indexed revoker,
        uint256 timestamp,
        string reason
    );

    bool public paused;

    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier whenPaused() {
        if (!paused) revert ContractNotPaused();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        if (initialOwner == address(0)) revert InvalidInitialOwner();
        owner = initialOwner;
        roles[REGULATOR_ROLE][initialOwner] = true;
        roles[MANUFACTURER_ROLE][initialOwner] = true;
        roles[DISTRIBUTOR_ROLE][initialOwner] = true;
        roles[DISPENSER_ROLE][initialOwner] = true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function pause() external {
        if (msg.sender != owner && !roles[REGULATOR_ROLE][msg.sender]) revert Unauthorized();
        if (paused) revert ContractPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external {
        if (msg.sender != owner && !roles[REGULATOR_ROLE][msg.sender]) revert Unauthorized();
        if (!paused) revert ContractNotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function grantRole(bytes32 role, address account) external onlyOwner {
        roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external onlyOwner {
        roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return roles[role][account];
    }

    function registerAttestation(
        bytes32 dataHash,
        string calldata drugSerialNumber,
        string calldata eventType,
        string calldata metadataUri
    ) external whenNotPaused returns (bool) {
        if (
            msg.sender != owner &&
            !roles[MANUFACTURER_ROLE][msg.sender] &&
            !roles[DISTRIBUTOR_ROLE][msg.sender] &&
            !roles[DISPENSER_ROLE][msg.sender] &&
            !roles[REGULATOR_ROLE][msg.sender]
        ) revert Unauthorized();
        if (dataHash == bytes32(0)) revert InvalidDataHash();
        if (attestations[dataHash].blockTimestamp != 0) revert AttestationAlreadyExists();

        attestations[dataHash] = Attestation({
            dataHash: dataHash,
            signer: msg.sender,
            blockTimestamp: uint64(block.timestamp),
            isRevoked: false,
            drugSerialNumber: drugSerialNumber,
            eventType: eventType,
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

    function anchorBatch(
        bytes32 merkleRoot,
        uint32 batchSize,
        string calldata ipfsCid
    ) external whenNotPaused returns (bool) {
        if (
            msg.sender != owner &&
            !roles[MANUFACTURER_ROLE][msg.sender] &&
            !roles[REGULATOR_ROLE][msg.sender]
        ) revert Unauthorized();
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (batchSize == 0) revert InvalidBatchSize();
        if (batches[merkleRoot].blockTimestamp != 0) revert BatchAlreadyAnchored();

        batches[merkleRoot] = BatchRecord({
            merkleRoot: merkleRoot,
            submitter: msg.sender,
            blockTimestamp: uint64(block.timestamp),
            isRevoked: false,
            batchSize: batchSize,
            ipfsCid: ipfsCid
        });

        emit BatchAnchored(
            merkleRoot,
            batchSize,
            ipfsCid,
            msg.sender,
            block.timestamp
        );

        return true;
    }

    function verifyBatchInclusion(
        bytes32 leaf,
        bytes32[] calldata proof,
        bytes32 merkleRoot
    ) external pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == merkleRoot;
    }

    function verifyBatch(bytes32 merkleRoot)
        external
        view
        returns (
            bool exists,
            bool isValid,
            uint32 batchSize,
            string memory ipfsCid,
            address submitter,
            uint256 timestamp
        )
    {
        BatchRecord memory record = batches[merkleRoot];
        if (record.blockTimestamp == 0) {
            return (false, false, 0, "", address(0), 0);
        }

        return (
            true,
            !record.isRevoked,
            record.batchSize,
            record.ipfsCid,
            record.submitter,
            uint256(record.blockTimestamp)
        );
    }

    function revokeBatch(bytes32 merkleRoot, string calldata reason) external whenNotPaused {
        BatchRecord storage record = batches[merkleRoot];
        if (record.blockTimestamp == 0) revert BatchNotFound();
        if (msg.sender != record.submitter && msg.sender != owner && !roles[REGULATOR_ROLE][msg.sender]) revert Unauthorized();
        if (record.isRevoked) revert AlreadyRevoked();

        record.isRevoked = true;
        emit BatchRevoked(merkleRoot, msg.sender, block.timestamp, reason);
    }

    function revokeAttestation(bytes32 dataHash, string calldata reason) external whenNotPaused {
        Attestation storage record = attestations[dataHash];
        if (record.blockTimestamp == 0) revert AttestationNotFound();
        if (msg.sender != record.signer && msg.sender != owner && !roles[REGULATOR_ROLE][msg.sender]) revert Unauthorized();
        if (record.isRevoked) revert AlreadyRevoked();

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
            uint256(record.blockTimestamp),
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

    function getDrugHistoryPaginated(
        string calldata drugSerialNumber,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory items, uint256 total) {
        bytes32[] storage allHashes = drugHistory[drugSerialNumber];
        total = allHashes.length;
        if (offset >= total || limit == 0) {
            return (new bytes32[](0), total);
        }
        uint256 count = limit;
        if (offset + count > total) {
            count = total - offset;
        }
        items = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            items[i] = allHashes[offset + i];
        }
        return (items, total);
    }

    function issueAccreditation(
        address recipient,
        string calldata accreditationType,
        string calldata jurisdiction,
        uint256 validUntil,
        string calldata metadataCid
    ) external whenNotPaused returns (bytes32) {
        if (msg.sender != owner && !roles[REGULATOR_ROLE][msg.sender]) revert Unauthorized();
        if (recipient == address(0)) revert InvalidRecipientAddress();
        if (validUntil <= block.timestamp) revert ExpirationMustBeInFuture();

        bytes32 tokenId = keccak256(
            abi.encodePacked(recipient, accreditationType, block.timestamp, block.prevrandao)
        );
        if (accreditations[tokenId].issuedAt != 0) revert TokenIdCollision();

        accreditations[tokenId] = Accreditation({
            tokenId: tokenId,
            recipient: recipient,
            validUntil: uint64(validUntil),
            locked: true,
            revoked: false,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            accreditationType: accreditationType,
            jurisdiction: jurisdiction,
            metadataCid: metadataCid
        });

        holderAccreditations[recipient].push(tokenId);

        emit AccreditationIssued(
            tokenId,
            recipient,
            msg.sender,
            accreditationType,
            jurisdiction,
            validUntil,
            metadataCid
        );
        emit Locked(tokenId);
        emit IERC5192.Locked(uint256(tokenId));

        return tokenId;
    }

    function revokeAccreditation(bytes32 tokenId, string calldata reason) external whenNotPaused {
        Accreditation storage record = accreditations[tokenId];
        if (record.issuedAt == 0) revert AccreditationNotFound();
        if (msg.sender != record.issuer && msg.sender != owner && !roles[REGULATOR_ROLE][msg.sender]) revert Unauthorized();
        if (record.revoked) revert AlreadyRevoked();

        record.revoked = true;
        emit AccreditationRevoked(tokenId, msg.sender, block.timestamp, reason);
    }

    function verifyAccreditation(bytes32 tokenId)
        external
        view
        returns (
            bool exists,
            bool isValid,
            address recipient,
            address issuer,
            string memory accreditationType,
            string memory jurisdiction,
            uint256 validUntil,
            string memory metadataCid
        )
    {
        Accreditation memory record = accreditations[tokenId];
        if (record.issuedAt == 0) {
            return (false, false, address(0), address(0), "", "", 0, "");
        }

        bool valid = !record.revoked && block.timestamp <= record.validUntil;
        return (
            true,
            valid,
            record.recipient,
            record.issuer,
            record.accreditationType,
            record.jurisdiction,
            uint256(record.validUntil),
            record.metadataCid
        );
    }

    function locked(bytes32 tokenId) external view returns (bool) {
        Accreditation memory record = accreditations[tokenId];
        if (record.issuedAt == 0) revert AccreditationNotFound();
        return record.locked;
    }

    function locked(uint256 tokenId) external view override returns (bool) {
        Accreditation memory record = accreditations[bytes32(tokenId)];
        if (record.issuedAt == 0) revert AccreditationNotFound();
        return record.locked;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == type(IERC5192).interfaceId;
    }

    function getHolderAccreditations(address holder) external view returns (bytes32[] memory) {
        return holderAccreditations[holder];
    }

    function isAccredited(address account, string calldata accreditationType) external view returns (bool) {
        bytes32[] storage tokens = holderAccreditations[account];
        bytes32 targetHash = keccak256(bytes(accreditationType));
        for (uint256 i = 0; i < tokens.length; i++) {
            Accreditation memory record = accreditations[tokens[i]];
            if (
                !record.revoked &&
                block.timestamp <= record.validUntil &&
                keccak256(bytes(record.accreditationType)) == targetHash
            ) {
                return true;
            }
        }
        return false;
    }
}
