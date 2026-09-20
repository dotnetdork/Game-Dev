/* ai/provider.js — one turn with a model, and the tool loop around it.
 *
 * Moved out of server.js by the Phase 1 split in docs/architecture-audit-2026-09-15.md. Three
 * providers behind one shape: chatOnce() normalises Anthropic, OpenRouter and Ollama into the same
 * { content, assistant, toolCalls }, and callAI() runs the lookup rounds on top of it.
 */
const usage = require('./usage');
const tools = require('./tools');
const models = require('./models');
/* Only for extractJSON, in the round-0 shortcut below. guards.js requires nothing at all — it is
   the pure half of the AI story — so this cannot make a cycle. */
const { extractJSON } = require('./guards');

const { DEFAULT_PROVIDER, OLLAMA_URL, OLLAMA_NUM_CTX, OLLAMA_NUM_PREDICT, OLLAMA_THINK,
  ANTHROPIC_KEY, OPENROUTER_KEY, OPENROUTER_URL, MAX_TOOL_ROUNDS } = models;

/* NOTHING USED TO BOUND HOW LONG A STUDENT'S QUESTION COULD TAKE, and a tester watched the builder
   think for five or six minutes and produce nothing.
   The arithmetic behind that: one answer is up to MAX_TOOL_ROUNDS lookups plus a final call, and the
   coder can run that whole thing five times over (the first attempt plus one corrective retry per
   guard). Twenty-five model calls, in sequence, none of them with a deadline — and on a laptop
   there is no platform timeout to stop it either. Hosted, Vercel kills the function at maxDuration
   and the handler never resumes, so the request that most needed recording is the one that logs
   nothing at all.
   Two deadlines, therefore: one per call, and one for the whole request. Both come back as a normal
   thrown error, which every caller already turns into "the AI is not reachable right now" — a
   sentence a child can act on, arriving in seconds instead of never.

   A BUDGET ABOVE THE PLATFORM'S OWN TIMEOUT IS DECORATION. This defaulted to 110s against Vercel's
   60s function ceiling (app/vercel.json), so hosted, the budget could never fire: Vercel killed the
   function first and the request that most needed recording logged nothing — the exact outcome the
   paragraph above says this prevents. The default is under the ceiling now. A laptop on slow Ollama
   that genuinely needs longer sets AI_TOTAL_BUDGET_MS in .env, where the platform is its own. */
const CALL_TIMEOUT_MS = Number(process.env.AI_CALL_TIMEOUT_MS || 45000);
const TOTAL_BUDGET_MS = Number(process.env.AI_TOTAL_BUDGET_MS || 50000);

/* THE DEADLINE BELONGS TO THE REQUEST, NOT TO THE MODULE.
   It was a module-level `let` for a day, on the reasoning that it is written and read inside one
   request's unbroken chain of awaits. That reasoning is wrong the moment two students press send at
   the same time: one warm instance serves both, the second request overwrites the first's deadline,
   and the first inherits a budget that starts later than its own clock. On a Sunday with three
   children on one deployment, concurrent requests are the expected case rather than the edge one.
   So it rides on `spec` — the per-request object resolveModel() already builds fresh every time and
   already threads through callAI into chatOnce, which is where the signal is needed. A spec with no
   deadline on it (the boot banner, /api/info) just gets the per-call limit. */
function budgetLeft(spec) {
  const deadline = spec && spec.deadline;
  if (!deadline) return CALL_TIMEOUT_MS;
  return Math.max(0, deadline - Date.now());
}
/* The signal for one provider call: whichever runs out first, this call's own limit or what is left
   of the whole request's budget.

   The no-deadline fallback used to be written `budgetLeft(spec) || CALL_TIMEOUT_MS`, which made the
   throw below unreachable: budgetLeft returns 0 when the deadline has passed, 0 is falsy, so an
   exhausted budget handed the next call a fresh 45 seconds instead of stopping. The fallback is
   only for a spec with no deadline at all, which is asked here rather than inferred from a zero. */
