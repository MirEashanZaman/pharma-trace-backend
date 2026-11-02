// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPharmaDigitalTwin {
    function transferCustody(address from, address to, uint256 tokenId) external;
    function mintTwin(
        address to,
        string calldata gtin,
        string calldata batchNumber,
        string calldata serialNumber,
        uint256 expirationDate,
        string calldata ipfsDossierCid
    ) external returns (uint256);
}

contract PharmaCrossChainBridge is Ownable, ReentrancyGuard {
    IPharmaDigitalTwin public digitalTwinContract;

    struct InboundTwinPayload {
        string gtin;
        string batchNumber;
        string serialNumber;
        uint256 expirationDate;
        string ipfsDossierCid;
        address recipient;
    }

    mapping(uint64 => bool) public supportedChainSelectors;
    mapping(bytes32 => bool) public processedMessageIds;
    mapping(address => bool) public authorizedRelayers;

    event OutboundTwinBridged(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed sender,
        address receiver,
        uint256 tokenId,
        string serialNumber
    );

    event InboundTwinReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address indexed recipient,
        uint256 newTokenId,
        string serialNumber
    );

    constructor(address _digitalTwin) Ownable(msg.sender) {
        require(_digitalTwin != address(0), "Invalid digital twin address");
        digitalTwinContract = IPharmaDigitalTwin(_digitalTwin);
        authorizedRelayers[msg.sender] = true;
    }

    function setDigitalTwin(address _digitalTwin) external onlyOwner {
        require(_digitalTwin != address(0), "Invalid address");
        digitalTwinContract = IPharmaDigitalTwin(_digitalTwin);
    }

    function setSupportedChain(uint64 chainSelector, bool supported) external onlyOwner {
        supportedChainSelectors[chainSelector] = supported;
    }

    function setAuthorizedRelayer(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        authorizedRelayers[relayer] = authorized;
    }

    function bridgeOutbound(
        uint64 destinationChainSelector,
        address receiver,
        uint256 tokenId,
        string calldata serialNumber
    ) external nonReentrant returns (bytes32) {
        require(supportedChainSelectors[destinationChainSelector], "Unsupported destination chain selector");
        require(receiver != address(0), "Invalid receiver");

        digitalTwinContract.transferCustody(msg.sender, address(this), tokenId);

        bytes32 messageId = keccak256(
            abi.encode(
                block.chainid,
                destinationChainSelector,
                tokenId,
                msg.sender,
                receiver,
                block.timestamp
            )
        );

        emit OutboundTwinBridged(
            messageId,
            destinationChainSelector,
            msg.sender,
            receiver,
            tokenId,
            serialNumber
        );

        return messageId;
    }

    function relayInboundMessage(
        bytes32 messageId,
        uint64 sourceChainSelector,
        InboundTwinPayload calldata payload
    ) external nonReentrant returns (uint256) {
        require(authorizedRelayers[msg.sender], "Caller is not an authorized bridge relayer");
        require(!processedMessageIds[messageId], "Message already processed");
        require(payload.recipient != address(0), "Invalid payload recipient");

        processedMessageIds[messageId] = true;

        uint256 newTokenId = digitalTwinContract.mintTwin(
            payload.recipient,
            payload.gtin,
            payload.batchNumber,
            payload.serialNumber,
            payload.expirationDate,
            payload.ipfsDossierCid
        );

        emit InboundTwinReceived(
            messageId,
            sourceChainSelector,
            payload.recipient,
            newTokenId,
            payload.serialNumber
        );

        return newTokenId;
    }
}
