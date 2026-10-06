import assert from "node:assert/strict";
import test from "node:test";
import { addressOk, findChain, historyUrl, rpcUrl, walletHref } from "./catalog";

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const SOL = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV";

test("evm and solana addresses stay on their own chains", () => {
  assert.equal(addressOk("polygon", VITALIK), true);
  assert.equal(addressOk("solana", VITALIK), false);
  assert.equal(addressOk("solana", SOL), true);
  assert.equal(addressOk("ethereum", SOL), false);
  assert.equal(addressOk("nope", VITALIK), false);
});

test("wallet links name the chain", () => {
  assert.equal(walletHref(VITALIK, "base", { tx: "0xabc" }), `/wallet/${VITALIK}?chain=base&tx=0xabc`);
});

test("a sepolia RPC override does not leak onto polygon", () => {
  const previousNetwork = process.env.ETHEREUM_NETWORK;
  const previousRpc = process.env.ETHEREUM_RPC_URL;
  process.env.ETHEREUM_NETWORK = "sepolia";
  process.env.ETHEREUM_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/test";
  try {
    assert.match(rpcUrl(findChain("sepolia")!), /alchemy/);
    assert.equal(rpcUrl(findChain("polygon")!), "https://polygon-bor-rpc.publicnode.com");
    assert.equal(rpcUrl(findChain("ethereum")!), "https://ethereum-rpc.publicnode.com");
  } finally {
    process.env.ETHEREUM_NETWORK = previousNetwork;
    process.env.ETHEREUM_RPC_URL = previousRpc;
  }
});

test("history stays off solana", () => {
  assert.equal(historyUrl(findChain("solana")!), null);
  assert.match(historyUrl(findChain("polygon")!) ?? "", /polygon\.blockscout\.com/);
});
