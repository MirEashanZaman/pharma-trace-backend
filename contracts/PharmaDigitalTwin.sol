// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155SupplyUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import {ERC1155URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155URIStorageUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract PharmaDigitalTwin is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    ERC1155URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    string public name;
    string public symbol;

    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
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

    mapping(uint256 => ItemMetadata) public itemDetails;
    mapping(string => uint256) public serialToTokenId;
    mapping(bytes32 => uint256) public batchToTokenId;
    mapping(bytes32 => mapping(address => bool)) public roles;

    event ItemMinted(uint256 indexed tokenId, string indexed serialNumber, address indexed manufacturer, string gtin, string batchNumber);
    event BatchTwinMinted(uint256 indexed batchTokenId, string indexed batchNumber, address indexed manufacturer, uint256 totalUnits);
    event CustodyTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);
    event ItemBurnedOnDispense(uint256 indexed tokenId, string indexed serialNumber, address indexed dispenser, uint256 timestamp);

    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __ERC1155_init("https://pharmatrace.io/api/v1/metadata/{id}.json");
        __ERC1155Supply_init();
        __ERC1155URIStorage_init();
        __Ownable_init(initialOwner);

        name = "PharmaTrace Digital Twin";
        symbol = "PTDT";

        roles[MANUFACTURER_ROLE][initialOwner] = true;
        roles[DISTRIBUTOR_ROLE][initialOwner] = true;
        roles[DISPENSER_ROLE][initialOwner] = true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function grantRole(bytes32 role, address account) external onlyOwner {
        roles[role][account] = true;
    }

    function revokeRole(bytes32 role, address account) external onlyOwner {
        roles[role][account] = false;
    }

    function mintTwin(
        address to,
        string calldata gtin,
        string calldata batchNumber,
        string calldata serialNumber,
        uint256 expirationDate,
        string calldata ipfsDossierCid
    ) external returns (uint256) {
        require(msg.sender == owner() || roles[MANUFACTURER_ROLE][msg.sender], "Unauthorized to mint digital twin");
        require(to != address(0), "Cannot mint digital twin to zero address");
        require(serialToTokenId[serialNumber] == 0, "Serial twin already exists");

        uint256 tokenId = uint256(keccak256(abi.encode(gtin, batchNumber, serialNumber)));
        _mint(to, tokenId, 1, "");
        _setURI(tokenId, string(abi.encodePacked("https://pharmatrace.io/verify/", gtin, "/", serialNumber)));

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

    function mintBatchTwin(
        address to,
        string calldata gtin,
        string calldata batchNumber,
        uint256 totalQuantity,
        uint256 expirationDate,
        string calldata ipfsDossierCid
    ) external returns (uint256) {
        require(msg.sender == owner() || roles[MANUFACTURER_ROLE][msg.sender], "Unauthorized to mint digital twin");
        require(to != address(0), "Cannot mint to zero address");
        bytes32 batchKey = keccak256(abi.encodePacked(gtin, batchNumber));
        require(batchToTokenId[batchKey] == 0, "Batch twin already exists");

        uint256 batchTokenId = uint256(batchKey);
        _mint(to, batchTokenId, totalQuantity, "");
        _setURI(batchTokenId, string(abi.encodePacked("https://pharmatrace.io/batch/", batchNumber)));

        batchToTokenId[batchKey] = batchTokenId;

        itemDetails[batchTokenId] = ItemMetadata({
            tokenId: batchTokenId,
            gtin: gtin,
            batchNumber: batchNumber,
            serialNumber: "BATCH_CONTAINER",
            expirationDate: expirationDate,
            status: ItemStatus.MINTED,
            currentHolder: to,
            ipfsDossierCid: ipfsDossierCid
        });

        emit BatchTwinMinted(batchTokenId, batchNumber, to, totalQuantity);
        return batchTokenId;
    }

    function transferCustody(
        address from,
        address to,
        uint256 tokenId
    ) external {
        require(msg.sender == from || msg.sender == owner() || isApprovedForAll(from, msg.sender), "Caller not authorized to transfer");
        require(to != address(0), "Cannot transfer custody to zero address");
        require(from != to, "Cannot transfer custody to self");
        require(balanceOf(from, tokenId) >= 1, "Insufficient balance to transfer");
        require(itemDetails[tokenId].status != ItemStatus.BURNED, "Cannot transfer burned item");

        _safeTransferFrom(from, to, tokenId, 1, "");
        itemDetails[tokenId].currentHolder = to;
        itemDetails[tokenId].status = ItemStatus.IN_TRANSIT;

        emit CustodyTransferred(tokenId, from, to, 1);
    }

    function burnOnDispense(
        string calldata serialNumber,
        address dispenser
    ) external returns (bool) {
        require(msg.sender == owner() || roles[DISPENSER_ROLE][msg.sender], "Caller not authorized to dispense");
        require(dispenser != address(0), "Invalid dispenser address");
        uint256 tokenId = serialToTokenId[serialNumber];
        require(tokenId != 0, "Item does not exist");
        require(balanceOf(dispenser, tokenId) >= 1, "Dispenser does not hold item");
        require(itemDetails[tokenId].status != ItemStatus.BURNED, "Item already burned or consumed");

        _burn(dispenser, tokenId, 1);
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

    function uri(uint256 tokenId) public view virtual override(ERC1155Upgradeable, ERC1155URIStorageUpgradeable) returns (string memory) {
        return super.uri(tokenId);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        super._update(from, to, ids, values);
    }
}
