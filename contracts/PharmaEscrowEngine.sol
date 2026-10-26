// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PharmaEscrowEngine is ReentrancyGuard {
    address public owner;

    enum EscrowStatus { INITIALIZED, FUNDED, RELEASED, REFUNDED, DISPUTED }

    struct EscrowOrder {
        bytes32 orderId;
        address buyer;
        address seller;
        uint256 amountWei;
        string drugSerialNumber;
        EscrowStatus status;
        uint256 createdAt;
        uint256 timeoutTimestamp;
        bool coldChainCompliant;
        bool custodyAccepted;
    }

    mapping(bytes32 => EscrowOrder) public escrows;
    bytes32[] public activeOrderIds;
    mapping(bytes32 => uint256) private activeOrderIdIndex;

    event EscrowFunded(bytes32 indexed orderId, address indexed buyer, address indexed seller, uint256 amountWei, string drugSerialNumber);
    event EscrowReleased(bytes32 indexed orderId, address indexed seller, uint256 amountWei);
    event EscrowRefunded(bytes32 indexed orderId, address indexed buyer, uint256 amountWei, string reason);
    event ComplianceUpdated(bytes32 indexed orderId, bool coldChainCompliant, bool custodyAccepted);
    event UpkeepPerformed(bytes32 indexed orderId, uint8 actionType, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function _removeActiveOrder(bytes32 orderId) internal {
        uint256 index = activeOrderIdIndex[orderId];
        uint256 lastIndex = activeOrderIds.length - 1;
        if (index != lastIndex) {
            bytes32 lastOrderId = activeOrderIds[lastIndex];
            activeOrderIds[index] = lastOrderId;
            activeOrderIdIndex[lastOrderId] = index;
        }
        activeOrderIds.pop();
        delete activeOrderIdIndex[orderId];
    }

    function createEscrow(
        bytes32 orderId,
        address seller,
        string calldata drugSerialNumber,
        uint256 timeoutSeconds
    ) external payable returns (bool) {
        require(msg.value > 0, "Escrow deposit must be greater than zero");
        require(escrows[orderId].amountWei == 0, "Escrow order already exists");
        require(seller != address(0), "Invalid seller address");

        escrows[orderId] = EscrowOrder({
            orderId: orderId,
            buyer: msg.sender,
            seller: seller,
            amountWei: msg.value,
            drugSerialNumber: drugSerialNumber,
            status: EscrowStatus.FUNDED,
            createdAt: block.timestamp,
            timeoutTimestamp: block.timestamp + timeoutSeconds,
            coldChainCompliant: false,
            custodyAccepted: false
        });

        activeOrderIdIndex[orderId] = activeOrderIds.length;
        activeOrderIds.push(orderId);

        emit EscrowFunded(orderId, msg.sender, seller, msg.value, drugSerialNumber);
        return true;
    }

    function recordComplianceAndHandshake(
        bytes32 orderId,
        bool coldChainCompliant,
        bool custodyAccepted
    ) external nonReentrant {
        EscrowOrder storage order = escrows[orderId];
        require(order.amountWei > 0, "Escrow not found");
        require(order.status == EscrowStatus.FUNDED, "Escrow not in funded state");
        require(msg.sender == owner || msg.sender == order.buyer || msg.sender == order.seller, "Unauthorized to record compliance");
        if (msg.sender == order.seller) {
            require(!custodyAccepted || order.custodyAccepted, "Seller cannot self-confirm custody acceptance");
        }

        order.coldChainCompliant = coldChainCompliant;
        order.custodyAccepted = custodyAccepted;

        emit ComplianceUpdated(orderId, coldChainCompliant, custodyAccepted);

        if (coldChainCompliant && custodyAccepted) {
            order.status = EscrowStatus.RELEASED;
            _removeActiveOrder(orderId);
            uint256 payout = order.amountWei;
            order.amountWei = 0;
            (bool success, ) = payable(order.seller).call{value: payout}("");
            require(success, "Payout transfer failed");
            emit EscrowReleased(orderId, order.seller, payout);
        }
    }

    function triggerSpoilageRefund(bytes32 orderId, string calldata breachReason) external nonReentrant {
        EscrowOrder storage order = escrows[orderId];
        require(order.amountWei > 0, "Escrow not found");
        require(order.status == EscrowStatus.FUNDED, "Escrow not in funded state");
        require(msg.sender == owner || msg.sender == order.buyer, "Unauthorized to trigger refund");
        require(bytes(breachReason).length > 0, "Breach reason required");
        if (msg.sender == order.buyer) {
            require(!order.custodyAccepted, "Cannot trigger refund after custody acceptance");
        }

        order.status = EscrowStatus.REFUNDED;
        _removeActiveOrder(orderId);
        uint256 refundAmount = order.amountWei;
        order.amountWei = 0;
        (bool success, ) = payable(order.buyer).call{value: refundAmount}("");
        require(success, "Refund transfer failed");

        emit EscrowRefunded(orderId, order.buyer, refundAmount, breachReason);
    }

    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        uint256 total = activeOrderIds.length;
        for (uint256 i = 0; i < total; i++) {
            bytes32 id = activeOrderIds[i];
            EscrowOrder memory order = escrows[id];
            if (order.status == EscrowStatus.FUNDED && order.amountWei > 0) {
                if (order.coldChainCompliant && order.custodyAccepted) {
                    return (true, abi.encode(id, uint8(1)));
                }
                if (block.timestamp > order.timeoutTimestamp) {
                    return (true, abi.encode(id, uint8(2)));
                }
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external nonReentrant {
        (bytes32 orderId, uint8 actionType) = abi.decode(performData, (bytes32, uint8));
        EscrowOrder storage order = escrows[orderId];
        require(order.status == EscrowStatus.FUNDED && order.amountWei > 0, "Escrow not eligible for upkeep");

        if (actionType == 1) {
            require(order.coldChainCompliant && order.custodyAccepted, "Upkeep conditions not met for release");
            order.status = EscrowStatus.RELEASED;
            _removeActiveOrder(orderId);
            uint256 payout = order.amountWei;
            order.amountWei = 0;
            (bool success, ) = payable(order.seller).call{value: payout}("");
            require(success, "Automated payout transfer failed");
            emit EscrowReleased(orderId, order.seller, payout);
            emit UpkeepPerformed(orderId, 1, block.timestamp);
        } else if (actionType == 2) {
            require(block.timestamp > order.timeoutTimestamp, "Timeout SLA not breached");
            order.status = EscrowStatus.REFUNDED;
            _removeActiveOrder(orderId);
            uint256 refundAmount = order.amountWei;
            order.amountWei = 0;
            (bool success, ) = payable(order.buyer).call{value: refundAmount}("");
            require(success, "Automated refund transfer failed");
            emit EscrowRefunded(orderId, order.buyer, refundAmount, "Chainlink Keeper SLA timeout refund");
            emit UpkeepPerformed(orderId, 2, block.timestamp);
        } else {
            revert("Unknown upkeep action");
        }
    }

    function getEscrow(bytes32 orderId) external view returns (EscrowOrder memory) {
        return escrows[orderId];
    }

    function getActiveOrdersCount() external view returns (uint256) {
        return activeOrderIds.length;
    }
}

