// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PharmaPaymaster is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;
        uint256 preVerificationGas;
        bytes32 gasFees;
        bytes paymasterAndData;
        bytes signature;
    }

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    address public verifyingSigner;
    address public entryPoint;
    uint256 public constant VALID_TIMESTAMP_OFFSET = 3600;

    mapping(bytes32 => bool) public executedUserOpHashes;

    event GasSponsored(address indexed sender, uint256 validUntil, uint256 validAfter, bytes32 indexed userOpHash);
    event SignerUpdated(address indexed previousSigner, address indexed newSigner);
    event EntryPointUpdated(address indexed previousEntryPoint, address indexed newEntryPoint);
    event FundsDeposited(address indexed sender, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event PostOpExecuted(PostOpMode mode, bytes context, uint256 actualGasCost);

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Sender is not EntryPoint");
        _;
    }

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

    function setEntryPoint(address _newEntryPoint) external onlyOwner {
        address old = entryPoint;
        entryPoint = _newEntryPoint;
        emit EntryPointUpdated(old, _newEntryPoint);
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

    function validateSponsorship(
        address sender,
        bytes32 userOpHash,
        uint48 validUntil,
        uint48 validAfter,
        bytes calldata signature
    ) public view returns (bool) {
        if (block.timestamp < validAfter || (validUntil != 0 && block.timestamp > validUntil)) {
            return false;
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, address(this), validUntil, validAfter, sender, userOpHash)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ethSignedHash.recover(signature);

        return recovered == verifyingSigner;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        if (entryPoint != address(0)) {
            require(msg.sender == entryPoint, "Caller not EntryPoint");
        }

        (uint48 validUntil, uint48 validAfter, bytes calldata signature) = parsePaymasterAndData(userOp.paymasterAndData);

        bool valid = validateSponsorship(userOp.sender, userOpHash, validUntil, validAfter, signature);
        if (!valid) {
            return ("", 1);
        }

        executedUserOpHashes[userOpHash] = true;
        emit GasSponsored(userOp.sender, validUntil, validAfter, userOpHash);

        context = abi.encode(userOp.sender, maxCost);
        validationData = (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
        return (context, validationData);
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256
    ) external {
        if (entryPoint != address(0)) {
            require(msg.sender == entryPoint, "Caller not EntryPoint");
        }
        emit PostOpExecuted(mode, context, actualGasCost);
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
