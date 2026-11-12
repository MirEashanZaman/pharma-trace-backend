// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PharmaEscrowEngine is ReentrancyGuard {
    error OnlyOwnerAuthorized();
    error EscrowDepositZero();
    error EscrowAlreadyExists();
    error InvalidSellerAddress();
    error EscrowNotFound();
    error EscrowNotInFundedState();
    error Unauthorized();
    error SellerCannotSelfConfirmCustody();
    error PayoutTransferFailed();
    error BreachReasonRequired();
    error CannotRefundAfterCustodyAccepted();
    error RefundTransferFailed();
    error EscrowNotEligibleForUpkeep();
    error UpkeepConditionsNotMet();
    error TimeoutNotBreached();
    error UnknownUpkeepAction();

    address public owner;

    enum EscrowStatus { INITIALIZED, FUNDED, RELEASED, REFUNDED, DISPUTED }

    struct EscrowOrder {
        bytes32 orderId;
        address buyer;
        uint64 createdAt;
        EscrowStatus status;
        address seller;
        uint64 timeoutTimestamp;
        bool coldChainCompliant;
        bool custodyAccepted;
        uint256 amountWei;
        string drugSerialNumber;
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
        if (msg.sender != owner) revert OnlyOwnerAuthorized();
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
        if (msg.value == 0) revert EscrowDepositZero();
        if (escrows[orderId].amountWei != 0) revert EscrowAlreadyExists();
        if (seller == address(0)) revert InvalidSellerAddress();

        escrows[orderId] = EscrowOrder({
            orderId: orderId,
            buyer: msg.sender,
            createdAt: uint64(block.timestamp),
            status: EscrowStatus.FUNDED,
            seller: seller,
            timeoutTimestamp: uint64(block.timestamp + timeoutSeconds),
            coldChainCompliant: false,
            custodyAccepted: false,
            amountWei: msg.value,
            drugSerialNumber: drugSerialNumber
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
        if (order.amountWei == 0) revert EscrowNotFound();
        if (order.status != EscrowStatus.FUNDED) revert EscrowNotInFundedState();
        if (msg.sender != owner && msg.sender != order.buyer && msg.sender != order.seller) revert Unauthorized();
        if (msg.sender == order.seller) {
            if (custodyAccepted && !order.custodyAccepted) revert SellerCannotSelfConfirmCustody();
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
            if (!success) revert PayoutTransferFailed();
            emit EscrowReleased(orderId, order.seller, payout);
        }
    }

    function triggerSpoilageRefund(bytes32 orderId, string calldata breachReason) external nonReentrant {
        EscrowOrder storage order = escrows[orderId];
        if (order.amountWei == 0) revert EscrowNotFound();
        if (order.status != EscrowStatus.FUNDED) revert EscrowNotInFundedState();
        if (msg.sender != owner && msg.sender != order.buyer) revert Unauthorized();
        if (bytes(breachReason).length == 0) revert BreachReasonRequired();
        if (msg.sender == order.buyer) {
            if (order.custodyAccepted) revert CannotRefundAfterCustodyAccepted();
        }

        order.status = EscrowStatus.REFUNDED;
        _removeActiveOrder(orderId);
        uint256 refundAmount = order.amountWei;
        order.amountWei = 0;
        (bool success, ) = payable(order.buyer).call{value: refundAmount}("");
        if (!success) revert RefundTransferFailed();

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
        if (order.status != EscrowStatus.FUNDED || order.amountWei == 0) revert EscrowNotEligibleForUpkeep();

        if (actionType == 1) {
            if (!order.coldChainCompliant || !order.custodyAccepted) revert UpkeepConditionsNotMet();
            order.status = EscrowStatus.RELEASED;
            _removeActiveOrder(orderId);
            uint256 payout = order.amountWei;
            order.amountWei = 0;
            (bool success, ) = payable(order.seller).call{value: payout}("");
            if (!success) revert PayoutTransferFailed();
            emit EscrowReleased(orderId, order.seller, payout);
            emit UpkeepPerformed(orderId, 1, block.timestamp);
        } else if (actionType == 2) {
            if (block.timestamp <= order.timeoutTimestamp) revert TimeoutNotBreached();
            order.status = EscrowStatus.REFUNDED;
            _removeActiveOrder(orderId);
            uint256 refundAmount = order.amountWei;
            order.amountWei = 0;
            (bool success, ) = payable(order.buyer).call{value: refundAmount}("");
            if (!success) revert RefundTransferFailed();
            emit EscrowRefunded(orderId, order.buyer, refundAmount, "Chainlink Keeper SLA timeout refund");
            emit UpkeepPerformed(orderId, 2, block.timestamp);
        } else {
            revert UnknownUpkeepAction();
        }
    }

    function getEscrow(bytes32 orderId) external view returns (EscrowOrder memory) {
        return escrows[orderId];
    }

    function getActiveOrdersCount() external view returns (uint256) {
        return activeOrderIds.length;
    }
}
