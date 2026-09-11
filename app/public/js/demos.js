/* demos.js — the little live pictures that sit between a run cell's code and its output.
 *
 * A slider cell shows a student a NUMBER changing. For a lot of the ideas in this course the number
 * is the least interesting part: "each frame gets 20 milliseconds" means nothing at ten, and
 * "gravity = 0.5" means nothing at any age. What means something is watching the box lurch when you
 * drag the frame rate down to four, and watching the ball hang in the air when you drag gravity to
 * zero. So a run cell can opt into one of these with a directive:
 *
 *     // @demo: frames
 *
 * and a canvas appears under the editor, driven by the same sliders that drive the code.
 *
 * ---------------------------------------------------------------------------------------------
 * HOW THESE RUN, AND THE ONE RULE THAT MATTERS
 *
 * The student's run cell already executes inside a sandboxed iframe, and so does this. The demo is
 * a SEPARATE frame from the code sandbox on purpose: the code sandbox is rebuilt from scratch on
 * every slider input, and rebuilding an animation sixty times while a child drags a slider would
 * restart it sixty times. This one is built once and then fed new values over postMessage.
 *
 * Because the frame is sandboxed with an opaque origin, the only way a draw function can get in
 * there is as TEXT — widgets.js calls .toString() on it and inlines the source. Which gives the
 * rule:
 *
 *     A DRAW FUNCTION MAY NOT REFERENCE ANYTHING FROM THIS FILE'S SCOPE.
 *
 * No shared constants, no helper defined next to it, no DEMOS lookup. Its source is lifted out of
 * here and dropped somewhere else, and anything it closed over is simply gone. It fails at runtime,
 * inside a frame, which is the most annoying place to debug — so the harness catches the error and
 * paints the message onto the canvas rather than leaving a mystery blank box.
 *
 * What a draw function CAN use is whatever the harness itself defines, because the source is
 * inlined into the harness's own scope. That is the helpers listed below, and nothing else.
 *
 * ---------------------------------------------------------------------------------------------
 * THE CONTRACT
 *
 *   draw(ctx, W, H, v, t, s, dt, P)
 *
 *     ctx  a 2d context, already scaled for the display, cleared before every call
 *     W,H  the size in CSS pixels — read these, never canvas.width
 *     v    the slider values, by name, exactly as the code cell sees them. ALWAYS default them
 *          (`var g = v.gravity != null ? v.gravity : 0.5`) — a demo is often shared by two cells
 *          that have different sliders, and a cell can be edited out from under it.
 *     t    milliseconds of PLAYING time. Frozen while paused, so a paused demo redraws the same
 *          frame when a slider moves, instead of jumping.
 *     s    a scratch object that survives between frames. Put your simulation state here.
 *     dt   milliseconds since the last frame, clamped to 64 so a backgrounded tab does not
 *          teleport a physics demo through the floor.
 *     P    the app's palette, read from the real CSS custom properties at build time:
 *          bg panel line ink muted dim azure gold teal green brand
 *
 *   Harness helpers in scope: clamp(n,a,b)  lerp(a,b,k)  rr(x,y,w,h,r)  txt(s,x,y,size,col,align)
 *
 *   aspect  height as a fraction of width, clamped by widgets.js to something sensible. These sit
 *           inside a reading column, so they are wide and short by nature.
 *
 * Draw on transparent — the cell paints the background, so the demo inherits the card it sits on.
 */
