import assert from "node:assert/strict";
import test from "node:test";
import { emailHtml, emailSubject, parseSignal } from "@/lib/notifications/email";

const payload = "0x7A91…e91F · Test signal. Delivery is working.\nhttps://sepolia.etherscan.io/tx/0xabc";

test("a stored signal splits into address, detail, and link", () => {
  assert.deepEqual(parseSignal(payload), {
    address: "0x7A91…e91F",
    detail: "Test signal. Delivery is working.",
    link: "https://sepolia.etherscan.io/tx/0xabc",
  });
});

test("the subject leads with the wallet and what happened", () => {
  assert.equal(emailSubject(parseSignal(payload)), "0x7A91…e91F · Test signal. Delivery is working.");
});

test("the html names the wallet, the signal, and a transaction link", () => {
  const html = emailHtml(parseSignal(payload));
  assert.match(html, /0x7A91…e91F/);
  assert.match(html, /Test signal\. Delivery is working\./);
  assert.match(html, /href="https:\/\/sepolia\.etherscan\.io\/tx\/0xabc"/);
  assert.match(html, /View the transaction/);
});

test("a wallet link and untrusted detail stay safe", () => {
  const html = emailHtml({
    address: "0xabc",
    detail: `<script>alert("x")</script>`,
    link: "https://sepolia.etherscan.io/address/0xabc",
  });
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /View the wallet/);
});
