import { expect, test, vi } from "vitest";
vi.mock("@elevenlabs/react", () => ({ ConversationProvider: ({ children }: { children: unknown }) => children, useConversation: vi.fn() }));
import { supersedeTools } from "../../components/mentor/Live";

test("selecting another idea advances the turn and aborts every pending client tool", () => {
  const turn = { current: 4 };
  const first = new AbortController(), second = new AbortController();
  const requests = new Set([first, second]);
  supersedeTools(turn, requests);
  expect(turn.current).toBe(5);
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(true);
  expect(requests.size).toBe(0);
});
