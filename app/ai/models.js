/* ai/models.js — which model answers, and with what switched on.
 *
 * Moved out of server.js by the Phase 1 split in docs/architecture-audit-2026-09-15.md. Provider
 * keys, per-agent model resolution, and the per-agent tool switches. Keys stay server-side and are
 * never sent to the browser; /api/info reports the NAMES only.
 */
const ai = require('./loader');   // an agent's .md may carry its own `model:`

// ---- AI providers (keys stay server-side, never sent to the browser) ----
// Multiple agents (coder / tutor / quiz / grader) each get their own model, set in .env.
// A model spec is "<provider>:<model>", e.g. "ollama:qwen2.5-coder:7b",
// "openrouter:qwen/qwen-2.5-coder-7b", "anthropic:claude-sonnet-5".
// No prefix => DEFAULT_PROVIDER is used. Everything works on local Ollama or on OpenRouter.
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
// num_ctx is the WHOLE window: prompt + reply. The prompt now carries game.js, the other
// files, the lesson and recent turns, so 8192 was not enough — Ollama silently truncates the
// front of an over-long prompt, which drops the ops schema and produces malformed edits.
// 16384 fits a 7B model on a 16 GB GPU; lower it here if VRAM is tight.
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 16384);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 3072);
// Reasoning models (Qwen3.x and friends) think before answering. That thinking competes with
// num_predict, and on a short strict-JSON job it can eat the whole budget and return EMPTY
// content — the grader did exactly that. Every agent here wants a short structured answer, and
// a child is waiting, so thinking is off by default: measured 15s -> 1s on the grader with no
// loss of answer quality. Set OLLAMA_THINK=1 to turn it back on.
const OLLAMA_THINK = /^(1|true|yes|on)$/i.test(process.env.OLLAMA_THINK || '');

// ---- Tier 2: let an agent look things up instead of guessing ----
// Per-agent so it can be enabled where it pays (the coder) without slowing the tutor down.
// Off => Tier 1 behaviour exactly as before. Each tool round is another model call, so this
// trades latency for accuracy; the deterministic Tier 1 validators still run either way.
/* ON BY DEFAULT for the two agents that write or explain code, and the default changed deliberately.
   It used to be off everywhere, on the grounds that a tool round is another model call and the only
   thing to look up was a five-kilobyte cheat sheet covering twenty APIs. Both halves of that have
   changed: the lookup is now the complete Phaser reference, on disk, no network, and the cost of NOT
   looking things up is measurable.

   Measured, in fact. Asked four questions about the engine it is running, an agent with no tools
   said setTintFill "colors a sprite as a flat silhouette" (it is deprecated and does nothing in
   Phaser 4), invented a `restitution` parameter on setCollideWorldBounds that has never existed, and
   said Phaser.GameObjects.StencilReference was "made up" — it is a real class with ninety members.
   Three confidently wrong answers out of four, any of which written into a child's game is a crash
   or a silent no-op they cannot debug.

   A truthy env var still forces it on and an explicit 0 still forces it off; the change is only what
   happens when nobody has said. */
function agentTool(name, dflt) {
  const v = process.env[name];
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(v);
}
const AGENT_TOOLS = {
  coder:  agentTool('CODER_TOOLS', true),
  tutor:  agentTool('TUTOR_TOOLS', true),
  'lab-tutor': agentTool('TUTOR_TOOLS', true),
  /* The quiz and grader agents mark work against an answer that is already in their prompt; there
     is nothing for them to look up, so they keep paying nothing for the option. */
  quiz:   agentTool('QUIZ_TOOLS', false),
  grader: agentTool('GRADER_TOOLS', false),
  /* The design coach rides on TUTOR_TOOLS: it is the tutor's job on a different tab, and there is
     nothing on a design board for a tool to look up — the board is already in the prompt. */
  'design-coach': agentTool('TUTOR_TOOLS', true),
  /* The studio's mentor (V2) answers from where the kid is standing, which is in its prompt, in one or
     two sentences: a lookup would cost more than the answer is worth. */
  mentor: false,
  /* The interviewer (V2's hiring interview) knows nothing it could look up: it is a conversation. */
  interviewer: false
};
const MAX_TOOL_ROUNDS = Number(process.env.AI_TOOL_ROUNDS || 4);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AGENT_MODELS = {
  coder:  process.env.CODER_MODEL  || '',   // edits the game code
  tutor:  process.env.TUTOR_MODEL  || '',   // explains / answers questions
  quiz:   process.env.QUIZ_MODEL   || '',   // (scaffold) writes questions
  grader: process.env.GRADER_MODEL || ''    // (scaffold) checks work
};
const KNOWN_PROVIDERS = ['ollama', 'openrouter', 'anthropic'];
// Fallback model per provider, used when an agent has no model set in .env.
const PROVIDER_DEFAULT_MODEL = { ollama: OLLAMA_MODEL, anthropic: ANTHROPIC_MODEL, openrouter: OPENROUTER_MODEL };
// Precedence: .env per-agent spec > the agent file's `model:` > default provider.
function resolveModel(agent) {
  let spec = AGENT_MODELS[agent] || '';
  if (!spec) spec = ai.agentModel(agent) || '';
  /* The lab bench's tutor is the tutor — same job, different context — so it rides on TUTOR_MODEL
     unless someone deliberately gives it one of its own. Without this it had no entry in
     AGENT_MODELS at all, fell through to DEFAULT_PROVIDER, and a course configured for Anthropic
     tried to reach a local Ollama that was not running: "The AI service is not reachable". */
  if (!spec && (agent === 'lab-tutor' || agent === 'design-coach' || agent === 'mentor' || agent === 'interviewer')) spec = AGENT_MODELS.tutor || ai.agentModel('tutor') || '';
  if (!spec) spec = DEFAULT_PROVIDER + ':' + (PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER] || '');
  const i = spec.indexOf(':');
  // `agent` rides along so the usage meter can attribute a call without threading an extra
  // argument through every layer.
  if (i > 0 && KNOWN_PROVIDERS.indexOf(spec.slice(0, i)) >= 0) return { provider: spec.slice(0, i), model: spec.slice(i + 1), agent: agent };
  return { provider: DEFAULT_PROVIDER, model: spec, agent: agent };
}

module.exports = { DEFAULT_PROVIDER: DEFAULT_PROVIDER, OLLAMA_URL: OLLAMA_URL,
  OLLAMA_NUM_CTX: OLLAMA_NUM_CTX, OLLAMA_NUM_PREDICT: OLLAMA_NUM_PREDICT, OLLAMA_THINK: OLLAMA_THINK,
  ANTHROPIC_KEY: ANTHROPIC_KEY, ANTHROPIC_MODEL: ANTHROPIC_MODEL, OPENROUTER_KEY: OPENROUTER_KEY,
  OPENROUTER_MODEL: OPENROUTER_MODEL, OPENROUTER_URL: OPENROUTER_URL,
  MAX_TOOL_ROUNDS: MAX_TOOL_ROUNDS, AGENT_TOOLS: AGENT_TOOLS, agentTool: agentTool,
  resolveModel: resolveModel };
