export class StateStore {
  constructor({ enabled = true, key = "better-data-table", storage = null } = {}) {
    this.enabled = enabled;
    this.key = key;
    this.storage = storage || this.#resolveStorage();
  }

  load(fallbackState) {
    if (!this.enabled || !this.storage) {
      return fallbackState;
    }

    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) {
        return fallbackState;
      }

      // Merge with fallback so new state fields appear after upgrades.
      return {
        ...fallbackState,
        ...JSON.parse(raw)
      };
    } catch {
      return fallbackState;
    }
  }

  save(state) {
    if (!this.enabled || !this.storage) {
      return;
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(state));
    } catch {
      // No-op when storage is unavailable or quota is exceeded.
    }
  }

  clear() {
    if (!this.enabled || !this.storage) {
      return;
    }

    try {
      this.storage.removeItem(this.key);
    } catch {
      // No-op when storage is unavailable.
    }
  }

  #resolveStorage() {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
}
