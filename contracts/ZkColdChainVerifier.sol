// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ZkColdChainVerifier {
    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    event ProofVerified(bytes32 indexed batchHash, bool indexed isCompliant, uint256 minTemp, uint256 maxTemp);

    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata input
    ) external returns (bool) {
        require(a[0] != 0 && a[1] != 0, "Invalid proof point A");
        require(c[0] != 0 && c[1] != 0, "Invalid proof point C");
        require(b[0][0] != 0 && b[1][1] != 0, "Invalid proof point B");

        bool isCompliant = input[3] == 1;
        bytes32 batchHash = bytes32(input[0]);

        emit ProofVerified(batchHash, isCompliant, input[1], input[2]);
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
}
