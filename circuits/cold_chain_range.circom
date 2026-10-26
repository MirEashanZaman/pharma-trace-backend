pragma circom 2.1.0;

template LessEqThan(n) {
    signal input in[2];
    signal output out;

    signal diff;
    diff <-- in[1] - in[0];

    signal bits[n];
    var acc = 0;
    for (var i = 0; i < n; i++) {
        bits[i] <-- (diff >> i) & 1;
        bits[i] * (bits[i] - 1) === 0;
        acc += bits[i] * (1 << i);
    }
    diff === acc;
    out <-- (in[0] <= in[1]) ? 1 : 0;
    out * (out - 1) === 0;
}

template ColdChainRangeCheck(N) {
    signal input temperatures[N];
    signal input minTemp;
    signal input maxTemp;
    signal input expectedBatchHash;

    signal output isCompliant;
    signal output batchHashMatch;

    component minChecks[N];
    component maxChecks[N];
    signal intermediateCompliance[N];

    for (var i = 0; i < N; i++) {
        minChecks[i] = LessEqThan(16);
        minChecks[i].in[0] <== minTemp;
        minChecks[i].in[1] <== temperatures[i];

        maxChecks[i] = LessEqThan(16);
        maxChecks[i].in[0] <== temperatures[i];
        maxChecks[i].in[1] <== maxTemp;

        if (i == 0) {
            intermediateCompliance[i] <== minChecks[i].out * maxChecks[i].out;
        } else {
            intermediateCompliance[i] <== intermediateCompliance[i - 1] * minChecks[i].out * maxChecks[i].out;
        }
    }

    isCompliant <== intermediateCompliance[N - 1];
    batchHashMatch <== expectedBatchHash * expectedBatchHash;
}

component main {public [minTemp, maxTemp, expectedBatchHash]} = ColdChainRangeCheck(10);
