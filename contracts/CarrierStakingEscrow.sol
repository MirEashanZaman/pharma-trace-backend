// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract CarrierStakingEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    error OnlyOwnerAuthorized();
    error InvalidOracleAddress();
    error OracleAlreadyAuthorized();
    error OracleNotAuthorized();
    error CannotReduceOracleCountBelowThreshold();
    error InvalidConsensusThreshold();
    error AmountMustBeGreaterThanZero();
    error InsufficientUnlockedCollateral();
    error BondAlreadyExists();
    error InvalidAddresses();
    error CarrierNotAccredited();
    error InsufficientAvailableCollateral();
    error BondNotLocked();
    error InsufficientOracleSignatures();
    error UnauthorizedOracleSigner();
    error DuplicateOracleSignature();
    error InvalidSlashPercentage();

    address public owner;
    IERC20 public immutable stakingToken;

    enum BondStatus { NONE, LOCKED, RELEASED, SLASHED }

    struct CarrierAccount {
        uint256 totalStaked;
        uint256 lockedCollateral;
        uint256 totalSlashed;
        uint256 totalIndemnified;
        bool isAccredited;
    }

    struct ShipmentBond {
        bytes32 shipmentId;
        address carrier;
        BondStatus status;
        uint64 lockedAt;
        address manufacturer;
        uint64 resolvedAt;
        uint256 bondAmount;
        string resolutionReason;
    }

    mapping(address => CarrierAccount) public carriers;
    mapping(bytes32 => ShipmentBond) public bonds;
    bytes32[] public activeBondIds;
    mapping(bytes32 => uint256) private activeBondIdIndex;

    mapping(address => bool) public isAuthorizedOracle;
    uint256 public oracleCount;
    uint256 public consensusThreshold;

    event CarrierStaked(address indexed carrier, uint256 amount, uint256 newTotalStake);
    event CarrierUnstaked(address indexed carrier, uint256 amount, uint256 remainingStake);
    event BondLocked(bytes32 indexed shipmentId, address indexed carrier, address indexed manufacturer, uint256 bondAmount);
    event BondReleased(bytes32 indexed shipmentId, address indexed carrier, uint256 bondAmount);
    event BondSlashed(bytes32 indexed shipmentId, address indexed carrier, address indexed manufacturer, uint256 slashedAmount, string excursionReason, bytes32 consensusReportHash);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ConsensusThresholdUpdated(uint256 newThreshold);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerAuthorized();
        _;
    }

    constructor(address _stakingToken) {
        owner = msg.sender;
        stakingToken = IERC20(_stakingToken);
        isAuthorizedOracle[msg.sender] = true;
        oracleCount = 1;
        consensusThreshold = 1;
    }

    function addOracle(address oracle) external onlyOwner {
        if (oracle == address(0)) revert InvalidOracleAddress();
        if (isAuthorizedOracle[oracle]) revert OracleAlreadyAuthorized();
        isAuthorizedOracle[oracle] = true;
        oracleCount += 1;
        emit OracleAdded(oracle);
    }

    function removeOracle(address oracle) external onlyOwner {
        if (!isAuthorizedOracle[oracle]) revert OracleNotAuthorized();
        if (oracleCount <= consensusThreshold) revert CannotReduceOracleCountBelowThreshold();
        isAuthorizedOracle[oracle] = false;
        oracleCount -= 1;
        emit OracleRemoved(oracle);
    }

    function setConsensusThreshold(uint256 threshold) external onlyOwner {
        if (threshold == 0 || threshold > oracleCount) revert InvalidConsensusThreshold();
        consensusThreshold = threshold;
        emit ConsensusThresholdUpdated(threshold);
    }

    function _removeActiveBond(bytes32 shipmentId) internal {
        uint256 index = activeBondIdIndex[shipmentId];
        uint256 lastIndex = activeBondIds.length - 1;
        if (index != lastIndex) {
            bytes32 lastBondId = activeBondIds[lastIndex];
            activeBondIds[index] = lastBondId;
            activeBondIdIndex[lastBondId] = index;
        }
        activeBondIds.pop();
        delete activeBondIdIndex[shipmentId];
    }

    function stakeCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        CarrierAccount storage account = carriers[msg.sender];
        account.totalStaked += amount;
        account.isAccredited = true;

        emit CarrierStaked(msg.sender, amount, account.totalStaked);
    }

    function unstakeCollateral(uint256 amount) external nonReentrant {
        CarrierAccount storage account = carriers[msg.sender];
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        if (account.totalStaked - account.lockedCollateral < amount) revert InsufficientUnlockedCollateral();

        account.totalStaked -= amount;
        if (account.totalStaked == 0) {
            account.isAccredited = false;
        }

        stakingToken.safeTransfer(msg.sender, amount);
        emit CarrierUnstaked(msg.sender, amount, account.totalStaked);
    }

    function lockShipmentBond(
        bytes32 shipmentId,
        address carrier,
        address manufacturer,
        uint256 bondAmount
    ) external onlyOwner {
        if (bonds[shipmentId].status != BondStatus.NONE) revert BondAlreadyExists();
        if (carrier == address(0) || manufacturer == address(0)) revert InvalidAddresses();
        CarrierAccount storage account = carriers[carrier];
        if (!account.isAccredited) revert CarrierNotAccredited();
        if (account.totalStaked - account.lockedCollateral < bondAmount) revert InsufficientAvailableCollateral();

        account.lockedCollateral += bondAmount;
        bonds[shipmentId] = ShipmentBond({
            shipmentId: shipmentId,
            carrier: carrier,
            status: BondStatus.LOCKED,
            lockedAt: uint64(block.timestamp),
            manufacturer: manufacturer,
            resolvedAt: 0,
            bondAmount: bondAmount,
            resolutionReason: ""
        });

        activeBondIdIndex[shipmentId] = activeBondIds.length;
        activeBondIds.push(shipmentId);
        emit BondLocked(shipmentId, carrier, manufacturer, bondAmount);
    }

    function releaseShipmentBond(bytes32 shipmentId) external onlyOwner {
        ShipmentBond storage bond = bonds[shipmentId];
        if (bond.status != BondStatus.LOCKED) revert BondNotLocked();

        CarrierAccount storage account = carriers[bond.carrier];
        account.lockedCollateral -= bond.bondAmount;
        bond.status = BondStatus.RELEASED;
        bond.resolvedAt = uint64(block.timestamp);
        bond.resolutionReason = "Multi-sensor consensus verified compliant cold-chain handover";

        _removeActiveBond(shipmentId);

        emit BondReleased(shipmentId, bond.carrier, bond.bondAmount);
    }

    function slashShipmentBond(
        bytes32 shipmentId,
        uint256 slashPercentage,
        string calldata excursionReason,
        bytes32 consensusReportHash
    ) external onlyOwner nonReentrant {
        _executeSlash(shipmentId, slashPercentage, excursionReason, consensusReportHash);
    }

    function slashBondWithConsensus(
        bytes32 shipmentId,
        uint256 slashPercentage,
        string calldata excursionReason,
        bytes32 consensusReportHash,
        bytes[] calldata signatures
    ) external nonReentrant {
        if (signatures.length < consensusThreshold) revert InsufficientOracleSignatures();

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                shipmentId,
                slashPercentage,
                consensusReportHash
            )
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);

        address[] memory verifiedSigners = new address[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA.recover(ethSignedMessageHash, signatures[i]);
            if (!isAuthorizedOracle[signer]) revert UnauthorizedOracleSigner();
            for (uint256 j = 0; j < i; j++) {
                if (verifiedSigners[j] == signer) revert DuplicateOracleSignature();
            }
            verifiedSigners[i] = signer;
        }

        _executeSlash(shipmentId, slashPercentage, excursionReason, consensusReportHash);
    }

    function _executeSlash(
        bytes32 shipmentId,
        uint256 slashPercentage,
        string calldata excursionReason,
        bytes32 consensusReportHash
    ) internal {
        if (slashPercentage == 0 || slashPercentage > 100) revert InvalidSlashPercentage();
        ShipmentBond storage bond = bonds[shipmentId];
        if (bond.status != BondStatus.LOCKED) revert BondNotLocked();

        uint256 slashedAmount = (bond.bondAmount * slashPercentage) / 100;

        CarrierAccount storage account = carriers[bond.carrier];
        account.lockedCollateral -= bond.bondAmount;
        account.totalStaked -= slashedAmount;
        account.totalSlashed += slashedAmount;
        account.totalIndemnified += slashedAmount;

        bond.status = BondStatus.SLASHED;
        bond.resolvedAt = uint64(block.timestamp);
        bond.resolutionReason = excursionReason;

        _removeActiveBond(shipmentId);

        stakingToken.safeTransfer(bond.manufacturer, slashedAmount);

        emit BondSlashed(shipmentId, bond.carrier, bond.manufacturer, slashedAmount, excursionReason, consensusReportHash);
    }

    function getCarrierAccount(address carrier) external view returns (CarrierAccount memory) {
        return carriers[carrier];
    }

    function getShipmentBond(bytes32 shipmentId) external view returns (ShipmentBond memory) {
        return bonds[shipmentId];
    }

    function getActiveBondsCount() external view returns (uint256) {
        return activeBondIds.length;
    }
}
