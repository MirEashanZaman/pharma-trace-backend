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

template GreaterEqThan(n) {
    signal input in[2];
    signal output out;

    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1];
    out <== 1 - lt.out;
}

template InRange(n) {
    signal input val;
    signal input min;
    signal input max;
    signal output inRange;

    component geMin = GreaterEqThan(n);
    geMin.in[0] <== val;
    geMin.in[1] <== min;

    component leMax = LessEqThan(n);
    leMax.in[0] <== val;
    leMax.in[1] <== max;

    inRange <== geMin.out * leMax.out;
}

template ColdChainVerifier(N) {
    signal input temperatures[N];
    signal input minTemp;
    signal input maxTemp;
    signal input batchHash;

    signal output isCompliant;
    signal output batchHashMatch;

    component rangeChecks[N];
    signal intermediateCompliance[N];

    for (var i = 0; i < N; i++) {
        rangeChecks[i] = InRange(16);
        rangeChecks[i].val <== temperatures[i];
        rangeChecks[i].min <== minTemp;
        rangeChecks[i].max <== maxTemp;

        if (i == 0) {
            intermediateCompliance[i] <== rangeChecks[i].inRange;
        } else {
            intermediateCompliance[i] <== intermediateCompliance[i - 1] * rangeChecks[i].inRange;
        }
    }

    isCompliant <== intermediateCompliance[N - 1];
    batchHashMatch <== batchHash * batchHash;
}

component main {public [minTemp, maxTemp, batchHash]} = ColdChainVerifier(10);
