class CircuitBreaker {
  constructor({ failureThreshold = 3, cooldownMs = 60_000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.failures = 0;
    this.openedAt = null;
  }

  isOpen() {
    if (!this.openedAt) return false;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      // Half-open reset after cooldown
      this.openedAt = null;
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.openedAt = Date.now();
    }
  }
}

module.exports = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 });