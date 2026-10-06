import assert from "node:assert/strict";
import test from "node:test";
import { eventsFromSolanaTransaction, type SolanaTransaction } from "./solana";

const FOCUS = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV";
const DEST = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

function tx(overrides: Partial<SolanaTransaction> = {}): SolanaTransaction {
  return {
    slot: 10,
    blockTime: 1_700_000_000,
    meta: {
      err: null,
      fee: 5000,
      preBalances: [2_000_000_000, 0],
      postBalances: [999_995_000, 1_000_000_000],
    },
    transaction: {
      signatures: ["sig1"],
      message: { accountKeys: [{ pubkey: FOCUS }, { pubkey: DEST }] },
    },
    ...overrides,
  };
}

test("a sol transfer ignores the fee", () => {
  const [event] = eventsFromSolanaTransaction(FOCUS, tx(), 150);
  assert.equal(event?.asset, "SOL");
  assert.equal(event?.direction, "out");
  assert.equal(event?.amount, "1");
  assert.equal(event?.amountUsd, 150);
  assert.equal(event?.to.address, DEST);
  assert.match(event?.summary ?? "", /Sent/);
});

test("a fee-only transaction is a program call", () => {
  const [event] = eventsFromSolanaTransaction(
    FOCUS,
    tx({ meta: { err: null, fee: 5000, preBalances: [1_000_000_000, 0], postBalances: [999_995_000, 0] } }),
    150,
  );
  assert.equal(event?.type, "contract");
  assert.equal(event?.summary, "Called a program");
});

test("failed transactions are dropped", () => {
  const events = eventsFromSolanaTransaction(FOCUS, tx({ meta: { err: { InstructionError: [] }, fee: 5000 } }), 150);
  assert.equal(events.length, 0);
});

test("an spl balance change becomes a transfer", () => {
  const [event] = eventsFromSolanaTransaction(
    FOCUS,
    tx({
      meta: {
        err: null,
        fee: 5000,
        preBalances: [1_000_000_000],
        postBalances: [999_995_000],
        preTokenBalances: [],
        postTokenBalances: [
          {
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            owner: FOCUS,
            uiTokenAmount: { amount: "2500000", decimals: 6, uiAmountString: "2.5" },
          },
        ],
      },
    }),
    150,
  );
  assert.equal(event?.asset, "USDC");
  assert.equal(event?.direction, "in");
  assert.equal(event?.amount, "2.5");
  assert.equal(event?.amountUsd, 3);
});
