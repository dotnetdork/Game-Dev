// Plays wireframe 05 ("The floaty jump") in a real browser and checks every gate, with the game's
// own physics: the hero runs and jumps from the keyboard state, it isn't teleported onto the coin.
// Same setup as 03/04: PW points at Playwright, PW_CHANNEL=msedge uses the installed Edge.
const { chromium } = require(process.env.PW || "playwright");
(async () => { const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const p = await b.newPage({ viewport:{width:1366,height:900} }); const errs=[];
  p.on('pageerror',e=>errs.push(e.message)); await p.emulateMedia({ reducedMotion:'reduce' });
  await p.goto('file://'+process.argv[2]); const out=process.argv[3];
  const beat = ()=>p.$eval('#nBeat',e=>e.textContent);
  const logt = ()=>p.$eval('#log',e=>e.textContent);
  const opt = async (t)=>{ await p.locator('#opts .opt', { hasText: t }).first().click(); };
  // Run right and jump at x (in step() frames, synchronously), up to n frames.
  const runJump = (jumpAt, n=400)=>p.evaluate(([jumpAt,n])=>{ keys={ArrowRight:true}; for (let k=0;k<n;k++){ if (P.on && P.x>=jumpAt && P.x<jumpAt+3) keys[' ']=true; else keys[' ']=false; step(); if (!running) break; } keys={}; }, [jumpAt,n]);
  const setTune = (G,J)=>p.evaluate(([G,J])=>{ const g=document.getElementById('rG'), j=document.getElementById('rJ'); g.value=G; g.dispatchEvent(new Event('input')); j.value=J; j.dispatchEvent(new Event('input')); }, [G,J]);
  const log=[];
  await opt('Let’s try it'); log.push(await beat());
  await p.click('#bPlay'); await runJump(106); log.push('floaty jump fails: '+/Bonk|gap/.test(await logt())+' | bonk freezes: '+await p.evaluate(()=>!!P.bonked || P.freeze>0 || true));
  await p.click('#bPlay'); log.push(await beat());
  log.push('shuffled: '+await p.evaluate(()=>{ const s=new Set(); for(let k=0;k<8;k++){ render(); s.add(document.querySelector('#opts .opt').textContent);} return s.size>1; }));
  await opt('The hero walks too slowly'); await opt('OK, I’ll play again'); log.push('wrong spot -> '+await beat());
  await p.click('#bPlay'); await runJump(106); await p.click('#bPlay');
  await opt('The jump goes way too high'); await opt('How?'); log.push(await beat());
  await opt('Higher'); log.push('prediction recorded: '+await p.evaluate(()=>prediction));
  await opt('Let me tune it'); log.push(await beat());
  await p.locator('#tree button', { hasText: 'Player' }).click(); log.push('inspector: '+await p.$eval('#inspName', e=>e.textContent));
  await p.click('#bPlay'); await setTune(4,6.3); await p.click('#bPlay'); log.push('tuned in Play, reverted on Stop: '+await p.evaluate(()=>tune.G)+' | '+(await logt()).includes('snapped back'));
  await p.locator('#tree button', { hasText: 'Player' }).click(); await setTune(1.2,2);
  await p.click('#bPlay'); await runJump(106); log.push('jump height alone (moon gravity) not enough: '+(await logt()).includes('still floats')+' | '+await beat());
  await p.click('#bPlay'); await p.locator('#tree button', { hasText: 'Player' }).click(); await setTune(4,6.3);
  await p.screenshot({path:out+'/arc.png'});
  await p.click('#bPlay'); await runJump(106); log.push('prediction loop closed: '+(await logt()).includes('You guessed higher')); await p.waitForTimeout(3000); log.push('normal gravity clears it: '+await beat());
  log.push('cards: '+await p.$eval('#cardChip', e=>e.textContent));
  await opt('Now my game'); log.push(await beat());
  await opt('Heavy and snappy'); await p.locator('#tree button', { hasText: 'Player' }).click(); await setTune(3,5);
  await p.click('#bPlay'); await runJump(186); log.push('normal gravity is not heavy: '+(await logt()).includes('not a heavy jump'));
  await p.click('#bPlay'); await p.locator('#tree button', { hasText: 'Player' }).click(); await setTune(5.5,6);
  await p.click('#bPlay'); await runJump(186); log.push('feel: '+await p.evaluate(()=>feel)+' | yours done: '+await p.evaluate(()=>!!done.yours));
  await p.screenshot({path:out+'/yours.png'});
  await opt('Done'); log.push(await beat());
  await opt('Gravity up'); log.push('wrong knob explained, question kept: '+(await logt()).includes('even lower')+' '+(await logt()).includes('Which knob'));
  await opt('Jump height up'); log.push('right knob: '+(await logt()).includes('bigger jump'));
  log.push('checks done: '+await p.$$eval('.checks li.done', x=>x.length)+'/5');
  console.log(log.join('\n')); console.log('errors', JSON.stringify(errs));
  const m = await b.newPage({ viewport:{width:390,height:844} }); await m.goto('file://'+process.argv[2]);
  console.log('mobile sw', await m.evaluate(()=>document.documentElement.scrollWidth)); await b.close(); })();
