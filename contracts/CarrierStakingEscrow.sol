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
        address manufacturer;
        uint256 bondAmount;
        BondStatus status;
        uint256 lockedAt;
        uint256 resolvedAt;
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
        require(msg.sender == owner, "Only owner authorized");
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
        require(oracle != address(0), "Invalid oracle address");
        require(!isAuthorizedOracle[oracle], "Oracle already authorized");
        isAuthorizedOracle[oracle] = true;
        oracleCount += 1;
        emit OracleAdded(oracle);
    }

    function removeOracle(address oracle) external onlyOwner {
        require(isAuthorizedOracle[oracle], "Oracle not authorized");
        require(oracleCount > consensusThreshold, "Cannot reduce oracle count below threshold");
        isAuthorizedOracle[oracle] = false;
        oracleCount -= 1;
        emit OracleRemoved(oracle);
    }

    function setConsensusThreshold(uint256 threshold) external onlyOwner {
        require(threshold > 0 && threshold <= oracleCount, "Invalid consensus threshold");
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
        require(amount > 0, "Amount must be greater than zero");
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        CarrierAccount storage account = carriers[msg.sender];
        account.totalStaked += amount;
        account.isAccredited = true;

        emit CarrierStaked(msg.sender, amount, account.totalStaked);
    }

    function unstakeCollateral(uint256 amount) external nonReentrant {
        CarrierAccount storage account = carriers[msg.sender];
        require(amount > 0, "Amount must be greater than zero");
        require(account.totalStaked - account.lockedCollateral >= amount, "Insufficient unlocked collateral");

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
        require(bonds[shipmentId].status == BondStatus.NONE, "Bond already exists for shipment");
        require(carrier != address(0) && manufacturer != address(0), "Invalid addresses");
        CarrierAccount storage account = carriers[carrier];
        require(account.isAccredited, "Carrier not accredited");
        require(account.totalStaked - account.lockedCollateral >= bondAmount, "Insufficient available collateral");

        account.lockedCollateral += bondAmount;
        bonds[shipmentId] = ShipmentBond({
            shipmentId: shipmentId,
            carrier: carrier,
            manufacturer: manufacturer,
            bondAmount: bondAmount,
            status: BondStatus.LOCKED,
            lockedAt: block.timestamp,
            resolvedAt: 0,
            resolutionReason: ""
        });

        activeBondIdIndex[shipmentId] = activeBondIds.length;
        activeBondIds.push(shipmentId);
        emit BondLocked(shipmentId, carrier, manufacturer, bondAmount);
    }

    function releaseShipmentBond(bytes32 shipmentId) external onlyOwner {
        ShipmentBond storage bond = bonds[shipmentId];
        require(bond.status == BondStatus.LOCKED, "Bond is not locked");

        CarrierAccount storage account = carriers[bond.carrier];
        account.lockedCollateral -= bond.bondAmount;
        bond.status = BondStatus.RELEASED;
        bond.resolvedAt = block.timestamp;
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
        require(signatures.length >= consensusThreshold, "Insufficient oracle signatures for consensus");

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
            require(isAuthorizedOracle[signer], "Signature signer is not an authorized oracle");
            for (uint256 j = 0; j < i; j++) {
                require(verifiedSigners[j] != signer, "Duplicate oracle signature detected");
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
        require(slashPercentage > 0 && slashPercentage <= 100, "Invalid slash percentage");
        ShipmentBond storage bond = bonds[shipmentId];
        require(bond.status == BondStatus.LOCKED, "Bond is not locked");

        uint256 slashedAmount = (bond.bondAmount * slashPercentage) / 100;

        CarrierAccount storage account = carriers[bond.carrier];
        account.lockedCollateral -= bond.bondAmount;
        account.totalStaked -= slashedAmount;
        account.totalSlashed += slashedAmount;
        account.totalIndemnified += slashedAmount;

        bond.status = BondStatus.SLASHED;
        bond.resolvedAt = block.timestamp;
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
