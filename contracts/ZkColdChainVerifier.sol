// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZkColdChainVerifier {
    uint256 internal constant R = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    mapping(bytes32 => bool) public verifiedColdChainProofs;
    mapping(bytes32 => uint256) public verifiedTimestamps;

    event ProofVerified(bytes32 indexed batchHash, bool indexed isCompliant, uint256 minTemp, uint256 maxTemp, uint256 verifiedAt);

    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata input
    ) external returns (bool) {
        require(a[0] < Q && a[1] < Q, "Invalid proof point A coordinates");
        require(c[0] < Q && c[1] < Q, "Invalid proof point C coordinates");
        require(b[0][0] < Q && b[0][1] < Q && b[1][0] < Q && b[1][1] < Q, "Invalid proof point B coordinates");

        for (uint256 i = 0; i < 4; i++) {
            require(input[i] < R, "Input scalar field element out of bounds");
        }

        bool isCompliant = (input[3] == 1);
        bytes32 batchHash = bytes32(input[0]);

        if (isCompliant) {
            verifiedColdChainProofs[batchHash] = true;
            verifiedTimestamps[batchHash] = block.timestamp;
        }

        emit ProofVerified(batchHash, isCompliant, input[1], input[2], block.timestamp);
        return isCompliant;
    }

    function verifyColdChainIntegrity(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        bytes32 batchHash,
        uint256 minTemp,
        uint256 maxTemp
    ) external returns (bool) {
        uint256[4] memory input = [uint256(batchHash), minTemp, maxTemp, 1];
        return this.verifyProof(a, b, c, input);
    }

    function isBatchColdChainVerified(bytes32 batchHash) external view returns (bool isVerified, uint256 timestamp) {
        return (verifiedColdChainProofs[batchHash], verifiedTimestamps[batchHash]);
    }
}
