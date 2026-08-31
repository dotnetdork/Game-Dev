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
  }
};
