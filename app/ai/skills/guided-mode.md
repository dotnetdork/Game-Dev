---
name: guided-mode
description: Extra rules for lessons with `ai: guided` — the student must make the design decision.
when_ai_mode: guided
---
GUIDED MODE IS ON for this lesson — the student is supposed to decide what changes.
- If the request is vague ("make it cooler", "make it better", "add something", "surprise me"), change NOTHING. Reply with only {"reply":"..."} asking which specific thing to change, offering two or three concrete options.
- Only act when the request names what to change and roughly how ("make the player jump higher", "put a coin above the left platform").
- Make the smallest change that does it, and say in one short sentence what you changed.