const DEMOS = {

  /* what-an-engine-does. The whole lesson is "sixty times a second, forever", and the number on its
     own does not land. Two things move: a ghost that moves smoothly, and the real box, which is
     only allowed to move `fps` times a second. At 60 they sit on top of each other. At 4 the box
     lurches along behind a ghost it can never catch, which IS the lesson. */
  frames: {
    aspect: 0.34,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var fps = clamp(v.fps != null ? v.fps : 60, 1, 120);
      var step = 1000 / fps;
      var pad = 22, trackW = W - pad * 2, y = H * 0.34, box = 18;
      var period = 2600;

      // Where a perfectly smooth thing would be, and where something redrawn `fps` times is.
      var smooth = (t % period) / period;
      var quant = ((Math.floor(t / step) * step) % period) / period;

      // The track.
      ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad, y + box / 2); ctx.lineTo(pad + trackW, y + box / 2); ctx.stroke();

      // The ghost: where it would be if the screen could redraw infinitely often.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = P.dim;
      rr(pad + smooth * (trackW - box), y - box / 2 + box / 2 - box / 2, box, box, 4); ctx.fill();
      ctx.globalAlpha = 1;

      // The real one.
      ctx.fillStyle = P.azure;
      rr(pad + quant * (trackW - box), y - box / 2 + box / 2 - box / 2, box, box, 4); ctx.fill();

      /* One second of frames, drawn to scale. At 4 fps you can count the gaps; by 60 they have
         fused into a solid bar, which is a fair picture of why nobody sees individual frames. */
      var ry = H * 0.72, rh = 14;
      txt('one second', pad, ry - 9, 10, P.dim, 'left');
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.strokeRect(pad + 0.5, ry + 0.5, trackW - 1, rh - 1);
      ctx.fillStyle = P.teal;
      var n = Math.round(fps), wEach = trackW / n;
      for (var i = 0; i < n; i++) {
        var x = pad + i * wEach;
        ctx.fillRect(x + 0.5, ry + 1, Math.max(0.6, wEach - 1.5), rh - 2);
      }
      txt(Math.round(fps) + ' fps', pad + trackW, ry - 9, 10, P.muted, 'right');
      txt(step.toFixed(1) + ' ms each', pad + trackW, ry + rh + 13, 10, P.gold, 'right');
      txt(fps < 12 ? 'you can see it stepping' : (fps < 30 ? 'still a bit choppy' : 'looks continuous'),
        pad, ry + rh + 13, 10, P.dim, 'left');
    }
  },

  /* physics-and-collision. Gravity is a number you add to a speed every frame, and that sentence is
     unreadable until you have watched the same ball with the number set to zero. */
  gravity: {
    aspect: 0.40,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var g = v.gravity != null ? v.gravity : 0.5;
      var sp = v.speed != null ? v.speed : 40;
      var floor = H - 16, r = 9, k = dt / 16.7;   // k = how many 60ths of a second this frame was

      if (!s.on) { s.on = 1; s.x = 24; s.y = 24; s.vy = 0; s.trail = []; }
      s.vy += g * k;
      s.y += s.vy * k;
      s.x += (sp * 3) * (dt / 1000);
      if (s.y > floor - r) { s.y = floor - r; s.vy = -Math.abs(s.vy) * 0.62; if (Math.abs(s.vy) < 0.6) s.vy = 0; }
      if (s.x > W - 20) { s.x = 24; s.y = 24; s.vy = 0; s.trail.length = 0; }

      s.trail.push([s.x, s.y]);
      if (s.trail.length > 44) s.trail.shift();

      // The ground.
      ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, floor + 0.5); ctx.lineTo(W, floor + 0.5); ctx.stroke();

      // Where it has been, so the shape of the arc is visible and not just the ball.
      for (var i = 0; i < s.trail.length; i++) {
        ctx.globalAlpha = (i / s.trail.length) * 0.30;
        ctx.fillStyle = P.azure;
        ctx.beginPath(); ctx.arc(s.trail[i][0], s.trail[i][1], r * 0.7, 0, 6.284); ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = P.gold;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.284); ctx.fill();

      txt('gravity ' + g.toFixed(1) + (g === 0 ? '  — nothing pulls it down' : ''), 14, 18, 11, g === 0 ? P.gold : P.muted, 'left');
      txt('speed ' + Math.round(sp), W - 14, 18, 11, P.muted, 'right');
    }
  },

  /* sprites-and-animation. A flipbook is the only honest explanation of an animation, and it is one
     a child can see in two seconds: the same drawing, swapped. Shared by the frames/end cell and
     the moveSpeed cell, so every value is defaulted. */
  walk: {
    aspect: 0.36,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      /* Two different cells drive this. The one with a `frames` slider is building a walk cycle
         from scratch; the one with an `end` slider is choosing frames off a sheet of eight, so the
         sheet has to BE eight there or the slider would clamp against a sheet that is too small. */
      var frames = Math.round(clamp(v.frames != null ? v.frames : (v.end != null ? 8 : 4), 1, 8));
      var end = Math.round(clamp(v.end != null ? v.end : frames - 1, 0, frames - 1));
      var mv = v.moveSpeed != null ? v.moveSpeed : 140;
      var playing = end + 1;                       // frames 0..end are the ones that actually play
      var idx = Math.floor(t / 110) % Math.max(1, playing);

      // The character, walking on the spot at the top, moving across at moveSpeed.
      if (!s.on) { s.on = 1; s.x = 30; }
      s.x += mv * (dt / 1000);
      if (s.x > W - 20) s.x = 20;

      var by = H * 0.34, bh = 22, bw = 14;
      ctx.fillStyle = P.azure;
      rr(s.x - bw / 2, by - bh, bw, bh, 3); ctx.fill();
      // Legs, swung by the frame index, which is the whole trick.
      var swing = Math.sin((idx / Math.max(1, playing)) * 6.284) * 7;
      ctx.strokeStyle = P.azure; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, by); ctx.lineTo(s.x + swing, by + 9);
      ctx.moveTo(s.x, by); ctx.lineTo(s.x - swing, by + 9);
      ctx.stroke();
      ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, by + 10.5); ctx.lineTo(W, by + 10.5); ctx.stroke();

      // The sheet, with the frames that never play greyed out.
      var pad = 22, cw = Math.min(38, (W - pad * 2) / frames), sy = H * 0.62;
      for (var i = 0; i < frames; i++) {
        var x = pad + i * cw, live = i <= end;
        ctx.globalAlpha = live ? 1 : 0.25;
        ctx.fillStyle = (i === idx && live) ? P.gold : P.panel;
        rr(x, sy, cw - 4, cw - 4, 3); ctx.fill();
        ctx.strokeStyle = (i === idx && live) ? P.gold : P.line; ctx.lineWidth = 1;
        rr(x + 0.5, sy + 0.5, cw - 5, cw - 5, 3); ctx.stroke();
        txt(String(i), x + (cw - 4) / 2, sy + (cw - 4) / 2 + 4, 11, (i === idx && live) ? P.bg : P.dim, 'center');
        ctx.globalAlpha = 1;
      }
      txt(playing + ' of ' + frames + ' frames playing', pad, H - 6, 10, P.dim, 'left');
      txt(Math.round(mv) + ' px a second', W - pad, H - 6, 10, P.dim, 'right');
    }
  },

  /* input-movement-collision. "Held for twelve frames" is a phrase with no picture attached. This
     gives it one: the frames tick past, the key lights up for that many of them, and the distance
     it bought you is drawn underneath. */
  held: {
    aspect: 0.36,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var held = Math.round(clamp(v.framesHeld != null ? v.framesHeld : 12, 0, 30));
      var total = 30, cycle = 2400;
      var frame = Math.floor(((t % cycle) / cycle) * total);
      var down = frame < held;

      var pad = 22, cw = (W - pad * 2) / total, ty = 26;
      for (var i = 0; i < total; i++) {
        var on = i < held, now = i === frame;
        ctx.fillStyle = on ? (now ? P.gold : P.azure) : P.line;
        ctx.globalAlpha = on ? 1 : 0.6;
        ctx.fillRect(pad + i * cw, ty, Math.max(1, cw - 2), on ? 14 : 7);
        ctx.globalAlpha = 1;
      }
      txt(down ? 'key held' : 'let go', pad, ty - 8, 11, down ? P.gold : P.dim, 'left');
      txt(held + ' frames', W - pad, ty - 8, 11, P.muted, 'right');

      // Distance: it only moves while the key is down, so the bar stops where the ticks stop.
      var trackY = H * 0.68, moved = Math.min(frame, held) / total;
      ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad, trackY + 9); ctx.lineTo(W - pad, trackY + 9); ctx.stroke();
      ctx.fillStyle = P.teal;
      rr(pad, trackY + 6, moved * (W - pad * 2 - 16), 6, 3); ctx.fill();
      ctx.fillStyle = down ? P.gold : P.azure;
      rr(pad + moved * (W - pad * 2 - 16), trackY, 16, 18, 4); ctx.fill();
      txt(Math.round(held * 4) + ' pixels travelled', pad, H - 6, 10, P.dim, 'left');
    }
  },

  /* input-movement-collision, again. The overlap/collider distinction is one line of code and two
     completely different games, and reading about it does not stick. Watching the same box stop
     dead or sail through does. */
  overlap: {
    aspect: 0.34,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var solid = (v.useCollider != null ? v.useCollider : 0) >= 0.5;
      var cycle = 2600, p = (t % cycle) / cycle;
      var y = H * 0.44, box = 20, pad = 24;
      var blockX = W * 0.62;

      if (p < 0.04) s.taken = false;
      var x = pad + p * 2.0 * (W - pad * 2 - box);
      if (solid && x > blockX - box - 2) x = blockX - box - 2;      // a collider is a wall
      if (!solid && x + box > blockX + 4) s.taken = true;           // an overlap is a pickup

      ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y + box + 2.5); ctx.lineTo(W, y + box + 2.5); ctx.stroke();

      if (!(s.taken && !solid)) {
        ctx.fillStyle = solid ? P.dim : P.gold;
        rr(blockX, y - 2, 16, box + 4, 3); ctx.fill();
      } else {
        txt('+1', blockX + 8, y - 8, 13, P.green, 'center');
      }

      ctx.fillStyle = P.azure;
      rr(x, y, box, box, 4); ctx.fill();

      txt(solid ? 'collider — it is a wall, the player stops'
        : 'overlap — the player passes through and picks it up',
        pad, H - 8, 11, solid ? P.muted : P.green, 'left');
    }
  },

  /* juice. The point of the lesson is that the layers are cheap and they stack, so the demo stacks
     them one slider notch at a time on an otherwise identical hit. Dragging it to 0 and back is the
     fastest way anyone has ever understood the word. */
  juice: {
    aspect: 0.38,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var layers = Math.round(clamp(v.layers != null ? v.layers : 3, 0, 5));
      var dur = v.durationMs != null ? v.durationMs : 300;
      var cycle = 1500, since = t % cycle;                 // a hit every cycle
      var k = clamp(1 - since / dur, 0, 1);                // 1 at the moment of impact, 0 after
      var cx = W / 2, cy = H * 0.46, size = 40;

      ctx.save();
      if (layers >= 2) {                                    // shake
        ctx.translate((Math.random() - 0.5) * 10 * k, (Math.random() - 0.5) * 10 * k);
      }
      var sx = 1, sy = 1;
      if (layers >= 3) { sx = 1 + 0.35 * k; sy = 1 - 0.28 * k; }   // squash
      ctx.fillStyle = (layers >= 1 && k > 0.35) ? P.ink : P.azure; // flash
      rr(cx - (size * sx) / 2, cy - (size * sy) / 2, size * sx, size * sy, 6); ctx.fill();
      ctx.restore();

      if (layers >= 4) {                                    // particles
        if (!s.parts) s.parts = [];
        if (since < dt) {
          for (var i = 0; i < 10; i++) {
            var a = Math.random() * 6.284, sp2 = 40 + Math.random() * 90;
            s.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2, life: 1 });
          }
        }
        for (var j = s.parts.length - 1; j >= 0; j--) {
          var pt = s.parts[j];
          pt.x += pt.vx * (dt / 1000); pt.y += pt.vy * (dt / 1000);
          pt.vy += 220 * (dt / 1000); pt.life -= dt / dur;
          if (pt.life <= 0) { s.parts.splice(j, 1); continue; }
          ctx.globalAlpha = pt.life; ctx.fillStyle = P.gold;
          ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      if (layers >= 5) {                                    // the number that floats off
        ctx.globalAlpha = k;
        txt('+10', cx, cy - 32 - (1 - k) * 26, 15, P.green, 'center');
        ctx.globalAlpha = 1;
      }

      var names = ['nothing at all', 'a flash', 'flash + shake', '+ squash', '+ particles', '+ the number'];
      txt(layers + ' — ' + names[layers], 16, H - 8, 11, layers === 0 ? P.dim : P.muted, 'left');
      txt(Math.round(dur) + ' ms', W - 16, H - 8, 10, P.dim, 'right');
    }
  },

  /* feedback. Delay is invisible in a number and obvious in a picture. The hit lands on the left
     mark; the response arrives on the right one; the gap between them is drawn to scale, and past
     about 150ms a student can feel the game stop belonging to them. */
  feedback: {
    aspect: 0.38,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var ch = Math.round(clamp(v.channels != null ? v.channels : 1, 0, 3));
      var delay = v.delayMs != null ? v.delayMs : 0;
      var cycle = 1800, since = t % cycle;
      var shown = since >= delay && since < delay + 420;
      var k = shown ? clamp(1 - (since - delay) / 420, 0, 1) : 0;
      var cx = W * 0.34, cy = H * 0.42;

      // The target, and the flash channel.
      ctx.fillStyle = (ch >= 2 && k > 0.4) ? P.ink : P.azure;
      rr(cx - 22, cy - 22, 44, 44, 6); ctx.fill();

      if (ch >= 1) { ctx.globalAlpha = k; txt('+10', cx, cy - 30 - (1 - k) * 18, 14, P.green, 'center'); ctx.globalAlpha = 1; }
      if (ch >= 3) {                                        // a sound, drawn as a ring
        ctx.globalAlpha = k * 0.8; ctx.strokeStyle = P.teal; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 26 + (1 - k) * 26, 0, 6.284); ctx.stroke(); ctx.globalAlpha = 1;
      }

      // The gap, to scale: 500ms of slider across the right-hand half of the strip.
      var bx = W * 0.58, bw = W * 0.36, by = H * 0.74;
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
      ctx.fillStyle = P.azure; ctx.fillRect(bx - 1, by - 8, 2, 16);
      var dx = bx + (clamp(delay, 0, 500) / 500) * bw;
      ctx.fillStyle = delay > 150 ? P.gold : P.green; ctx.fillRect(dx - 1, by - 8, 2, 16);
      if (delay > 0) { ctx.globalAlpha = 0.30; ctx.fillRect(bx, by - 4, dx - bx, 8); ctx.globalAlpha = 1; }
      txt('hit', bx, by + 18, 10, P.dim, 'left');
      txt(Math.round(delay) + ' ms later', bx + bw, by + 18, 10, delay > 150 ? P.gold : P.dim, 'right');
      txt(ch === 0 ? 'no feedback — did anything happen?'
        : (delay > 150 ? 'too late to feel connected' : 'feels like you did it'),
        16, H - 8, 11, ch === 0 || delay > 150 ? P.gold : P.muted, 'left');
    }
  },

  /* ===========================================================================================
     THE GENERIC FOUR
     ===========================================================================================
     The seven above are each drawn for one lesson: a ball with gravity, a box at four frames a
     second. That does not scale — there are 48 slider cells in the course and hand-drawing 48
     pictures is 48 things to keep working.

     These four draw whatever the CODE works out. A cell names its variables with `@feed` and the
     values arrive in `v.$fed` as an ordered list of `{n: name, v: number | number[]}`. So the
     arithmetic stays in the editable block where a student can change it, and the picture is
     downstream of their change — drag a slider, the code recomputes, the picture follows.

     Every one of them is defensive about `$fed`: a cell can be edited until it computes nothing,
     and an empty picture with a line of text beats a blank box or a crash.

     All four are `still: true`. Nothing in them moves — they are a reading of the numbers as they
     stand — so they get no play/pause veil and no idle timer. The seven above animate, and a
     picture you have to press to start is right for those and wrong for these: a veil over a bar
     chart dims the answer and asks you to drag something to see what is already drawn. */

  /* One bar per quantity, scaled to the biggest. The answer to most "how many / how long / how
     much" cells: three numbers side by side, where the interesting thing is which is bigger and
     by how much. */
  bars: {
    still: true, aspect: 0.40,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var f = (v.$fed || []).filter(function (x) { return typeof x.v === 'number'; });
      if (!f.length) { txt('change the code to work something out', W / 2, H / 2, 12, P.dim, 'center'); return; }
      var pad = 20, top = 26, base = H - 30;
      var max = 0;
      f.forEach(function (x) { max = Math.max(max, Math.abs(x.v)); });
      if (!max) max = 1;
      var cols = [P.azure, P.teal, P.green, P.gold, P.brand];
      var slot = (W - pad * 2) / f.length, bw = Math.min(84, slot * 0.62);
      f.forEach(function (x, i) {
        var cx = pad + slot * (i + 0.5);
        var h = Math.max(2, (Math.abs(x.v) / max) * (base - top));
        ctx.fillStyle = cols[i % cols.length];
        rr(cx - bw / 2, base - h, bw, h, 4); ctx.fill();
        /* The number above the bar, the name below it. A bar you have to hover to read is a bar
           that has not said anything. */
        txt(Math.round(x.v * 100) / 100 + '', cx, base - h - 7, 12, P.ink, 'center');
        txt(x.n, cx, base + 15, 10, P.dim, 'center');
      });
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, base + 0.5); ctx.lineTo(W - pad, base + 0.5); ctx.stroke();
    }
  },

  /* A line through a fed ARRAY. For anything that grows or eases off across a run of levels,
     waves or weeks — a difficulty curve, a cost curve, a score ramp. The shape is the point, so
     the first and last values are labelled and nothing else is. */
  curve: {
    still: true, aspect: 0.44,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var f = (v.$fed || []);
      var arr = null, name = '';
      for (var i = 0; i < f.length; i++) if (Array.isArray(f[i].v) && f[i].v.length > 1) { arr = f[i].v; name = f[i].n; break; }
      if (!arr) { txt('build a list of numbers to see its shape', W / 2, H / 2, 12, P.dim, 'center'); return; }
      var pad = 26, top = 22, base = H - 28, plotW = W - pad * 2;
      var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr);
      if (hi === lo) { hi = lo + 1; }
      var px = function (i) { return pad + (arr.length < 2 ? 0 : (i / (arr.length - 1)) * plotW); };
      var py = function (n) { return base - ((n - lo) / (hi - lo)) * (base - top); };

      // A floor line, so a curve that climbs off zero looks like it climbed off something.
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, base + 0.5); ctx.lineTo(W - pad, base + 0.5); ctx.stroke();

      // Filled under the line: it reads as an amount rather than as a graph in a maths lesson.
      ctx.beginPath(); ctx.moveTo(px(0), base);
      arr.forEach(function (n, i) { ctx.lineTo(px(i), py(n)); });
      ctx.lineTo(px(arr.length - 1), base); ctx.closePath();
      ctx.globalAlpha = 0.16; ctx.fillStyle = P.azure; ctx.fill(); ctx.globalAlpha = 1;

      ctx.beginPath();
      arr.forEach(function (n, i) { if (i) ctx.lineTo(px(i), py(n)); else ctx.moveTo(px(i), py(n)); });
      ctx.strokeStyle = P.azure; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

      /* A dot per step while there are few enough to count. Past about twenty they merge into the
         line and are just noise. */
      if (arr.length <= 20) {
        ctx.fillStyle = P.teal;
        arr.forEach(function (n, i) { ctx.beginPath(); ctx.arc(px(i), py(n), 3, 0, 6.284); ctx.fill(); });
      }
      txt(name + ' — ' + arr.length + ' steps', pad, top - 8, 10, P.dim, 'left');
      txt(Math.round(arr[0] * 100) / 100 + '', px(0), py(arr[0]) - 9, 11, P.muted, 'left');
      txt(Math.round(arr[arr.length - 1] * 100) / 100 + '',
        px(arr.length - 1), py(arr[arr.length - 1]) - 9, 11, P.gold, 'right');
    }
  },

  /* That many things, drawn. The one picture that beats a number outright for a young reader:
     "12" is a symbol and twelve blobs is a quantity, and the difference between 12 and 40 is
     something you can see coming rather than read. */
  count: {
    /* Short, because the common case is one or two rows of dots. The big counts are handled by the
       shrink-to-fit below rather than by reserving room for them all the time. */
    still: true, aspect: 0.30,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var f = (v.$fed || []).filter(function (x) { return typeof x.v === 'number'; });
      if (!f.length) { txt('work out a number to see it as a pile', W / 2, H / 2, 12, P.dim, 'center'); return; }
      var n = Math.max(0, Math.round(f[0].v)), name = f[0].n;
      var pad = 20, top = 34, CAP = 240;      // past this it is a wall of dots and the count is the point
      var show = Math.min(n, CAP);
      var cell = 16, cols = Math.max(1, Math.floor((W - pad * 2) / cell));
      var rows = Math.ceil(show / cols) || 1;
      /* Shrunk to fit rather than clipped: a picture that runs off the bottom has stopped being a
         picture of how many. */
      var fit = Math.min(1, (H - top - 22) / Math.max(1, rows * cell));
      var d = cell * fit, r = Math.max(1.6, d * 0.32);

      txt(name + ' = ' + n, pad, top - 14, 13, P.ink, 'left');
      if (n > CAP) txt('showing ' + CAP, W - pad, top - 14, 10, P.gold, 'right');
      ctx.fillStyle = P.teal;
      for (var i = 0; i < show; i++) {
        var cx = pad + (i % cols) * d + d / 2;
        var cy = top + Math.floor(i / cols) * d + d / 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.284); ctx.fill();
      }
      if (!n) txt('nothing at all', pad, top + 14, 12, P.dim, 'left');
    }
  },

  /* Two quantities, and the verdict. For every cell that is really a question — does this fit in
     the budget, is this more than that, have we gone over. The sentence at the bottom is the whole
     value of it: a child reading two bars still has to be told which one winning is the bad news. */
  compare: {
    /* Two bars and a line of text and nothing else, so it asks for the least height widgets.js
       will give it. The taller box it had was two thirds empty canvas. */
    still: true, aspect: 0.19,
    draw: function (ctx, W, H, v, t, s, dt, P) {
      var f = (v.$fed || []).filter(function (x) { return typeof x.v === 'number'; });
      if (f.length < 2) { txt('work out two numbers to compare them', W / 2, H / 2, 12, P.dim, 'center'); return; }
      var a = f[0], b = f[1];
      var max = Math.max(Math.abs(a.v), Math.abs(b.v)) || 1;
      /* Laid out from the top and measured, rather than pinned to H: the verdict sits under the
         second bar wherever that lands, so there is no band of empty canvas between them. */
      var pad = 22, lab = 96, barW = W - pad * 2 - lab - 54, y0 = 18, gap = 30;
      var over = a.v > b.v;

      [a, b].forEach(function (x, i) {
        var y = y0 + i * gap;
        txt(x.n, pad, y + 12, 11, P.muted, 'left');
        ctx.fillStyle = P.panel;
        rr(pad + lab, y, barW, 17, 4); ctx.fill();
        ctx.fillStyle = i === 0 ? (over ? P.gold : P.azure) : P.green;
        rr(pad + lab, y, Math.max(2, (Math.abs(x.v) / max) * barW), 17, 4); ctx.fill();
        txt(Math.round(x.v * 100) / 100 + '', pad + lab + barW + 8, y + 13, 12, P.ink, 'left');
      });

      /* The second number read as a limit, which is how these cells are almost always written:
         the first is what you asked for and the second is what you have got. */
      var diff = Math.round((a.v - b.v) * 100) / 100;
      txt(a.v === b.v ? 'exactly the same'
        : over ? (a.n + ' is ' + Math.abs(diff) + ' over ' + b.n)
          : (a.n + ' is ' + Math.abs(diff) + ' under ' + b.n),
        pad, Math.min(H - 8, y0 + gap + 40), 11.5, over ? P.gold : P.green, 'left');
    }
  }
};
