"use client";

import { setState, useAppState } from "@/lib/store";

// A first idea is the hardest one: a few example sparks, one tap from the Idea card's textbox. Examples, not data:
// tapping one only fills the draft, which the person edits before anything is saved. Gone once there's a draft or
// an idea, so they never crowd a returning user.
const SPARKS = [
  "A study buddy that turns lecture notes into quick quizzes",
  "An app that matches volunteers with local food banks",
  "A tool that helps roommates split chores fairly",
  "A browser extension that reads long articles aloud for people with dyslexia",
];

export default function Starters() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const draft = useAppState((s) => s.ideaDraft);
  if (active || draft.trim()) return null;
  return (
    <div className="shell-starters" role="group" aria-label="Idea starters">
      <p>Need a spark? Start from one of these and make it yours.</p>
      <ul>
        {SPARKS.map((s) => (
          <li key={s}>
            <button type="button" onClick={() => setState({ ideaDraft: s })}>
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
