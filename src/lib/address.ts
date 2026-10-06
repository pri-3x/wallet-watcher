export function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** A Solana address is base58 and stays case-sensitive. */
export function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export function isTxHash(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function isEnsName(value: string) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(value.trim());
}

export function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export function shortAddress(address: string, head = 6, tail = 4) {
  const value = address.trim();
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
