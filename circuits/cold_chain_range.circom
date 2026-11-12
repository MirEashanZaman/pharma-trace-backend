pragma circom 2.1.0;

template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1 = 0;
    var e2 = 1;
    for (var i = 0; i < n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * e2;
        e2 = e2 + e2;
    }
    lc1 === in;
}

template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;

    component n2b = Num2Bits(n + 1);
    n2b.in <== in[0] + (1 << n) - in[1];
    out <== 1 - n2b.out[n];
}

template LessEqThan(n) {
    signal input in[2];
    signal output out;

    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1] + 1;
    out <== lt.out;
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
