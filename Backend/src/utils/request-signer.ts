import crypto from 'crypto';

export class RequestSigner {
  private secret: string;

  constructor(secret: string = process.env.SIGNING_SECRET || '') {
    this.secret = secret;
  }

  sign(payload: Record<string, any>): string {
    const jsonString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.secret)
      .update(jsonString)
      .digest('hex');
  }

  verify(payload: Record<string, any>, signature: string): boolean {
    const expectedSignature = this.sign(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  signRequest(
    method: string,
    path: string,
    body: Record<string, any> = {}
  ): { signature: string; timestamp: number } {
    const timestamp = Date.now();
    const payload = { method, path, body, timestamp };
    return {
      signature: this.sign(payload),
      timestamp,
    };
  }

  verifyRequest(
    method: string,
    path: string,
    signature: string,
    timestamp: number,
    body: Record<string, any> = {},
    maxAgeMs: number = 300000
  ): boolean {
    if (Date.now() - timestamp > maxAgeMs) {
      return false;
    }
    const payload = { method, path, body, timestamp };
    return this.verify(payload, signature);
  }
}
