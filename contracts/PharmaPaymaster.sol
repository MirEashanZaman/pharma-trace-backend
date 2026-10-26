// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PharmaPaymaster is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    address public verifyingSigner;
    uint256 public constant VALID_TIMESTAMP_OFFSET = 3600;

    mapping(bytes32 => bool) public executedUserOpHashes;

    event GasSponsored(address indexed sender, uint256 validUntil, uint256 validAfter, bytes32 indexed userOpHash);
    event SignerUpdated(address indexed previousSigner, address indexed newSigner);
    event FundsDeposited(address indexed sender, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);

    constructor(address _verifyingSigner) Ownable(msg.sender) {
        require(_verifyingSigner != address(0), "Invalid verifying signer");
        verifyingSigner = _verifyingSigner;
    }

    function setVerifyingSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid new signer");
        address old = verifyingSigner;
        verifyingSigner = _newSigner;
        emit SignerUpdated(old, _newSigner);
    }

    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes calldata signature)
    {
        require(paymasterAndData.length >= 52, "Invalid paymasterAndData length");
        validUntil = uint48(bytes6(paymasterAndData[20:26]));
        validAfter = uint48(bytes6(paymasterAndData[26:32]));
        signature = paymasterAndData[32:];
    }

    function toEthSignedMessageHash(bytes32 hash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function validateSponsorship(
        address sender,
        bytes32 userOpHash,
        uint48 validUntil,
        uint48 validAfter,
        bytes calldata signature
    ) public view returns (bool) {
        if (block.timestamp < validAfter || block.timestamp > validUntil) {
            return false;
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(this), validUntil, validAfter, sender, userOpHash)
        );
        bytes32 ethSignedHash = toEthSignedMessageHash(messageHash);
        address recovered = ethSignedHash.recover(signature);

        return recovered == verifyingSigner;
    }

    function sponsorTransaction(
        address sender,
        bytes32 userOpHash,
        uint48 validUntil,
        uint48 validAfter,
        bytes calldata signature
    ) external returns (bool) {
        require(validateSponsorship(sender, userOpHash, validUntil, validAfter, signature), "Invalid sponsorship validation");
        require(!executedUserOpHashes[userOpHash], "UserOperation hash already executed");

        executedUserOpHashes[userOpHash] = true;
        emit GasSponsored(sender, validUntil, validAfter, userOpHash);
        return true;
    }

    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid withdrawal address");
        require(address(this).balance >= amount, "Insufficient contract balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdraw transfer failed");
        emit FundsWithdrawn(to, amount);
    }
}
