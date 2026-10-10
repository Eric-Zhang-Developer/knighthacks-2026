# Idea interview: how voice reaches the questions

Context: the spec says the questions are "read into the composer" and a spoken answer fills the focused field. Server
text-to-speech (voice-replies-api) was cut, and pressing the hold-to-talk button moves focus off the answer field.

Options: A) speak the questions with browser speech synthesis; B) show the questions in the composer (the idea panel)
and send a committed utterance to the last answer field the user focused; C) send every utterance to the idea text.

Choice: B. Nothing new is spoken, so there's no new provider or permission. The questions are on screen in the same
panel as the draft. While the interview shows, a committed utterance goes into the last focused answer, and the
draft is put back so the idea text stays what the user wrote. With no answer focused, voice appends to the draft
as before.

How to undo: remove the draft subscription in `components/interview/index.tsx`; utterances then go to the draft only.