function callSignal(spec) {
  const ms = (spec && spec.deadline) ? budgetLeft(spec) : CALL_TIMEOUT_MS;
  const use = Math.min(CALL_TIMEOUT_MS, ms);
  if (use <= 0) throw new Error('out of time for this question');
  return AbortSignal.timeout(use);
}

/* One turn with the model. Returns { content, assistant, toolCalls } — toolCalls is empty
   unless tools were offered and the model chose to use one. `msgs` is the running conversation
   (history, the new message, and any tool traffic already exchanged). */
async function chatOnce(spec, system, msgs, wantJSON, withTools) {
  const provider = spec.provider, model = spec.model;
  if (provider === 'anthropic') {
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    const body = { model: model, max_tokens: 4000, system: system, messages: msgs };
    if (withTools) body.tools = tools.anthropicSpecs();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: callSignal(spec)
    });
    if (!r.ok) throw new Error('Anthropic HTTP ' + r.status);
    const d = await r.json();
    usage.record(spec.agent || 'unknown', provider, model, d);
    const blocks = d.content || [];
    return {
      content: blocks.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''),
      assistant: { role: 'assistant', content: blocks },
      toolCalls: blocks.filter(function (b) { return b.type === 'tool_use'; })
        .map(function (b) { return { id: b.id, name: b.name, args: b.input || {} }; })
    };
  }
  if (provider === 'openrouter') {
    if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set');
    const body = { model: model, messages: [{ role: 'system', content: system }].concat(msgs) };
    if (wantJSON && !withTools) body.response_format = { type: 'json_object' };   // json mode and tools conflict
    if (withTools) body.tools = tools.toolSpecs();
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: callSignal(spec)
    });
    if (!r.ok) throw new Error('OpenRouter HTTP ' + r.status);
    const d = await r.json();
    usage.record(spec.agent || 'unknown', provider, model, d);
    const m = (d.choices && d.choices[0] && d.choices[0].message) || {};
    return {
      content: m.content || '',
      assistant: m,
      toolCalls: (m.tool_calls || []).map(function (c) {
        let a = {}; try { a = typeof c.function.arguments === 'string' ? JSON.parse(c.function.arguments || '{}') : (c.function.arguments || {}); } catch (e) {}
        return { id: c.id, name: c.function.name, args: a };
      })
    };
  }
  // default: local Ollama
  const body = { model: model, stream: false, options: { num_ctx: OLLAMA_NUM_CTX, num_predict: OLLAMA_NUM_PREDICT, temperature: 0.3 },
    messages: [{ role: 'system', content: system }].concat(msgs) };
  if (wantJSON && !withTools) body.format = 'json';       // Ollama ignores tool calls in strict json mode
  if (withTools) body.tools = tools.toolSpecs();
  if (!OLLAMA_THINK) body.think = false;
  let r = await fetch(OLLAMA_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: callSignal(spec) });
  if (!r.ok && body.think === false) { delete body.think; r = await fetch(OLLAMA_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: callSignal(spec) }); }
  if (!r.ok) throw new Error('Ollama HTTP ' + r.status);
  const d = await r.json();
  const m = d.message || {};
  return {
    content: m.content || d.response || '',
    assistant: m,
    toolCalls: (m.tool_calls || []).map(function (c) { return { id: c.id, name: c.function.name, args: c.function.arguments || {} }; })
  };
}

/* The message that carries a tool's answer back to the model. */
function toolResultMessage(provider, call, result) {
  const text = JSON.stringify(result);
  if (provider === 'anthropic') {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: call.id, content: text }] };
  }
  return { role: 'tool', tool_call_id: call.id, name: call.name, content: text };
}

/* ---- the final call has to SAY it is the final call ----
 *
 * THE BUG THIS FIXES, IN FULL, BECAUSE IT COST A BETA TESTER AN ANSWER. A student asked Build for
 * an fps counter. The model spent all four rounds looking things up — actualFps, then TimeStep,
 * then config.js, then Text.setOrigin — so the loop above ended by RUNNING OUT, not by the model
 * finishing. The final call then went out with the same conversation and the tools removed, and the
 * model, still part way through working it out, simply carried on thinking out loud: "Good,
 * setOrigin exists on text objects. I'll add the FPS counter using create/update snippets." That is
 * not JSON, so it became the reply, and a twelve-year-old read a sentence about setOrigin and got
 * no fps counter.
 *
 * Nothing in that conversation ever told the model the lookups were over. It had no way to know the
 * turn it was answering was its last one. So this adds the one sentence that says so.
 *
 * Appended to the last message rather than sent as a new one: after a tool round that message is a
 * user turn carrying tool_result blocks, and Anthropic wants tool results and the text that follows
 * them in the same turn. When the last message is not a user turn (the model stopped calling tools
 * on its own), a fresh user turn is correct and is what happens. */
