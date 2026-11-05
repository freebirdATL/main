(() => {
  'use strict';
  const P = window.TrickPhysics, { C } = P;
  const $ = (id) => document.getElementById(id);
  const canvas = $('court'), ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const modes = {
    slingshot: {
      name: 'Slingshot', tag: '01 — SLINGSHOT', title: 'Pull. Aim. Release.',
      description: 'Store energy in the band, then choose where it sends the ball.',
      values: { force: 130, angle: 55 },
      fields: [
        { key: 'force', label: 'Peak band force', symbol: 'F', unit: 'N', step: 1, hint: '0–600 N · force at full draw' },
        { key: 'angle', label: 'Launch direction', symbol: 'θ', unit: '°', step: 1, hint: '0° right · 90° up · ±180° left' },
      ],
      equation: 'E = ½F<sub>peak</sub>d &nbsp; · &nbsp; v = √(F<sub>peak</sub>d/m)',
      explanation: 'Fixed draw <b>d = 0.50 m</b>. The ideal band acts like a linear spring: its force falls from your chosen peak to zero. All stored energy goes into the ball.',
    },
    jetpack: {
      name: 'Jetpack ball', tag: '02 — JETPACK', title: 'Two axes. One burst.',
      description: 'Give the ball a horizontal and vertical impulse. Both fire once at release.',
      values: { jx: 4, jy: 5 },
      fields: [
        { key: 'jx', label: 'Horizontal impulse', symbol: 'Jₓ', unit: 'N·s', step: 0.1, hint: '−15 to 15 N·s · positive = right' },
        { key: 'jy', label: 'Vertical impulse', symbol: 'Jᵧ', unit: 'N·s', step: 0.1, hint: '−15 to 15 N·s · positive = up' },
      ],
      equation: 'vₓ = Jₓ / m &nbsp; · &nbsp; vᵧ = Jᵧ / m',
      explanation: 'Impulse changes momentum. With <b>m = 0.60 kg</b>, each 1 N·s adds 1.67 m/s on that axis. Ideal instantaneous burst; the jetpack adds no mass.',
    },
    counterweight: {
      name: 'Falling weight', tag: '03 — FALLING WEIGHT', title: 'Drop it. Send it.',
      description: 'A falling counterweight powers the ball. Set the drop, then redirect the energy.',
      values: { mass: 1.2, height: 3, angle: 55 },
      fields: [
        { key: 'mass', label: 'Counterweight mass', symbol: 'M', unit: 'kg', step: 0.1, hint: '0.1–12 kg · ball stays 0.60 kg' },
        { key: 'height', label: 'Weight’s drop height', symbol: 'h', unit: 'm', step: 0.1, hint: '0–8 m · vertical distance the weight falls' },
        { key: 'angle', label: 'Exit direction', symbol: 'θ', unit: '°', step: 1, hint: '0° right · 90° up · ±180° left' },
      ],
      equation: 'Mgh = ½mv² &nbsp; → &nbsp; v = √(2Mgh/m)',
      explanation: 'The weight’s lost potential energy becomes the ball’s kinetic energy. <b>Ideal, 100% energy transfer</b>; the guide changes direction without losing speed.',
    },
  };

  let mode = 'slingshot', state = 'ready', shot = null, previousPath = null;
  let history = [], attempts = 0, makes = 0, lastTime = 0, accumulator = 0;
  let width = 1000, height = 590, scale = 60, floor = 500;
  let confetti = [], sound = false, audio = null, launchFlash = 0;
  const fmt = (n, digits = 2) => Math.abs(n) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : n.toFixed(digits);
  const position = (x, y) => [x * scale + (width - C.worldWidth * scale) / 2, floor - y * scale];

  function selectMode(next) {
    if (state === 'flying') return;
    mode = next;
    document.querySelectorAll('[data-launcher]').forEach((button) => {
      const selected = button.dataset.launcher === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const config = modes[mode];
    $('mode-tag').textContent = config.tag;
    $('control-title').textContent = config.title;
    $('control-description').textContent = config.description;
    $('parameter-inputs').innerHTML = config.fields.map((field) => {
      const [min, max] = P.limits[mode][field.key];
      return `<div class="parameter"><div class="parameter-label"><label for="input-${field.key}">${field.label}</label><span>${field.symbol}</span></div><div class="input-wrap"><input id="input-${field.key}" name="${field.key}" type="number" inputmode="decimal" min="${min}" max="${max}" step="any" value="${config.values[field.key]}" aria-describedby="hint-${field.key}" required><span>${field.unit}</span></div><p id="hint-${field.key}" class="parameter-hint">${field.hint}</p></div>`;
    }).join('');
    $('equation-content').innerHTML = `<p class="formula">${config.equation}</p><p>${config.explanation}</p><p class="energy-summary" id="energy-summary"></p>`;
    config.fields.forEach((field) => {
      const input = $(`input-${field.key}`);
      input.addEventListener('input', () => {
        if (state === 'result') ready(false);
        if (input.value !== '' && input.validity.valid) config.values[field.key] = input.valueAsNumber;
        updateReadout();
      });
      // Arrow keys use a useful increment while arbitrary decimal entry stays valid.
      input.addEventListener('keydown', (event) => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const [min, max] = P.limits[mode][field.key];
        input.value = Math.min(max, Math.max(min, Number(((input.valueAsNumber || 0) + (event.key === 'ArrowUp' ? field.step : -field.step)).toFixed(5))));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    ready(false);
    updateReadout();
  }

  function validValues() {
    const values = {};
    for (const field of modes[mode].fields) {
      const input = $(`input-${field.key}`);
      if (input.value === '' || !input.validity.valid) return null;
      values[field.key] = input.valueAsNumber;
    }
    return values;
  }

  function updateReadout() {
    const values = validValues();
    $('field-error').hidden = true;
    if (!values) {
      $('launch-speed').textContent = '—';
      $('launch-components').textContent = 'Enter a valid value in each field.';
      $('energy-summary').textContent = '';
      return;
    }
    const v = P.launch(mode, values);
    $('launch-speed').textContent = fmt(v.speed);
    $('launch-components').textContent = `vₓ = ${fmt(v.vx)} · vᵧ = ${fmt(v.vy)} m/s`;
    $('energy-summary').textContent = `Launch kinetic energy: ${fmt(v.energy)} J`;
    const angle = v.angle * Math.PI / 180;
    const x = 26 + 20 * Math.cos(angle), y = 14 - 12 * Math.sin(angle);
    $('mini-vector').setAttribute('d', `M26 14 L${x} ${y} M${x - 5 * Math.cos(angle - .5)} ${y + 5 * Math.sin(angle - .5)} L${x} ${y} L${x - 5 * Math.cos(angle + .5)} ${y + 5 * Math.sin(angle + .5)}`);
  }

  function setLocked(locked) {
    $('shot-fields').disabled = locked;
    document.querySelectorAll('[data-launcher]').forEach((button) => button.disabled = locked);
    $('launch-button').disabled = locked;
    $('clear-notebook').disabled = locked || history.length === 0;
    document.querySelectorAll('.restore-button').forEach((button) => button.disabled = locked);
    $('launch-label').textContent = locked ? 'Shot in flight…' : 'Launch shot';
  }

  function ready(clearFeedback = true) {
    state = 'ready';
    shot = null;
    accumulator = 0;
    confetti = [];
    $('result-overlay').hidden = true;
    $('offscreen-note').hidden = true;
    $('court-status').textContent = 'READY TO LAUNCH';
    $('flight-time').innerHTML = '0.00 <small>s</small>';
    $('flight-vx').innerHTML = '— <small>m/s</small>';
    $('flight-vy').innerHTML = '— <small>m/s</small>';
    $('flight-peak').innerHTML = '— <small>m</small>';
    setLocked(false);
    if (clearFeedback) feedback('↗', 'Fresh ball. New hypothesis.', 'Change your inputs, then launch again. Your previous shot stays visible for comparison.');
  }

  function begin() {
    if (state === 'flying') return;
    const values = validValues();
    if (!values) { $('shot-form').reportValidity(); return; }
    Object.assign(modes[mode].values, values);
    shot = P.createShot(mode, values);
    state = 'flying';
    accumulator = 0;
    attempts += 1;
    $('attempts-total').textContent = attempts;
    $('result-overlay').hidden = true;
    $('court-status').textContent = 'EXPERIMENT IN FLIGHT';
    setLocked(true);
    feedback('↗', `Attempt ${String(attempts).padStart(2, '0')} is in the air.`, 'Watch the vertical velocity fall as gravity acts. Horizontal velocity stays constant until a collision.');
    launchFlash = 1;
    tone(190, .12, 'triangle', .065, 440);
    updateTelemetry();
    if (window.innerWidth < 620) $('canvas-wrap').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
  }

  function feedback(icon, title, copy) {
    $('feedback-icon').textContent = icon;
    $('feedback-title').textContent = title;
    $('feedback-copy').textContent = copy;
  }

  function describeResult(s) {
    if (s.scored) {
      const stats = s.scoreStats;
      const title = stats.floorBounces ? 'The bounce shot!' : stats.boardHits ? 'Bank is open.' : stats.rimHits ? 'A friendly roll.' : 'Nothing but net.';
      return { title, short: 'BUCKET', text: `Through the hoop in ${fmt(s.scoreTime)} s. ${stats.contacts ? `${stats.contacts} contact${stats.contacts === 1 ? '' : 's'} along the way.` : 'A clean arc from launch to net.'}` };
    }
    if (s.initial.vx <= 0) return { title: 'Find the right direction.', short: 'MISSED', text: 'The hoop is to the right. Your initial horizontal velocity was zero or negative; try a positive X component.' };
    if (s.peak < C.hoopY) return { title: 'A little more lift.', short: 'TOO LOW', text: `Peak height was ${fmt(s.peak)} m; the hoop is 3.05 m high. Increase the upward launch velocity.` };
    if (s.rimHits) return { title: 'So close. Off the rim.', short: 'RIM', text: 'The ball touched the rim but did not pass through. Try a small adjustment to your inputs; the ball needs to fit fully inside the opening.' };
    if (s.boardHits) return { title: 'Found the backboard.', short: 'BACKBOARD', text: 'The ball hit the backboard but missed the basket. Compare the recorded path and try a small change to the launch direction or speed.' };
    if (s.rimCrossing !== null) {
      const short = s.rimCrossing < 0;
      return { title: short ? 'Not quite there.' : 'A little too far.', short: short ? 'SHORT' : 'LONG', text: `At hoop height on the way down, the ball was ${fmt(Math.abs(s.rimCrossing))} m ${short ? 'short of' : 'past'} the hoop’s centre. ${mode === 'jetpack' ? 'Try adjusting one impulse at a time.' : 'Try a small change in energy or angle.'}` };
    }
    return { title: 'That one got away.', short: 'OUT OF PLAY', text: 'The ball left the horizontal play area or reached the 12-second limit. Try less energy or a different direction.' };
  }

  function finish(cancelled = false) {
    if (!shot || state !== 'flying') return;
    const s = shot;
    const result = cancelled && !s.scored ? { title: 'Shot reset.', short: 'RESET', text: 'Attempt recorded. Adjust your inputs and try again.' } : describeResult(s);
    if (s.scored) makes += 1;
    history.unshift({ number: attempts, mode, values: { ...s.values }, speed: s.initial.speed, peak: s.peak, made: s.scored, result: result.short });
    previousPath = s.path.map((point) => ({ ...point }));
    state = 'result';
    $('court-status').textContent = s.scored ? 'BUCKET CONFIRMED' : 'EXPERIMENT COMPLETE';
    $('makes-total').textContent = makes;
    setLocked(false);
    renderHistory();
    feedback(s.scored ? '✓' : '↗', result.title, result.text);
    if (s.scored && !cancelled) {
      $('result-kicker').textContent = s.scoreStats.floorBounces ? 'BOUNCE. FLY. BUCKET.' : 'THAT’S A BUCKET';
      $('result-title').textContent = result.title;
      $('result-copy').textContent = result.text;
      $('result-overlay').hidden = false;
    }
    updateTelemetry();
  }

  function inputSummary(item) {
    const v = item.values;
    if (item.mode === 'slingshot') return `${v.force} N · ${v.angle}°`;
    if (item.mode === 'jetpack') return `Jₓ ${v.jx} · Jᵧ ${v.jy} N·s`;
    return `${v.mass} kg · ${v.height} m · ${v.angle}°`;
  }

  function renderHistory() {
    $('notebook-count').textContent = `${history.length} shot${history.length === 1 ? '' : 's'}`;
    $('clear-notebook').disabled = state === 'flying' || history.length === 0;
    $('shot-history').innerHTML = history.length ? history.map((item) => `<tr><td>${String(item.number).padStart(2, '0')}</td><td>${modes[item.mode].name}</td><td>${inputSummary(item)}</td><td>${fmt(item.speed)} m/s</td><td>${fmt(item.peak)} m</td><td><span class="outcome-pill ${item.made ? 'made' : ''}">${item.result}</span></td><td><button class="restore-button" data-restore="${item.number}" aria-label="Restore settings from shot ${item.number}">Reuse ↗</button></td></tr>`).join('') : '<tr class="empty-history"><td colspan="7">Every attempt is an experiment. Your results will appear here.</td></tr>';
    document.querySelectorAll('[data-restore]').forEach((button) => {
      button.addEventListener('click', () => {
        if (state === 'flying') return;
        const item = history.find((entry) => entry.number === Number(button.dataset.restore));
        modes[item.mode].values = { ...item.values };
        selectMode(item.mode);
        feedback('↗', `Settings from shot ${item.number} restored.`, 'These are the exact inputs you used. Repeat the shot or change one value to compare.');
        $('control-title').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
      });
    });
  }

  function updateTelemetry() {
    if (!shot) return;
    const measurement = shot.scored ? shot.scoreStats : shot;
    $('flight-time').innerHTML = `${fmt(shot.scored ? shot.scoreTime : shot.t)} <small>s</small>`;
    $('flight-vx').innerHTML = `${fmt(measurement.vx)} <small>m/s</small>`;
    $('flight-vy').innerHTML = `${fmt(measurement.vy)} <small>m/s</small>`;
    $('flight-peak').innerHTML = `${fmt(measurement.peak)} <small>m</small>`;
  }

  function line(x1, y1, x2, y2, color, stroke = 1, dash = []) {
    ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle = color;ctx.lineWidth = stroke;
    ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
  }
  function worldLine(x1, y1, x2, y2, color, stroke = 1, dash = []) { line(...position(x1,y1),...position(x2,y2),color,stroke,dash); }
  function circle(x,y,r,fill,stroke,strokeWidth = 1) {
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=strokeWidth;ctx.stroke();}
  }
  function label(text,x,y,color='#708169',size=9,align='left',font='mono') {
    ctx.fillStyle=color;ctx.font=`${size}px ${font === 'mono' ? 'ui-monospace, SFMono-Regular, monospace' : 'Arial, sans-serif'}`;ctx.textAlign=align;ctx.fillText(text,x,y);
  }
  function arrow(x1,y1,x2,y2,color,stroke=1.5,head=5){
    line(x1,y1,x2,y2,color,stroke);
    const a=Math.atan2(y2-y1,x2-x1);
    line(x2,y2,x2-head*Math.cos(a-.5),y2-head*Math.sin(a-.5),color,stroke);
    line(x2,y2,x2-head*Math.cos(a+.5),y2-head*Math.sin(a+.5),color,stroke);
  }

  function drawBackground() {
    ctx.clearRect(0,0,width,height);
    const sky=ctx.createLinearGradient(0,0,0,floor);sky.addColorStop(0,'#e9efdf');sky.addColorStop(1,'#e0e9d1');
    ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    // A quiet court-side skyline and mesh fence, all behind the physics plane.
    const horizon=floor-scale*.8;
    const buildings=[[-.4,1.2,1.8],[1,1.4,2.1],[3,1.0,1.4],[4.3,1.5,1.7],[6.2,.9,2.4],[7.8,1.1,1.5],[9,1.3,2.1],[11,1.6,1.6],[13.6,1.0,2.3],[15,.8,1.6]];
    for(const [bx,bw,bh] of buildings){const [x]=position(bx,0);ctx.fillStyle='#d5dfc8';ctx.fillRect(x,horizon-bh*scale,bw*scale,bh*scale);for(let row=0;row<Math.floor(bh/.4);row++)for(let col=0;col<Math.floor(bw/.35);col++){ctx.fillStyle='#dee6d3';ctx.fillRect(x+col*.35*scale+8,horizon-bh*scale+12+row*.4*scale,5,6);}}
    ctx.fillStyle='#cddabf';ctx.fillRect(0,horizon,width,scale*.8);
    const fenceTop=floor-scale*1.4;
    ctx.save();ctx.beginPath();ctx.rect(0,fenceTop,width,floor-fenceTop);ctx.clip();
    for(let x=-200;x<width+200;x+=17){line(x,fenceTop,x+100,floor,'#b9caaa',.55);line(x,floor,x+100,fenceTop,'#b9caaa',.55);}ctx.restore();
    line(0,fenceTop,width,fenceTop,'#acbfa0',2);
    for(let x=18;x<width;x+=scale*2)line(x,fenceTop-3,x,floor,'#a4b894',2);
    ctx.fillStyle='#dfac86';ctx.fillRect(0,floor,width,height-floor);
    ctx.fillStyle='#d19c77';ctx.fillRect(0,floor,width,4);
    line(0,floor,width,floor,'#ae8061',1.2);
    line(0,height-12,width,height-12,'#e8c19f',1);
    for(let x=0;x<width;x+=scale*3)line(x,floor+4,x+30,height,'#d5a280',1);
    const [originX]=position(C.launchX,0), [hoopX]=position(C.hoopX,0);
    const dimY=floor+29;
    line(originX,dimY,hoopX,dimY,'#815f48',.8);
    line(originX,dimY-5,originX,dimY+5,'#815f48',.8);line(hoopX,dimY-5,hoopX,dimY+5,'#815f48',.8);
    const dimText='10.00 m TO THE HOOP';ctx.font='8px ui-monospace, monospace';const tw=ctx.measureText(dimText).width;
    ctx.fillStyle='#dfac86';ctx.fillRect((originX+hoopX)/2-tw/2-8,dimY-7,tw+16,14);
    label(dimText,(originX+hoopX)/2,dimY+3,'#795a43',8,'center');
    label('x = 0',originX,floor+49,'#815f48',7,'center');label('x = 10 m',hoopX,floor+49,'#815f48',7,'center');
    // Height guide and the launch-relative coordinate axes.
    const [boardGuide,hoopY]=position(14.6,C.hoopY);
    line(boardGuide,floor,boardGuide,hoopY,'#90a47f',.8,[3,4]);
    line(boardGuide-4,hoopY,boardGuide+4,hoopY,'#90a47f');line(boardGuide-4,floor-1,boardGuide+4,floor-1,'#90a47f');
    label('3.05 m',boardGuide+8,(floor+hoopY)/2,'#637a55',Math.max(7,Math.min(9,width/95)));
    const ax=width-59,ay=height-31;arrow(ax,ay,ax+24,ay,'#82634a',1,4);arrow(ax,ay,ax,ay-24,'#82634a',1,4);
    label('+x',ax+25,ay+3,'#82634a',7);label('+y',ax-4,ay-30,'#82634a',7);
  }

  function drawHoop(front=false) {
    const [hx,hy]=position(C.hoopX,C.hoopY);
    const [bx,by]=position(C.boardX,C.boardTop);
    const radius=C.hoopWidth*scale/2;
    if(!front){
      const post=bx+scale*.65;
      line(post,floor,post,by+scale*.65,'#8a9c83',6);
      line(post,by+scale*.65,bx,by+scale*.65,'#8a9c83',5);
      ctx.fillStyle='#eef1e4';ctx.fillRect(bx-2,by,5,(C.boardTop-C.boardBottom)*scale);
      ctx.strokeStyle='#4f6852';ctx.lineWidth=1.7;ctx.strokeRect(bx-2,by,5,(C.boardTop-C.boardBottom)*scale);
      line(bx-1,hy-scale*.43,bx-1,hy+scale*.08,'#d46539',2);
      line(hx+radius,hy,bx,hy,'#ba512f',2.5);
      ctx.fillStyle='#788d6b';ctx.fillRect(post-14,floor-5,28,5);
      const sway=shot?.scored?Math.sin((shot.t-shot.scoreTime)*18)*Math.exp(-(shot.t-shot.scoreTime)*2)*5:0;
      for(let i=0;i<=6;i++){
        const x=hx-radius+i*radius/3,bottomX=hx-radius*.65+i*radius*.2167+sway;
        line(x,hy+2,bottomX,hy+scale*.48,'#f8faf0',1.1);
        if(i<6)line(x,hy+2,hx-radius*.65+(i+1)*radius*.2167+sway,hy+scale*.48,'#f8faf0',.8);
      }
      line(hx-radius*.82,hy+scale*.23,hx+radius*.82,hy+scale*.23,'#f8faf0',1);
      label('THE TARGET',hx,by-15,'#647e58',7,'center');
    } else {
      // The cross-section shows two solid rim ends; the opening remains passable.
      const rimOffset=(C.hoopWidth/2+C.rimRadius)*scale;
      circle(hx-rimOffset,hy,Math.max(1.5,C.rimRadius*scale),'#c7562d');
      circle(hx+rimOffset,hy,Math.max(1.5,C.rimRadius*scale),'#c7562d');
      ctx.beginPath();ctx.ellipse(hx,hy,radius,2.5,0,0,Math.PI);ctx.strokeStyle='#d75f33';ctx.lineWidth=1.2;ctx.stroke();
    }
  }

  function drawLauncher() {
    const [x,y]=position(C.launchX,C.launchY);
    const selected=modes[mode].values;
    if(mode==='slingshot'){
      line(x,floor-5,x,y+scale*.4,'#8c6846',7);
      line(x,y+scale*.4,x-scale*.28,y-scale*.22,'#8c6846',6);
      line(x,y+scale*.4,x+scale*.28,y-scale*.22,'#8c6846',6);
      line(x-scale*.28,y-scale*.22,x,y,'#4a5d41',2.5);
      line(x+scale*.28,y-scale*.22,x,y,'#4a5d41',2.5);
      ctx.fillStyle='#8a7050';ctx.fillRect(x-13,floor-6,26,6);
    } else if(mode==='jetpack') {
      line(x,floor-4,x,y+scale*.25,'#89947d',4);
      line(x-13,y+scale*.25,x+13,y+scale*.25,'#89947d',3);
      ctx.fillStyle='#798970';ctx.fillRect(x-15,floor-6,30,6);
    } else {
      const rigX=x-scale*.8,top=y-scale*.9;
      line(rigX,floor-4,rigX,top,'#7b896e',4);line(rigX-5,top,x-scale*.25,top,'#7b896e',4);
      circle(x-scale*.25,top,4,'#d0dabd','#748867');
      let drop=shot ? Math.min(1,shot.t*4) : 0;
      const weightY=top+10+drop*(floor-top-33);
      line(rigX+7,top,rigX+7,weightY,'#7b7356',1.5);
      ctx.fillStyle='#667956';ctx.fillRect(rigX-2,weightY,18,18);
      label('M',rigX+7,weightY+12,'#f5f3df',8,'center');
      worldLine(C.launchX-.2,C.launchY-.25,C.launchX+.4,C.launchY+.15,'#647a54',4);
      ctx.fillStyle='#81916d';ctx.fillRect(rigX-12,floor-5,scale*1.3,5);
      label('RIG: SCHEMATIC',x-9,top-13,'#6b805d',6,'center');
    }
    if(state!=='flying'){
      const initial=P.launch(mode,selected), a=initial.angle*Math.PI/180;
      // A direction arrow only: no prediction of the ball's future trajectory.
      const len=scale*.8;
      arrow(x+Math.cos(a)*scale*.22,y-Math.sin(a)*scale*.22,x+Math.cos(a)*len,y-Math.sin(a)*len,'#789162',1.2,5);
      if(mode!=='jetpack'){
        line(x+scale*.18,y,x+scale*.9,y,'#a0b190',.8,[2,3]);
        ctx.beginPath();ctx.arc(x,y,scale*.47,Math.min(0,-a),Math.max(0,-a));ctx.strokeStyle='#95a883';ctx.lineWidth=.8;ctx.stroke();
        label(`${selected.angle}°`,x+scale*.62,y-8,'#607b53',8);
      }
      ball(C.launchX,C.launchY,0,mode==='jetpack');
    }
    label('LAUNCH / 1.20 m',x,y+scale*.57,'#627952',Math.max(6,Math.min(8,width/110)),'center');
  }

  function ball(wx,wy,rotation,jet=false) {
    const [x,y]=position(wx,wy),r=C.ballRadius*scale;
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
    if(jet){ctx.fillStyle='#506d63';ctx.fillRect(-r-5,-r*.7,5,r*1.4);line(-r-6,r*.3,-r-9,r*.7,'#9eb0a0',2);}
    circle(0,0,r,'#e77836','#844928',Math.max(.8,scale*.018));
    ctx.save();ctx.beginPath();ctx.arc(0,0,r-.2,0,Math.PI*2);ctx.clip();
    line(-r,0,r,0,'#9d4e29',Math.max(.7,scale*.015));line(0,-r,0,r,'#9d4e29',Math.max(.7,scale*.015));
    ctx.beginPath();ctx.ellipse(-r*.75,0,r*.7,r*1.2,0,0,Math.PI*2);ctx.strokeStyle='#9d4e29';ctx.lineWidth=Math.max(.7,scale*.014);ctx.stroke();
    ctx.beginPath();ctx.ellipse(r*.75,0,r*.7,r*1.2,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    circle(-r*.32,-r*.35,r*.16,'#f6b16a');ctx.restore();
  }

  function drawPath(path,color,dotted=true) {
    if(!path?.length)return;
    ctx.beginPath();ctx.setLineDash(dotted?[2,5]:[]);ctx.strokeStyle=color;ctx.lineWidth=1.7;
    path.forEach((p,i)=>{const [x,y]=position(p.x,p.y);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);
  }

  function draw(dt) {
    drawBackground();
    if($('trail-toggle').checked && previousPath)drawPath(previousPath,'#73927580');
    drawHoop();drawLauncher();
    if(shot){
      drawPath(shot.path,state==='flying'?'#d16a3890':'#c6774380');
      if(state==='flying'||state==='result'){
        const [x]=position(shot.x,0);
        ctx.save();ctx.globalAlpha=Math.max(.06,.19-shot.y*.012);ctx.beginPath();ctx.ellipse(x,floor-1,Math.max(4,scale*.13),2,0,0,Math.PI*2);ctx.fillStyle='#6b794d';ctx.fill();ctx.restore();
        ball(shot.x,shot.y,shot.t*shot.initial.vx*1.5,shot.mode==='jetpack');
        if(shot.mode==='jetpack'&&shot.t<.17){
          const [bx,by]=position(shot.x,shot.y),a=shot.initial.angle*Math.PI/180;
          arrow(bx-Math.cos(a)*scale*.2,by+Math.sin(a)*scale*.2,bx-Math.cos(a)*scale*.65,by+Math.sin(a)*scale*.65,'#e99837',3,2);
        }
      }
      const offscreen=state==='flying'&&position(shot.x,shot.y)[1]<-10;
      $('offscreen-note').hidden=!offscreen;
      if(offscreen)$('offscreen-note').textContent=`↑ Ball at ${fmt(shot.y,1)} m · ${shot.vy>0?'rising':'falling'}`;
    }
    drawHoop(true);
    if(launchFlash>0){launchFlash=Math.max(0,launchFlash-dt*4);const [x,y]=position(C.launchX,C.launchY);ctx.save();ctx.globalAlpha=launchFlash*.5;circle(x,y,(1-launchFlash)*32+9,null,'#e88d42',1.5);ctx.restore();}
    if(!reducedMotion)for(const p of confetti){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;p.life-=dt;ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,p.life));ctx.translate(p.x,p.y);ctx.rotate(p.y*.05);ctx.fillStyle=p.color;ctx.fillRect(-2,-2,5,3);ctx.restore();}
    confetti=confetti.filter(p=>p.life>0);
  }

  function celebrate() {
    const [x,y]=position(C.hoopX,C.hoopY);
    if(!reducedMotion)confetti=Array.from({length:44},(_,i)=>({x,y,vx:(Math.random()-.5)*220,vy:-80-Math.random()*160,life:1.6+Math.random(),color:['#e17a35','#647d4e','#f8d77c','#fffce9'][i%4]}));
    tone(523,.16,'sine',.06);setTimeout(()=>tone(659,.16,'sine',.06),120);setTimeout(()=>tone(784,.3,'sine',.055),240);
    feedback('✓','It’s in!','The ball crossed the hoop downward with enough clearance. Your shot is being recorded.');
  }

  function tone(frequency,duration,type='sine',gain=.035,endFrequency=null) {
    if(!sound)return;
    try{
      if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended')audio.resume();
      const osc=audio.createOscillator(),volume=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,audio.currentTime);
      if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,audio.currentTime+duration);
      volume.gain.setValueAtTime(gain,audio.currentTime);volume.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      osc.connect(volume);volume.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);
    }catch{/* Sound is optional; browser audio restrictions do not affect play. */}
  }

  function frame(timestamp) {
    const dt=lastTime?Math.min((timestamp-lastTime)/1000,.05):0;lastTime=timestamp;
    if(state==='flying'&&shot){
      accumulator+=dt*($('slow-toggle').checked?.35:1);
      while(accumulator>=C.step&&state==='flying'){
        P.step(shot);accumulator-=C.step;
        for(const event of shot.events){if(event.type==='score')celebrate();else if(event.speed>1.2)tone(event.type==='rimHits'?660:105,.065,'triangle',Math.min(.05,event.speed*.003));}
        if(shot.done)finish();
      }
      updateTelemetry();
    }
    draw(dt);requestAnimationFrame(frame);
  }

  function resize() {
    const rect=$('canvas-wrap').getBoundingClientRect();
    width=rect.width;height=rect.height;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    scale=(width-30)/C.worldWidth;floor=height-60;
  }

  document.querySelectorAll('[data-launcher]').forEach(button=>button.addEventListener('click',()=>selectMode(button.dataset.launcher)));
  $('shot-form').addEventListener('submit',event=>{event.preventDefault();begin();});
  $('reset-shot').addEventListener('click',()=>{if(state==='flying')finish(true);ready();});
  $('retry-button').addEventListener('click',()=>{ready();$('launch-button').focus();});
  $('clear-notebook').addEventListener('click',()=>{
    if(state==='flying')return;
    history=[];attempts=0;makes=0;previousPath=null;
    $('attempts-total').textContent='0';$('makes-total').textContent='0';
    $('flight-time').innerHTML='0.00 <small>s</small>';
    for(const id of ['flight-vx','flight-vy'])$(id).innerHTML='— <small>m/s</small>';
    $('flight-peak').innerHTML='— <small>m</small>';
    ready();renderHistory();feedback('↗','A fresh page.','Your notebook is clear. Choose a launcher and start a new experiment.');
  });
  $('sound-toggle').addEventListener('click',()=>{
    sound=!sound;$('sound-toggle').setAttribute('aria-pressed',String(sound));$('sound-toggle').setAttribute('aria-label',`Turn sound ${sound?'off':'on'}`);
    $('sound-toggle').querySelector('use').setAttribute('href',sound?'#icon-volume':'#icon-muted');tone(430,.07);
  });
  $('guide-open').addEventListener('click',()=>$('physics-guide').showModal());
  $('guide-close').addEventListener('click',()=>$('physics-guide').close());
  $('physics-guide').addEventListener('click',event=>{if(event.target===$('physics-guide')){const r=$('physics-guide').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('physics-guide').close();}});
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||$('physics-guide').open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName))return;
    if(event.code==='Space'){event.preventDefault();begin();}
    if(event.key.toLowerCase()==='r'){event.preventDefault();if(state==='flying')finish(true);ready();}
  });
  document.addEventListener('visibilitychange',()=>{lastTime=0;accumulator=0;});
  new ResizeObserver(resize).observe($('canvas-wrap'));
  selectMode('slingshot');resize();requestAnimationFrame(frame);
})();
