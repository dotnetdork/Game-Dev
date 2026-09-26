const { chromium } = require(process.env.PW || "playwright");
(async () => { const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}); const p = await b.newPage({ viewport:{width:1366,height:900} }); const errs=[];
  p.on('pageerror',e=>errs.push(e.message)); await p.emulateMedia({ reducedMotion:'reduce' });
  await p.goto('file://'+process.argv[2]); const out=process.argv[3];
  const beat = ()=>p.$eval('#nBeat',e=>e.textContent);
  const grab = async (n)=>{ await p.evaluate(n=>{ const c=coins[n]; P.x=c.x-6; P.y=c.y-8; P.vy=0; }, n); await p.waitForTimeout(120); };
  // Answers are shuffled on every render, so pick them by their words, never by position.
  const opt = async (t)=>{ await p.locator('#opts .opt', { hasText: t }).first().click(); };
  const firstIsAlwaysRight = async ()=>{ const seen=new Set(); for (let k=0;k<8;k++){ await p.evaluate(()=>render()); seen.add(await p.$eval('#opts .opt', e=>e.textContent)); } return seen.size>1; };
  // The log keeps its history now, so "what was just said" is the lines added by the latest say().
  const said = ()=>p.$$eval('#log .msg.new', x=>x.map(e=>e.textContent).join(' '));
  const play = ()=>p.click('#bPlay');          // toggles Play / Stop
  const running = ()=>p.evaluate(()=>running);
  const log=[];
  await opt('Play the test sound'); await opt('Yes, I heard it');
  log.push('sound check -> ticket: '+(await said()).includes('feels dead'));
  log.push('one live region: '+await p.$$eval('[aria-live]', x=>x.length)+' | pips gone: '+!(await p.$('#pips')));
  await opt("Let's play it"); log.push(await beat());                      // ticket -> play
  log.push('play mode on: '+await p.$eval('#bPlay', e=>e.classList.contains('on')));
  const optsDuringPlay = await p.$$eval('#opts .opt', x=>x.length); log.push('options while playing: '+optsDuringPlay);
  await p.click('#tree button[data-key="coin"]');
  log.push('tap a part while playing -> refused: '+(await said()).includes('Press Stop first')+' | inspector open: '+await p.$eval('#inspector', e=>e.classList.contains('open')));
  await grab(0); log.push('after 1 coin: '+await beat()+' | announced: '+await p.$eval('#announce', e=>e.textContent));
  await grab(1); await p.waitForTimeout(700); log.push('after 2 coins: '+await beat());
  log.push('options shuffle: '+await firstIsAlwaysRight());
  await p.screenshot({path:out+'/spot.png'});
  await opt('The player is too slow'); await opt("OK, I'll play again");      // wrong answer -> play again
  log.push('after wrong answer: '+await beat());
  await grab(0); await grab(1); await p.waitForTimeout(700);
  await opt('Nothing happened when I grabbed a coin'); await p.waitForTimeout(300); await opt('How?');   // spot correct -> How?
  log.push('now at: '+await beat()+' | stopped: '+!(await running()));
  // Sounds belong to the parts: tap a part in the Hierarchy, then a sound on the shelf.
  const give = async (part, id)=>{ await p.click('#tree button[data-key="'+part+'"]'); await p.click('.snd[data-id="'+id+'"]'); };
  await p.click('#tree button[data-key="coin"]');
  log.push('coin inspector: '+await p.$eval('#inspName', e=>e.textContent)+' / '+await p.$eval('#inspBody', e=>e.textContent));
  // keyboard focus survives the rebuild after a shelf pick
  await p.focus('.snd[data-id="buzz"]'); await p.keyboard.press('Enter');
  log.push('focus kept on shelf: '+await p.evaluate(()=>document.activeElement.dataset.id));
  await give('player','buzz'); await give('lava','thud');
  log.push('challenged buzz: '+(await said()).includes('getting hurt'));
  await p.screenshot({path:out+'/challenge.png'});
  await opt('Oops, let me change it'); await give('coin','ding');
  log.push('challenged buzz on jump: '+(await said()).includes('went wrong'));
  await opt('Oops, let me change it'); await give('player','boing');
  log.push('still on sounds before playing: '+await beat()+' | still stopped: '+!(await running()));
  await play();
  await grab(0); await p.evaluate(()=>{ P.x=40; P.y=134; P.vy=0; }); await p.waitForTimeout(150); await p.evaluate(()=>{ keys[' ']=true; }); await p.waitForTimeout(150); await p.evaluate(()=>{ keys[' ']=false; }); await p.waitForTimeout(2300);
  log.push('after coin+jump (held for praise): '+await beat()+' | mix step starts stopped: '+!(await running()));
  await p.screenshot({path:out+'/mixer.png'});
  await play(); log.push('mixer locked while playing: '+await p.$eval('#inspector', e=>e.classList.contains('frozen')));
  await grab(0); log.push('coin with music louder -> still: '+await beat()+' | says what to do: '+(await said()).includes('grab a coin again'));
  await play();   // stop, then mix
  await p.evaluate(()=>{ const m=document.getElementById('mMusic'), s=document.getElementById('mSfx'); m.value=20; m.dispatchEvent(new Event('input')); s.value=90; s.dispatchEvent(new Event('input')); });
  await play(); await grab(1); await p.waitForTimeout(2300); log.push('after mixing + coin: '+await beat());
  log.push('code pane open: '+await p.$eval('#code', e=>e.classList.contains('open'))+' | stopped: '+!(await running()));
  await p.screenshot({path:out+'/code.png'});
  await opt('public float pitch = 1.0f;'); log.push('wrong line explained: '+(await said()).includes('only holds a number'));
  await p.waitForTimeout(1900);
  await opt('source.PlayOneShot(coinSound);'); log.push('line 13 highlighted: '+await p.$eval('#codeBody .ln:nth-child(13)', e=>e.classList.contains('hl')));
  await play(); await grab(0); log.push('coin at pitch 1.0 -> still: '+await beat());
  await p.fill('#tw','1.6'); await p.click('#save'); log.push('save while playing: '+await p.$eval('#console', e=>e.textContent)+' | pitch '+await p.evaluate(()=>pitch));
  await play();   // stop to edit
  await p.fill('#tw','abc'); await p.click('#save'); log.push('console error on abc: '+await p.$eval('#console', e=>e.className+' | '+e.textContent)+' | announced: '+(await p.$eval('#announce', e=>e.textContent)).includes('isn’t a number'));
  await p.fill('#tw','9'); await p.click('#save'); log.push('console on 9: '+await p.$eval('#console', e=>e.textContent));
  await p.fill('#tw','0.6f'); await p.click('#save'); await play(); await grab(0); log.push('coin at 0.6 -> still: '+await beat()+' | '+(await said()).includes('lower'));
  await play(); await p.fill('#tw','1.6'); await p.press('#tw','Enter'); await play(); await grab(1); await p.waitForTimeout(200);
  log.push('saved 1.6 + coin: '+await p.$eval('#console', e=>e.textContent)+' | code done: '+await p.$eval('.checks li:nth-child(5)', e=>e.className));
  await p.screenshot({path:out+'/code-done.png'});
  await opt('Back to the sound designer'); await p.waitForTimeout(900); log.push(await beat());
  log.push('prize in toolbar: '+await p.$eval('#toolchip', e=>!e.hidden));
  await p.screenshot({path:out+'/card.png'});
  await opt('Put it in my game'); log.push(await beat()+' | theme '+await p.evaluate(()=>theme)+' | parts: '+await p.$$eval('#tree button', x=>x.map(e=>e.dataset.key).join(',')));
  await grab(0); log.push('coin before Play does nothing: '+(await p.$$eval('.checks li.done', x=>x.length))+'/6');
  await play(); await grab(0); await p.waitForTimeout(600);
  log.push('quest done: '+(await p.$$eval('.checks li.done', x=>x.length))+'/6 | stars: '+await p.$eval('#starCount', e=>e.textContent));
  await p.screenshot({path:out+'/yours.png'});
  await opt('Done for today'); log.push(await beat()); await p.screenshot({path:out+'/later.png'});
  // Tap fast; the spam stop may fire on any of these taps (the "Done for today" tap counts too).
  for (const t of ['Angry buzz','No sound is fine','Angry buzz']) { if (await p.locator('#opts .opt', { hasText: t }).count()) await opt(t); }
  log.push('spam triggered on rapid answers: '+(await p.evaluate(()=>spamAt===i)));
  log.push('log keeps at most 8: '+await p.$$eval('#log .msg', x=>x.length));
  // The spooky path: the kid's choice becomes a theme on the same level, not a different level.
  await p.evaluate(()=>{ spookyOk=true; spooky=false; go(7); });
  await opt('Make it spooky'); log.push('spooky: '+await p.evaluate(()=>spooky+' '+theme+' floors '+YOURS.floors.length));
  console.log(log.join('\n')); console.log('errors', JSON.stringify(errs));
  const m = await b.newPage({ viewport:{width:390,height:844} }); await m.goto('file://'+process.argv[2]);
  console.log('mobile sw', await m.evaluate(()=>document.documentElement.scrollWidth)); await b.close(); })();
