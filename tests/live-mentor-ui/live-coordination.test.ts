import { expect, test, vi } from "vitest";
vi.mock("@elevenlabs/react", () => ({ ConversationProvider: ({ children }: { children: unknown }) => children, useConversation: vi.fn() }));
import { getState, setState } from "../../lib/store";
import { watchIdeaSelection } from "../../components/mentor/Live";

test("the store selection watcher supersedes tools only when the active idea changes and unsubscribes cleanly", () => {
  const original = getState().activeIdeaVersionId;
  setState({ activeIdeaVersionId: "version-a" });
  const turn = { current: 4 };
  const first = new AbortController(), second = new AbortController();
  const requests = new Set([first, second]);
  const stop = watchIdeaSelection(turn, requests);
  setState({ ideaDraft: "unrelated state" });
  expect(turn.current).toBe(4);
  expect(first.signal.aborted).toBe(false);
  setState({ activeIdeaVersionId: "version-b" });
  expect(turn.current).toBe(5);
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(true);
  expect(requests.size).toBe(0);
  const afterStop = new AbortController(); requests.add(afterStop); stop();
  setState({ activeIdeaVersionId: "version-c" });
  expect(turn.current).toBe(5);
  expect(afterStop.signal.aborted).toBe(false);
  setState({ activeIdeaVersionId: original });
});
