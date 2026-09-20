// ============================================================
//  Token and cost meter.
//
//  Every provider returns how many tokens a request actually used;
//  we used to throw that away. This records it, prices it, and keeps
//  a running total so you can see what a testing session costs while
//  you are testing, not on a bill next month.
//
//  IMPORTANT: this is an ESTIMATE. The provider's own dashboard is
//  the authority on what you owe. Prices below are hardcoded and go
//  stale; an unlisted model reports tokens with no cost rather than
//  guessing a number that looks official and is wrong.
//
//  Totals are in memory and reset when the server restarts. That was
//  deliberate on a laptop — it measures a session, and persisting spend
//  figures invites treating them as the real ledger.
//
//  ON SERVERLESS IT IS NO LONGER TRUE, and /api/usage is misleading there:
//  every cold start begins again, so the numbers describe one instance's
//  lifetime rather than an afternoon. Each call is therefore ALSO written
//  through telemetry.record, which survives because it is a line of stdout;
//  add those up from a session capture for the real figure. The provider's
//  own dashboard remains the authority either way.
// ============================================================
const tel = require('../telemetry');

/* USD per million tokens, [input, output]. From each provider's public pricing,
   checked 11 August 2026. Update alongside any model change. */
const PRICES = {
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5-20251001': [0.8, 4],
  'anthropic/claude-opus-5': [5, 25],
  'anthropic/claude-sonnet-5': [2, 10],
  'openai/gpt-5.6-sol': [5, 30],
  'openai/gpt-5.6-terra': [1, 6],
  'google/gemini-3.6-flash': [1.5, 7.5],
  'google/gemini-3.5-flash-lite': [0.3, 2.5],
  'deepseek/deepseek-v4-flash-0731': [0.08, 0.18],
  'qwen/qwen3.8-max': [2, 6]
};

const state = { since: Date.now(), calls: 0, inTokens: 0, outTokens: 0, cost: 0, priced: 0, unpriced: 0, byAgent: {} };

/* There was a listener bus here — `listeners`, onRecord() and emit() — for a /api/usage/stream
   endpoint that was never written. emit() was never called and onRecord() was never exported, so it
   had been dead since the day it was typed. The live view it was meant to provide exists now and is
   a different thing: each call is also written to telemetry.record below, which tools/session-
   capture.js streams to a terminal. */

/* Providers name the same two numbers differently. Anthropic also reports cache traffic, which
   is billed at other rates — counted as input here, so a cached run reads slightly high rather
   than silently omitting tokens. */
function readUsage(provider, body) {
  const u = (body && body.usage) || null;
  if (!u) return null;
  if (provider === 'anthropic') {
    return {
      in: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      out: u.output_tokens || 0
    };
  }
  return { in: u.prompt_tokens || 0, out: u.completion_tokens || 0 };   // openrouter / openai shape
}

function priceOf(model) { return PRICES[model] || null; }

/* Record one model call. Never throws — a metering bug must not break a student's request. */
function record(agent, provider, model, body) {
  try {
    if (provider === 'ollama') return null;            // local: no bill to track
    const u = readUsage(provider, body);
    if (!u) return null;
    const p = priceOf(model);
    const cost = p ? (u.in * p[0] + u.out * p[1]) / 1e6 : 0;

    state.calls++; state.inTokens += u.in; state.outTokens += u.out; state.cost += cost;
    if (p) state.priced++; else state.unpriced++;

    const a = state.byAgent[agent] || (state.byAgent[agent] = { calls: 0, inTokens: 0, outTokens: 0, cost: 0, model: model });
    a.calls++; a.inTokens += u.in; a.outTokens += u.out; a.cost += cost; a.model = model;

    console.log('[usage] ' + agent + ' ' + model + '  in ' + u.in + ' out ' + u.out
      + (p ? '  $' + cost.toFixed(4) + '  session $' + state.cost.toFixed(3) : '  (no price for this model)'));
    /* AND ONE THAT SURVIVES. The totals above live in module memory, which on a serverless platform
       measures the lifetime of one instance rather than a session — the header of this file still
       calls that deliberate, and it stopped being true the day this deployed. A capture of these
       lines can be added up afterwards and gives the real figure for an afternoon. */
    tel.record('model', { agent: agent, provider: provider, model: model, in: u.in, out: u.out, cost: Number(cost.toFixed(5)) });
    return { in: u.in, out: u.out, cost: cost };
  } catch (e) { return null; }
}

function summary() {
  const mins = Math.max(1, Math.round((Date.now() - state.since) / 60000));
  return {
    note: 'Estimate from token counts returned by the provider. Your provider dashboard is the authority.',
    since: new Date(state.since).toISOString(),
    minutesRunning: mins,
    calls: state.calls,
    inputTokens: state.inTokens,
    outputTokens: state.outTokens,
    estimatedCostUSD: Number(state.cost.toFixed(4)),
    callsWithoutAPrice: state.unpriced,
    byAgent: Object.keys(state.byAgent).map(function (k) {
      const a = state.byAgent[k];
      // lastModel, not model: comparing two models on the same agent is the point of testing,
      // and the totals then span both. Naming it honestly beats labelling the row with whichever
      // model happened to run last.
      return { agent: k, lastModel: a.model, calls: a.calls, inputTokens: a.inTokens, outputTokens: a.outTokens,
        estimatedCostUSD: Number(a.cost.toFixed(4)),
        avgCostPerCallUSD: a.calls ? Number((a.cost / a.calls).toFixed(4)) : 0 };
    })
  };
}

function reset() {
  state.since = Date.now(); state.calls = 0; state.inTokens = 0; state.outTokens = 0;
  state.cost = 0; state.priced = 0; state.unpriced = 0; state.byAgent = {};
}

module.exports = { record: record, summary: summary, reset: reset, PRICES: PRICES };
