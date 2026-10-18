// Minimal ambient types for the official opentimestamps client (CJS, no .d.ts).
// We only use the surface below; everything else stays `unknown`.
declare module 'opentimestamps/index.js' {
  interface VerifyResult {
    bitcoin?: { timestamp: number; height: number };
    litecoin?: { timestamp: number; height: number };
  }
  const OpenTimestamps: {
    Ops: { OpSHA256: new () => unknown };
    DetachedTimestampFile: {
      fromHash(op: unknown, hash: Buffer): unknown;
      fromBytes(op: unknown, data: Buffer): unknown;
      deserialize(bytes: Uint8Array): unknown;
    };
    /** Stamps one or many detached files (arrays are batched as a merkle tree). */
    stamp(detached: unknown | unknown[]): Promise<void>;
    /** Pull deeper (Bitcoin-block) attestations into the receipt when available. */
    upgrade(detached: unknown, options?: { timeout?: number }): Promise<boolean>;
    /** Recompute attestations against public block explorers. */
    verify(detachedOts: unknown, detached: unknown, options?: { ignoreBitcoinNode?: boolean; timeout?: number }): Promise<VerifyResult | undefined>;
    /** Human-readable op tree; contains PendingAttestation while not yet anchored. */
    info(detached: unknown): string;
  };
  export = OpenTimestamps;
}
