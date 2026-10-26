// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PharmaDigitalTwin {
    string public name = "PharmaTrace Digital Twin";
    string public symbol = "PTDT";
    address public owner;

    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISPENSER_ROLE = keccak256("DISPENSER_ROLE");

    enum ItemStatus { MINTED, IN_TRANSIT, DELIVERED, DISPENSED, BURNED }

    struct ItemMetadata {
        uint256 tokenId;
        string gtin;
        string batchNumber;
        string serialNumber;
        uint256 expirationDate;
        ItemStatus status;
        address currentHolder;
        string ipfsDossierCid;
    }

    mapping(uint256 => mapping(address => uint256)) public balances;
    mapping(uint256 => ItemMetadata) public itemDetails;
    mapping(string => uint256) public serialToTokenId;
    mapping(bytes32 => mapping(address => bool)) public roles;

    event ItemMinted(uint256 indexed tokenId, string indexed serialNumber, address indexed manufacturer, string gtin, string batchNumber);
    event CustodyTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);
    event ItemBurnedOnDispense(uint256 indexed tokenId, string indexed serialNumber, address indexed dispenser, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        roles[MANUFACTURER_ROLE][msg.sender] = true;
        roles[DISPENSER_ROLE][msg.sender] = true;
    }

    function grantRole(bytes32 role, address account) external onlyOwner {
        roles[role][account] = true;
    }

    function mintTwin(
        address to,
        string calldata gtin,
        string calldata batchNumber,
        string calldata serialNumber,
        uint256 expirationDate,
        string calldata ipfsDossierCid
    ) external returns (uint256) {
        require(msg.sender == owner || roles[MANUFACTURER_ROLE][msg.sender], "Unauthorized to mint digital twin");
        require(to != address(0), "Cannot mint digital twin to zero address");
        require(serialToTokenId[serialNumber] == 0, "Serial twin already exists");

        uint256 tokenId = uint256(keccak256(abi.encode(gtin, batchNumber, serialNumber)));
        balances[tokenId][to] = 1;
        serialToTokenId[serialNumber] = tokenId;

        itemDetails[tokenId] = ItemMetadata({
            tokenId: tokenId,
            gtin: gtin,
            batchNumber: batchNumber,
            serialNumber: serialNumber,
            expirationDate: expirationDate,
            status: ItemStatus.MINTED,
            currentHolder: to,
            ipfsDossierCid: ipfsDossierCid
        });

        emit ItemMinted(tokenId, serialNumber, to, gtin, batchNumber);
        return tokenId;
    }

    function transferCustody(
        address from,
        address to,
        uint256 tokenId
    ) external {
        require(msg.sender == from || msg.sender == owner, "Caller not authorized to transfer");
        require(to != address(0), "Cannot transfer custody to zero address");
        require(from != to, "Cannot transfer custody to self");
        require(balances[tokenId][from] >= 1, "Insufficient balance to transfer");
        require(itemDetails[tokenId].status != ItemStatus.BURNED, "Cannot transfer burned item");

        balances[tokenId][from] -= 1;
        balances[tokenId][to] += 1;
        itemDetails[tokenId].currentHolder = to;
        itemDetails[tokenId].status = ItemStatus.IN_TRANSIT;

        emit CustodyTransferred(tokenId, from, to, 1);
    }

    function burnOnDispense(
        string calldata serialNumber,
        address dispenser
    ) external returns (bool) {
        require(msg.sender == owner || roles[DISPENSER_ROLE][msg.sender], "Caller not authorized to dispense");
        require(dispenser != address(0), "Invalid dispenser address");
        uint256 tokenId = serialToTokenId[serialNumber];
        require(tokenId != 0, "Item does not exist");
        require(balances[tokenId][dispenser] >= 1, "Dispenser does not hold item");
        require(itemDetails[tokenId].status != ItemStatus.BURNED, "Item already burned or consumed");

        balances[tokenId][dispenser] = 0;
        itemDetails[tokenId].status = ItemStatus.BURNED;
        itemDetails[tokenId].currentHolder = address(0);

        emit ItemBurnedOnDispense(tokenId, serialNumber, dispenser, block.timestamp);
        return true;
    }

    function verifyAuthenticity(string calldata serialNumber) external view returns (bool exists, bool isAuthentic, bool isBurned, ItemStatus status, address holder) {
        uint256 tokenId = serialToTokenId[serialNumber];
        if (tokenId == 0) {
            return (false, false, false, ItemStatus.MINTED, address(0));
        }
        ItemMetadata memory item = itemDetails[tokenId];
        bool burned = (item.status == ItemStatus.BURNED);
        bool authentic = !burned && (block.timestamp <= item.expirationDate);
        return (true, authentic, burned, item.status, item.currentHolder);
    }
}
