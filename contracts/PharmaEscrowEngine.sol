// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PharmaEscrowEngine {
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

    event EscrowFunded(bytes32 indexed orderId, address indexed buyer, address indexed seller, uint256 amountWei, string drugSerialNumber);
    event EscrowReleased(bytes32 indexed orderId, address indexed seller, uint256 amountWei);
    event EscrowRefunded(bytes32 indexed orderId, address indexed buyer, uint256 amountWei, string reason);
    event ComplianceUpdated(bytes32 indexed orderId, bool coldChainCompliant, bool custodyAccepted);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
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

        emit EscrowFunded(orderId, msg.sender, seller, msg.value, drugSerialNumber);
        return true;
    }

    function recordComplianceAndHandshake(
        bytes32 orderId,
        bool coldChainCompliant,
        bool custodyAccepted
    ) external {
        EscrowOrder storage order = escrows[orderId];
        require(order.amountWei > 0, "Escrow not found");
        require(order.status == EscrowStatus.FUNDED, "Escrow not in funded state");
        require(msg.sender == owner || msg.sender == order.buyer || msg.sender == order.seller, "Unauthorized to record compliance");

        order.coldChainCompliant = coldChainCompliant;
        order.custodyAccepted = custodyAccepted;

        emit ComplianceUpdated(orderId, coldChainCompliant, custodyAccepted);

        if (coldChainCompliant && custodyAccepted) {
            order.status = EscrowStatus.RELEASED;
            uint256 payout = order.amountWei;
            order.amountWei = 0;
            (bool success, ) = payable(order.seller).call{value: payout}("");
            require(success, "Payout transfer failed");
            emit EscrowReleased(orderId, order.seller, payout);
        }
    }

    function triggerSpoilageRefund(bytes32 orderId, string calldata breachReason) external {
        EscrowOrder storage order = escrows[orderId];
        require(order.amountWei > 0, "Escrow not found");
        require(order.status == EscrowStatus.FUNDED, "Escrow not in funded state");
        require(msg.sender == owner || msg.sender == order.buyer, "Unauthorized to trigger refund");

        order.status = EscrowStatus.REFUNDED;
        uint256 refundAmount = order.amountWei;
        order.amountWei = 0;
        (bool success, ) = payable(order.buyer).call{value: refundAmount}("");
        require(success, "Refund transfer failed");

        emit EscrowRefunded(orderId, order.buyer, refundAmount, breachReason);
    }

    function getEscrow(bytes32 orderId) external view returns (EscrowOrder memory) {
        return escrows[orderId];
    }
}
