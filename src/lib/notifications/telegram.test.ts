import assert from "node:assert/strict";
import test from "node:test";
import { chatIdFor, chatsFromUpdates } from "@/lib/notifications/telegram";

test("recent messages collapse to one row per chat, latest label wins", () => {
  const chats = chatsFromUpdates([
    { message: { chat: { id: 10, first_name: "Pri" } } },
    { message: { chat: { id: 10, username: "pri" } } },
    { message: { chat: { id: -100, title: "Desk" } } },
    { message: {} },
  ]);
  assert.deepEqual(chats, [
    { id: "10", label: "@pri" },
    { id: "-100", label: "Desk" },
  ]);
});

test("a username resolves only after that chat has messaged the bot", () => {
  const chats = [
    { id: "10", label: "@pri21x" },
    { id: "11", label: "Pri" },
  ];
  assert.equal(chatIdFor("@pri21x", chats), "10");
  assert.equal(chatIdFor("pri21x", chats), "10");
  assert.equal(chatIdFor("4242", chats), "4242");
  assert.equal(chatIdFor("@someone_else", chats), null);
});
