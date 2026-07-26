export interface LedgerValue {
  key: string;
  value: unknown;
}

export class LedgerValidator {
  static validate(data: unknown): LedgerValue | null {
    if (!this.isObject(data)) {
      console.error('Invalid ledger data: not an object', data);
      return null;
    }

    const obj = data as Record<string, unknown>;
    if (!obj.key || typeof obj.key !== 'string') {
      console.error('Invalid ledger: missing or invalid key', obj);
      return null;
    }

    if (obj.value === undefined || obj.value === null) {
      console.error(`Invalid ledger value for key ${obj.key}`, obj.value);
      return null;
    }

    return { key: obj.key, value: obj.value };
  }

  static isObject(data: unknown): data is Record<string, unknown> {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  }

  static processLedgerStream(events: unknown[]): LedgerValue[] {
    const validated: LedgerValue[] = [];
    for (const event of events) {
      const valid = this.validate(event);
      if (valid) { validated.push(valid); }
      else { console.warn('Skipping malformed ledger entry'); }
    }
    return validated;
  }
}
