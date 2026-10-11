# Era board: release dates and where tool use is read

Context: the spec asks for three dated tool releases, checked against their sources before merge, and for tool-use
counts from `classes.json`. The shared loader in `lib/classes` (galaxy-classes-ui) validates `classes.json` but its
schema doesn't keep `dev_tools`.

Release dates, checked 2026-10-10:
- GitHub Copilot technical preview, 2021-06-29: GitHub blog, "Introducing GitHub Copilot: your AI pair programmer"
  ("Today, we are launching a technical preview of GitHub Copilot"). Fetched directly.
- ChatGPT, 2022-11-30: OpenAI, "Introducing ChatGPT". The page returns 403 to automated fetches, so the date was
  read from Wikipedia's ChatGPT infobox, which cites that page. The link points to OpenAI's page.
- Claude Code research preview, 2025-02-24: Anthropic, "Claude 3.7 Sonnet and Claude Code" ("Claude Code is
  available as a limited research preview"). Fetched directly.

Options for tool use: A) extend `lib/classes` (not owned here); B) read `/api/classes` again in `components/era/` with
a schema for only `corpus_version` and `dev_tools`.

Choice: B. One small fetch of a file the browser has usually cached already, and the corpus-version check matches
`lib/classes`. A star the file doesn't list counts as "not stated", never as "didn't use".

How to undo: once `lib/classes` keeps `dev_tools`, read it from `useClasses` and delete `parseToolUse`.
