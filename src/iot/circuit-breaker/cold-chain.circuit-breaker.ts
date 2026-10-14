export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
    state: CircuitState;
    consecutiveExcursions: number;
    threshold: number;
    lastExcursionTemp?: number;
    lastTrippedAt?: string;
    isTripActive: boolean;
}

export class ColdChainCircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private consecutiveExcursions: number = 0;
    private readonly threshold: number;
    private lastExcursionTemp?: number;
    private lastTrippedAt?: string;

    constructor(threshold: number = 3) {
        this.threshold = threshold;
    }

    recordTemperature(temp: number): CircuitBreakerStatus {
        const isExcursion = temp < 2.0 || temp > 8.0;

        if (isExcursion) {
            this.consecutiveExcursions++;
            this.lastExcursionTemp = temp;

            if (this.consecutiveExcursions >= this.threshold) {
                this.state = 'OPEN';
                this.lastTrippedAt = new Date().toISOString();
            }
        } else {
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.consecutiveExcursions = 0;
            } else if (this.state === 'CLOSED') {
                this.consecutiveExcursions = 0;
            }
        }

        return this.getStatus();
    }

    attemptReset(): CircuitBreakerStatus {
        if (this.state === 'OPEN') {
            this.state = 'HALF_OPEN';
        }
        return this.getStatus();
    }

    manualTrip(reasonTemp: number = 15.0): CircuitBreakerStatus {
        this.state = 'OPEN';
        this.lastExcursionTemp = reasonTemp;
        this.consecutiveExcursions = this.threshold;
        this.lastTrippedAt = new Date().toISOString();
        return this.getStatus();
    }

    getStatus(): CircuitBreakerStatus {
        return {
            state: this.state,
            consecutiveExcursions: this.consecutiveExcursions,
            threshold: this.threshold,
            lastExcursionTemp: this.lastExcursionTemp,
            lastTrippedAt: this.lastTrippedAt,
            isTripActive: this.state === 'OPEN',
        };
    }

    isBlocked(): boolean {
        return this.state === 'OPEN';
    }
}
