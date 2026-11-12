// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICarrierStakingEscrow {
    function slashShipmentBond(
        bytes32 shipmentId,
        uint256 slashPercentage,
        string calldata excursionReason,
        bytes32 consensusReportHash
    ) external;
}

contract ColdChainAutomationOracle is Ownable, ReentrancyGuard {
    error InvalidEscrowAddress();
    error PolicyAlreadyExists();
    error PolicyNotRegistered();
    error NoActiveBreach();
    error ExcursionDurationBelowThreshold();

    ICarrierStakingEscrow public escrowContract;

    struct ColdChainPolicy {
        bytes32 shipmentId;
        int128 minTempHundredths;
        int128 maxTempHundredths;
        uint64 maxExcursionDurationSeconds;
        uint64 excursionStartTime;
        bool hasExcursion;
        bool isSlashed;
    }

    mapping(bytes32 => ColdChainPolicy) public policies;
    bytes32[] public monitoredShipmentIds;

    event PolicyRegistered(bytes32 indexed shipmentId, int256 minTemp, int256 maxTemp, uint256 maxDuration);
    event ExcursionDetected(bytes32 indexed shipmentId, int256 recordedTemp, uint256 timestamp);
    event ExcursionResolved(bytes32 indexed shipmentId, uint256 timestamp);
    event AutomationSlashTriggered(bytes32 indexed shipmentId, uint256 slashPercentage, string reason);

    constructor(address _escrowContract) Ownable(msg.sender) {
        if (_escrowContract == address(0)) revert InvalidEscrowAddress();
        escrowContract = ICarrierStakingEscrow(_escrowContract);
    }

    function setEscrowContract(address _escrowContract) external onlyOwner {
        if (_escrowContract == address(0)) revert InvalidEscrowAddress();
        escrowContract = ICarrierStakingEscrow(_escrowContract);
    }

    function registerPolicy(
        bytes32 shipmentId,
        int256 minTempHundredths,
        int256 maxTempHundredths,
        uint256 maxExcursionDurationSeconds
    ) external onlyOwner {
        if (policies[shipmentId].minTempHundredths != 0 || policies[shipmentId].maxTempHundredths != 0) revert PolicyAlreadyExists();
        policies[shipmentId] = ColdChainPolicy({
            shipmentId: shipmentId,
            minTempHundredths: int128(minTempHundredths),
            maxTempHundredths: int128(maxTempHundredths),
            maxExcursionDurationSeconds: uint64(maxExcursionDurationSeconds),
            excursionStartTime: 0,
            hasExcursion: false,
            isSlashed: false
        });
        monitoredShipmentIds.push(shipmentId);
        emit PolicyRegistered(shipmentId, minTempHundredths, maxTempHundredths, maxExcursionDurationSeconds);
    }

    function ingestTelemetry(
        bytes32 shipmentId,
        int256 currentTempHundredths,
        uint256 timestamp
    ) external onlyOwner {
        ColdChainPolicy storage policy = policies[shipmentId];
        if (policy.minTempHundredths == 0 && policy.maxTempHundredths == 0) revert PolicyNotRegistered();
        if (policy.isSlashed) return;

        bool outOfBounds = (currentTempHundredths < policy.minTempHundredths || currentTempHundredths > policy.maxTempHundredths);

        if (outOfBounds) {
            if (!policy.hasExcursion) {
                policy.hasExcursion = true;
                policy.excursionStartTime = uint64(timestamp);
                emit ExcursionDetected(shipmentId, currentTempHundredths, timestamp);
            }
        } else {
            if (policy.hasExcursion) {
                policy.hasExcursion = false;
                policy.excursionStartTime = 0;
                emit ExcursionResolved(shipmentId, timestamp);
            }
        }
    }

    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        for (uint256 i = 0; i < monitoredShipmentIds.length; i++) {
            bytes32 sId = monitoredShipmentIds[i];
            ColdChainPolicy memory policy = policies[sId];
            if (policy.hasExcursion && !policy.isSlashed) {
                if (block.timestamp >= policy.excursionStartTime + policy.maxExcursionDurationSeconds) {
                    return (true, abi.encode(sId));
                }
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external nonReentrant {
        bytes32 shipmentId = abi.decode(performData, (bytes32));
        ColdChainPolicy storage policy = policies[shipmentId];
        if (!policy.hasExcursion || policy.isSlashed) revert NoActiveBreach();
        if (block.timestamp < policy.excursionStartTime + policy.maxExcursionDurationSeconds) revert ExcursionDurationBelowThreshold();

        policy.isSlashed = true;
        bytes32 consensusHash = keccak256(abi.encodePacked(shipmentId, block.timestamp, "CHAINLINK_AUTOMATION"));
        string memory reason = "Chainlink automated IoT consensus verified critical cold-chain excursion breach";

        escrowContract.slashShipmentBond(shipmentId, 100, reason, consensusHash);
        emit AutomationSlashTriggered(shipmentId, 100, reason);
    }
}