function answerNow(provider, msgs, wantJSON) {
  const nudge = 'The tools are switched off for this reply — there are no more lookups. '
    + (wantJSON
      ? 'Answer now with the single JSON object your instructions describe, and nothing else. If you '
        + 'were part way through working something out, finish it and put the change in that object: a '
        + 'sentence saying what you were going to do is not a change and the student will see nothing.'
      : 'Answer the student now, in plain language, using what you have already looked up.');
  const out = msgs.slice();
  const last = out[out.length - 1];
  if (last && last.role === 'user') {
    out[out.length - 1] = Array.isArray(last.content)
      ? { role: 'user', content: last.content.concat([{ type: 'text', text: nudge }]) }
      : { role: 'user', content: String(last.content) + '\n\n' + nudge };
  } else {
    out.push({ role: 'user', content: nudge });
  }
  return out;
}

/* `onTool` is optional and is called once per tool the model actually invoked, with the call and
   what came back. Hooked here rather than inside tools.runTool because this is the only place that
   knows WHOSE request it is — runTool takes the prompt context, and threading an identity through
   that would mean putting it in an object whose keys get rendered into prompts. This sees exactly
   what runTool sees, including a model asking for a tool that does not exist: that comes back as
   `{error}` rather than throwing, so it is invisible everywhere else. */
async function callAI(spec, system, user, wantJSON, history, toolCtx, onTool) {
  const provider = spec.provider, model = spec.model;
  if (!model) throw new Error('No model set for ' + provider + ' — set it in .env');
  const msgs = (history || []).concat([{ role: 'user', content: user }]);

  if (!toolCtx) return (await chatOnce(spec, system, msgs, wantJSON, false)).content;

  // Two phases, because strict JSON mode and tool calling are mutually exclusive on Ollama:
  // asking for JSON suppresses tool calls entirely (the model invents a fake tool result
  // instead). So phase 1 lets it look things up with JSON mode OFF, and phase 2 asks for the
  // real answer with tools off and JSON back on, with the tool results in the conversation.
  //
  // WITH ONE SHORTCUT, AND IT IS HALF OF EVERY CODER REQUEST. A JSON agent that needed no lookup
  // answered in full on round 0 — and this threw that answer away and asked the same question
  // again with tools off, because phase-1 output was never trusted for a JSON agent. Two model
  // calls for every Build message, where the tutor spends one. So: if it already came back as
  // JSON that parses, that IS the answer. It is not trusted any further than before — the
  // deterministic guards in routes/ai.js run on it either way — and anything that does not parse
  // still falls through to the proper final call below.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await chatOnce(spec, system, msgs, false, true);
    if (!turn.toolCalls.length) {
      if (!wantJSON) return turn.content;     // plain-text agent: this is already the answer
      if (extractJSON(turn.content)) return turn.content;
      break;                                  // not usable JSON: fall through and ask properly
    }
    msgs.push(turn.assistant);
    turn.toolCalls.forEach(function (call) {
      const result = tools.runTool(call.name, call.args, toolCtx);
      if (onTool) { try { onTool(call, result); } catch (e) { /* never break a lookup to log one */ } }
      msgs.push(toolResultMessage(provider, call, result));
    });
  }
  return (await chatOnce(spec, system, answerNow(provider, msgs, wantJSON), wantJSON, false)).content;
}

module.exports = { chatOnce: chatOnce, callAI: callAI, toolResultMessage: toolResultMessage,
  CALL_TIMEOUT_MS: CALL_TIMEOUT_MS, TOTAL_BUDGET_MS: TOTAL_BUDGET_MS };
