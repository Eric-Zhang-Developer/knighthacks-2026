import { pathToFileURL } from "node:url";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Node 22+: node --experimental-strip-types lib/mentor/setup.ts [--create|--update].
// No flag is a local dry run. Never run concurrent setup commands for the same account.
// Retention is an explicit operator choice, not inferred from recordVoice.
export async function setupMentor(args = process.argv.slice(2), env: Record<string, string | undefined> = process.env) {
  if (args.length > 1 || (args.length === 1 && !["--create", "--update"].includes(args[0]))) throw new Error("Use no flag (dry run), --create, or --update.");
  // A URL import keeps this CLI runnable with Node's native TypeScript support, without a new TS runner.
  const { buildAgentDefinition, MENTOR_AGENT_NAME, MENTOR_AGENT_TAG, withCurrentMentorPolicy } = await import(new URL("./agent-config.ts", import.meta.url).href) as typeof import("./agent-config");
  const definition = buildAgentDefinition(env);
  if (!args.length) return { action: "dry-run", definition };
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required for explicit setup.");
  const target = env.ELEVENLABS_MENTOR_AGENT_ID?.trim();
  if (args[0] === "--create" && target) throw new Error("A mentor agent is configured. Use --update for that exact target.");
  if (args[0] === "--update" && (!target || !/^agent_[a-zA-Z0-9_-]+$/.test(target))) throw new Error("An exact ELEVENLABS_MENTOR_AGENT_ID is required for update.");
  const agents = new ElevenLabsClient({ apiKey }).conversationalAi.agents;
  const options = { timeoutInSeconds: 30, maxRetries: 0 };
  // Provider exceptions can contain keys and request bodies. Never expose them to CLI output.
  try {
    if (args[0] === "--create") {
      // A retry discovers our existing tagged agent instead of silently creating a duplicate.
      const existing = await agents.list({ tags: [MENTOR_AGENT_TAG], pageSize: 100 }, options);
      if (existing.agents.length || existing.hasMore) throw new Error("Mentor already exists");
      const result = await agents.create(definition, options);
      return { action: "created", agentId: result.agentId, instruction: "Set ELEVENLABS_MENTOR_AGENT_ID to this ID. Verify effective privacy, model, voice and a real interrupted session before release." };
    }
    const current = await agents.get(target!, {}, options);
    if (current.name !== MENTOR_AGENT_NAME || !current.tags?.includes(MENTOR_AGENT_TAG)) throw new Error("Target is not the managed mentor");
    // Preserve the operator-selected TTS model and unrelated turn/conversation
    // settings; only the reviewed naturalness and duration fields are changed.
    definition.conversationConfig.tts = { ...current.conversationConfig?.tts, ...definition.conversationConfig.tts };
    definition.conversationConfig.turn = { ...current.conversationConfig?.turn, ...definition.conversationConfig.turn };
    definition.conversationConfig.conversation = { ...current.conversationConfig?.conversation, ...definition.conversationConfig.conversation };
    // Retain operator additions (including named two-step confirmation) instead
    // of replacing the live agent prompt wholesale. The managed block is idempotent.
    const existingPrompt = current.conversationConfig?.agent?.prompt?.prompt;
    if (existingPrompt && definition.conversationConfig.agent?.prompt) {
      definition.conversationConfig.agent.prompt.prompt = withCurrentMentorPolicy(existingPrompt);
    }
    await agents.update(target!, definition, options);
    return { action: "updated", agentId: target, instruction: "Verify effective provider configuration and a real interrupted session before release." };
  } catch {
    throw new Error("Mentor setup did not complete. Check the exact target, existing mentor tag, account permissions and provider configuration. Do not blindly retry creation.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setupMentor().then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(() => {
    console.error("Mentor setup failed. Validate explicit configuration, retention choices, target ownership and provider access. No credentials or provider diagnostics are printed.");
    process.exitCode = 1;
  });
}
