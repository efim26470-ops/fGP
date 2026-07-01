(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const menu = document.getElementById('menu');
  const carsEl = document.getElementById('cars');
  const tracksEl = document.getElementById('tracks');
  const diffEl = document.getElementById('difficulty');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const menuBtn = document.getElementById('menuBtn');
  const totalCoinsEl = document.getElementById('totalCoins');
  const garageOdoEl = document.getElementById('garageOdo');
  const raceMessage = document.getElementById('raceMessage');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const expLerp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const sign = (v) => v < 0 ? -1 : 1;
  const fmtTime = (s) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const ROAD = {
    segmentLength: 200,
    roadWidth: 2300,
    lanes: 3,
    drawDistance: 210,
    cameraHeight: 980,
    cameraDepth: 0.86,
    centrifugal: 0.32
  };

  const CARS = [
    { id:'alpine', name:'Alpine 8V', price:0, img:'alpine.png', color:'#ffd337', max:178, accel:82, brake:128, steer:.96, grip:1.18, mass:.92, desc:'спокойный стартовый баланс' },
    { id:'mini', name:'Mini Rally', price:180, img:'mini.png', color:'#4fd0ff', max:158, accel:88, brake:136, steer:1.25, grip:1.38, mass:.76, desc:'цепкая и лёгкая' },
    { id:'roadster', name:'Roadster', price:420, img:'roadster.png', color:'#ff334e', max:205, accel:94, brake:132, steer:1.06, grip:1.08, mass:.9, desc:'быстрый, но нервный' },
    { id:'camaro', name:'Camaro GT', price:680, img:'camaro.png', color:'#ffad25', max:218, accel:101, brake:120, steer:.9, grip:1.0, mass:1.2, desc:'тяжёлый маслкар' },
    { id:'viper', name:'Viper R', price:980, img:'viper.png', color:'#ff4439', max:238, accel:110, brake:132, steer:.98, grip:1.04, mass:1.05, desc:'высокая скорость' },
    { id:'sidepipe', name:'Sidepipe V8', price:1450, img:'sidepipe.png', color:'#ff792b', max:248, accel:116, brake:126, steer:.87, grip:.98, mass:1.15, desc:'много мощности' },
    { id:'raptor', name:'Raptor 4x4', price:1650, img:'raptor.png', color:'#151a20', max:194, accel:91, brake:124, steer:.86, grip:1.54, mass:1.38, desc:'лучше держит обочину' },
    { id:'slingshot', name:'Slingshot X', price:2200, img:'slingshot.png', color:'#315dff', max:265, accel:124, brake:145, steer:.94, grip:.98, mass:.98, desc:'максималка и риск' }
  ];

  const DIFF = {
    easy: { name:'Лёгкая', traffic:.6, damage:.55, grip:1.16, coins:1.0, desc:'меньше трафика' },
    normal: { name:'Нормальная', traffic:1.0, damage:1.0, grip:1.0, coins:1.15, desc:'баланс' },
    hard: { name:'Хард', traffic:1.55, damage:1.35, grip:.92, coins:1.45, desc:'сложнее, награда выше' }
  };

  const TRACK_DEFS = [
    { id:'country', name:'Roll On Down The Line', shot:'country.jpg', laps:3, bg:'country', grip:1.08, desc:'длинные прямые и плавные дуги', parts:[[60,0],[60,.45],[80,0],[55,-.55],[75,0],[65,.72],[50,.15],[90,0],[70,-.82],[65,0],[55,.45],[90,0]] },
    { id:'downtown', name:'Downtown Sprint', shot:'downtown.jpg', laps:3, bg:'city', grip:.98, desc:'городские связки', parts:[[45,0],[50,.85],[35,0],[48,-.95],[40,.2],[58,.8],[42,-.62],[55,0],[52,-.85],[48,.72],[65,0]] },
    { id:'nightcity', name:'Night City Loop', shot:'nightcity.jpg', laps:4, bg:'night', grip:.92, desc:'скользко и быстро', parts:[[55,0],[80,.34],[50,-.82],[45,-.32],[75,.9],[45,0],[85,-.96],[60,.75],[70,0]] },
    { id:'lava', name:'Lavafalls Ridge', shot:'lavafalls.jpg', laps:2, bg:'lava', grip:.88, desc:'опасные повороты', parts:[[65,0],[62,-.7],[38,.6],[72,-1.0],[55,0],[76,1.0],[40,-.28],[75,0],[62,.76],[62,-.78]] },
    { id:'valley', name:'Valley Run', shot:'valley.jpg', laps:3, bg:'valley', grip:1.14, desc:'широкий быстрый поток', parts:[[100,0],[85,.28],[80,0],[78,-.36],[100,0],[70,.52],[80,0],[70,-.52],[100,0]] }
  ];

  function buildTrack(def) {
    const segments = [];
    let curve = 0;
    let z = 0;
    const add = (n, target) => {
      for (let i = 0; i < n; i++) {
        const t = n < 2 ? 1 : i / (n - 1);
        const smooth = (1 - Math.cos(t * Math.PI)) / 2;
        curve = lerp(curve, target, 0.04 + smooth * 0.14);
        segments.push({ index: segments.length, z, curve, color: Math.floor(segments.length / 3) % 2 });
        z += ROAD.segmentLength;
      }
    };
    def.parts.forEach(([n, c]) => add(n, c));
    add(70, 0);
    return { ...def, segments, length: segments.length * ROAD.segmentLength };
  }
  const TRACKS = TRACK_DEFS.map(buildTrack);

  const storeKey = 'q3-retro-rally-html-v9';
  const defaultSave = () => ({ coins:0, selectedCar:'alpine', selectedTrack:'country', difficulty:'normal', unlocked:{ alpine:true }, bestTimes:{}, odometer:0 });
  let save = defaultSave();
  try { save = { ...defaultSave(), ...JSON.parse(localStorage.getItem(storeKey) || '{}') }; save.unlocked = { ...defaultSave().unlocked, ...(save.unlocked || {}) }; } catch (_) {}
  function persist() { localStorage.setItem(storeKey, JSON.stringify(save)); updateMenuNumbers(); }

  let W = 1280, H = 720, DPR = 1, hudH = 150, raceH = 570, horizon = 190;
  function resize() {
    DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    W = Math.max(720, Math.floor(innerWidth * DPR));
    H = Math.max(420, Math.floor(innerHeight * DPR));
    canvas.width = W; canvas.height = H;
    hudH = clamp(Math.floor(H * .18), 128 * DPR, 170 * DPR);
    raceH = H - hudH;
    horizon = Math.floor(raceH * .34);
  }
  addEventListener('resize', resize);
  resize();

  const img = {};
  function loadImage(key, src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => { img[key] = im; resolve(); };
      im.onerror = () => { img[key] = null; resolve(); };
      im.src = src;
    });
  }
  function preload() {
    const list = [];
    for (const car of CARS) list.push(loadImage(car.id, `assets/cars/${car.img}`));
    for (const tr of TRACK_DEFS) list.push(loadImage(`track-${tr.id}`, `assets/levelshots/${tr.shot}`));
    list.push(loadImage('gauge', 'assets/hud/gauge.png'));
    list.push(loadImage('needle', 'assets/hud/needle.png'));
    return Promise.all(list);
  }

  const sounds = {};
  function loadAudio() {
    for (const [k, src] of Object.entries({ go:'go.ogg', checkpoint:'checkpoint.ogg', scrape:'scrape.ogg', skid:'skid.ogg' })) {
      const a = new Audio(`assets/audio/${src}`); a.preload = 'auto'; sounds[k] = a;
    }
  }
  function sfx(k, vol=.25) { try { const a=sounds[k]; if(!a) return; const n=a.cloneNode(true); n.volume=vol; n.play().catch(()=>{}); } catch (_) {} }

  const controls = { gas:false, brake:false, left:false, right:false, handbrake:false };
  const held = new Set();
  const codeMap = {
    ArrowUp:'gas', KeyW:'gas', Numpad8:'gas',
    ArrowDown:'brake', KeyS:'brake', Numpad2:'brake', Numpad5:'brake',
    ArrowLeft:'left', KeyA:'left', Numpad4:'left',
    ArrowRight:'right', KeyD:'right', Numpad6:'right',
    Space:'handbrake', ShiftLeft:'handbrake', ShiftRight:'handbrake'
  };
  const keyMap = { w:'gas', W:'gas', ц:'gas', Ц:'gas', s:'brake', S:'brake', ы:'brake', Ы:'brake', a:'left', A:'left', ф:'left', Ф:'left', d:'right', D:'right', в:'right', В:'right', ' ':'handbrake' };
  function controlFromEvent(e) { return codeMap[e.code] || keyMap[e.key] || keyMap[String(e.key || '').toLowerCase()]; }
  function syncControls() {
    controls.gas = controls.brake = controls.left = controls.right = controls.handbrake = false;
    held.forEach(k => { const c = codeMap[k] || keyMap[k]; if (c) controls[c] = true; });
  }
  addEventListener('keydown', (e) => {
    const c = controlFromEvent(e);
    if (c) { held.add(e.code || e.key); if(e.key) held.add(e.key); syncControls(); e.preventDefault(); }
    const k = String(e.key || '').toLowerCase();
    if (e.code === 'KeyP' || k === 'p' || k === 'з') togglePause();
  }, { passive:false });
  addEventListener('keyup', (e) => {
    const c = controlFromEvent(e);
    if (c) { held.delete(e.code || e.key); if(e.key) held.delete(e.key); syncControls(); e.preventDefault(); }
  }, { passive:false });
  addEventListener('blur', () => { held.clear(); syncControls(); });
  document.querySelectorAll('[data-touch]').forEach(btn => {
    const name = btn.dataset.touch;
    const set = v => { if (controls[name] !== undefined) controls[name] = v; };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); set(true); btn.setPointerCapture(e.pointerId); });
    btn.addEventListener('pointerup', e => { e.preventDefault(); set(false); });
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('pointerleave', () => set(false));
  });

  const game = {
    mode:'menu', paused:false,
    car:CARS[0], track:TRACKS[0], diff:DIFF.normal,
    speed:0, position:0, playerX:0, steer:0, lateralV:0,
    lap:1, time:0, damage:0, raceCoins:0, totalMeters:0,
    traffic:[], coins:[], messageTimer:0, message:'', finishLock:0,
    roadCenterBottom:0, roadWidthBottom:1, hudBlink:0, skidTimer:0
  };

  function currentCar() { return CARS.find(c => c.id === save.selectedCar) || CARS[0]; }
  function currentTrack() { return TRACKS.find(t => t.id === save.selectedTrack) || TRACKS[0]; }
  function currentDiff() { return DIFF[save.difficulty] || DIFF.normal; }
  function segmentAt(track, z) { return track.segments[Math.floor(z / ROAD.segmentLength) % track.segments.length]; }
  function wrap(z, length) { z %= length; return z < 0 ? z + length : z; }
  function relZ(z, from, length) { let d = z - (from % length); if (d < -length/2) d += length; if (d > length/2) d -= length; return d; }

  function updateMenuNumbers() {
    totalCoinsEl.textContent = Math.floor(save.coins);
    garageOdoEl.textContent = `${(save.odometer / 1000).toFixed(1)} км`;
  }
  function buildMenu() {
    updateMenuNumbers();
    carsEl.innerHTML = '';
    for (const car of CARS) {
      const unlocked = !!save.unlocked[car.id];
      const el = document.createElement('button');
      el.className = `tile car-tile ${save.selectedCar === car.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}`;
      el.innerHTML = `
        <span class="price">${unlocked ? 'Открыта' : car.price + ' ◉'}</span>
        <div class="car-preview"><img src="assets/cars/${car.img}" alt="${car.name}"></div>
        <h3>${car.name}</h3><p>${car.desc}</p>
        <div class="stats"><span>Скорость ${car.max}</span><span>Разгон ${car.accel}</span><span>Руль ${car.steer.toFixed(2)}</span><span>Сцепл. ${car.grip.toFixed(2)}</span></div>`;
      el.addEventListener('click', () => {
        if (!unlocked) {
          if (save.coins >= car.price) { save.coins -= car.price; save.unlocked[car.id] = true; save.selectedCar = car.id; persist(); buildMenu(); }
          else msg(`Нужно ${car.price} монет`, 1000);
        } else { save.selectedCar = car.id; persist(); buildMenu(); }
      });
      carsEl.appendChild(el);
    }
    tracksEl.innerHTML = '';
    for (const tr of TRACKS) {
      const el = document.createElement('button');
      el.className = `tile track-tile ${save.selectedTrack === tr.id ? 'selected' : ''}`;
      el.innerHTML = `<div class="track-shot" style="background-image:url('assets/levelshots/${tr.shot}')"></div><h3>${tr.name}</h3><p>${tr.desc}</p><div class="stats"><span>Кругов ${tr.laps}</span><span>Сцепл. ${tr.grip.toFixed(2)}</span><span>Длина ${(tr.length/1000).toFixed(1)} км</span><span>${save.bestTimes[tr.id] ? fmtTime(save.bestTimes[tr.id]) : 'нет рек.'}</span></div>`;
      el.addEventListener('click', () => { save.selectedTrack = tr.id; persist(); buildMenu(); });
      tracksEl.appendChild(el);
    }
    diffEl.innerHTML = '';
    Object.entries(DIFF).forEach(([id, d]) => {
      const b = document.createElement('button');
      b.className = save.difficulty === id ? 'selected' : '';
      b.innerHTML = `${d.name}<br><small>${d.desc}</small>`;
      b.addEventListener('click', () => { save.difficulty = id; persist(); buildMenu(); });
      diffEl.appendChild(b);
    });
  }

  function msg(text, ms=900) {
    game.message = text; game.messageTimer = ms/1000;
    raceMessage.textContent = text; raceMessage.classList.remove('hidden');
  }

  function buildCoins() {
    game.coins = [];
    const count = Math.floor(game.track.length / 900);
    for (let i=0;i<count;i++) {
      const z = 900 + i * 900 + rand(-80, 80);
      const seg = segmentAt(game.track, z + 700);
      const laneX = pick([-.55, -.28, 0, .28, .55]);
      game.coins.push({ z: wrap(z, game.track.length), x: clamp(laneX - seg.curve * .10 + rand(-.04,.04), -.82, .82), taken:false });
    }
  }
  function buildTraffic() {
    game.traffic = [];
    const count = Math.floor((14 + game.track.length / 16000) * game.diff.traffic);
    for (let i=0;i<count;i++) {
      game.traffic.push({
        z: wrap(2600 + i * game.track.length / count + rand(0, 1200), game.track.length),
        x: pick([-.64, -.34, 0, .34, .64]) + rand(-.05, .05),
        speed: rand(50, 135),
        color: pick(['#ef4444','#2563eb','#ffd236','#fafafa','#22d375','#ff7b2a']),
        width: rand(.9, 1.12)
      });
    }
  }

  function startRace() {
    game.mode = 'race'; game.paused = false;
    game.car = currentCar(); game.track = currentTrack(); game.diff = currentDiff();
    game.speed = 0; game.position = 0; game.playerX = 0; game.steer = 0; game.lateralV = 0;
    game.lap = 1; game.time = 0; game.damage = 0; game.raceCoins = 0; game.totalMeters = 0; game.finishLock = 0; game.hudBlink = 0;
    buildCoins(); buildTraffic();
    menu.classList.add('hidden'); canvas.focus(); msg('GO!', 800); sfx('go', .35);
  }
  function finishRace() {
    if (game.finishLock) return;
    game.finishLock = 2.2;
    const bonus = Math.max(0, Math.floor(35 - game.damage * 30));
    const earned = Math.floor(game.raceCoins * game.diff.coins + bonus);
    save.coins += earned; save.odometer += game.totalMeters;
    if (!save.bestTimes[game.track.id] || game.time < save.bestTimes[game.track.id]) save.bestTimes[game.track.id] = game.time;
    persist(); msg(`ФИНИШ +${earned}`, 2200); sfx('checkpoint', .65);
    setTimeout(() => { game.mode='menu'; menu.classList.remove('hidden'); buildMenu(); }, 2250);
  }
  function togglePause() { if (game.mode !== 'race') return; game.paused = !game.paused; msg(game.paused ? 'Пауза' : 'GO!', 700); }
  startBtn.addEventListener('click', startRace);
  resetBtn.addEventListener('click', () => { if (confirm('Сбросить монеты, покупки, рекорды и одометр?')) { save = defaultSave(); persist(); buildMenu(); } });
  pauseBtn.addEventListener('click', togglePause);
  menuBtn.addEventListener('click', () => { game.mode='menu'; game.paused=false; menu.classList.remove('hidden'); buildMenu(); });

  function update(dt) {
    if (game.messageTimer > 0) { game.messageTimer -= dt; if (game.messageTimer <= 0) raceMessage.classList.add('hidden'); }
    if (game.mode !== 'race' || game.paused || game.finishLock) return;

    const car = game.car;
    const diff = game.diff;
    const track = game.track;
    const speedPct = clamp(game.speed / car.max, 0, 1.2);
    const nearSeg = segmentAt(track, game.position + 700);
    const offRoad = Math.abs(game.playerX) > .98;
    const deepOff = Math.abs(game.playerX) > 1.25;
    const grip = car.grip * diff.grip * track.grip * (offRoad ? (car.id === 'raptor' ? .82 : .48) : 1) * (controls.handbrake ? .58 : 1);

    let acc = 0;
    if (controls.gas) acc += car.accel * (1 - speedPct * .25);
    if (controls.brake) acc -= car.brake * (game.speed > 15 ? 1 : .55);
    if (!controls.gas) acc -= 18 + game.speed * .08;
    acc -= game.speed * game.speed * .0011;
    if (offRoad) acc -= 34 + game.speed * .34;
    if (controls.handbrake) acc -= 24;
    game.speed = clamp(game.speed + acc * dt, 0, car.max * (offRoad ? (car.id === 'raptor' ? .74 : .52) : 1));

    const input = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const steerTarget = input * (0.55 + speedPct * .85) * car.steer;
    game.steer = expLerp(game.steer, steerTarget, input ? 5.2 : 7.8, dt);

    const curveForce = nearSeg.curve * ROAD.centrifugal * speedPct * speedPct;
    const steerForce = game.steer * (0.72 + speedPct * .52) * grip / Math.sqrt(car.mass);
    const hand = controls.handbrake ? 1.45 : 1;
    game.lateralV += (steerForce * hand - curveForce * 1.55) * dt;
    game.lateralV *= Math.exp(-dt * (2.7 * clamp(grip, .35, 1.7)));
    game.playerX += game.lateralV * dt * (0.95 + speedPct * .70);

    if (Math.abs(game.playerX) > 1.42) {
      game.playerX = sign(game.playerX) * 1.42;
      game.lateralV *= -.12;
      game.damage = clamp(game.damage + dt * .024 * diff.damage, 0, 1);
      game.hudBlink = .15;
      if (Math.random() < dt * 2.2) sfx('scrape', .18);
    }
    if (deepOff) game.damage = clamp(game.damage + dt * .008 * diff.damage, 0, 1);

    const oldLap = game.lap;
    const units = game.speed * 56; // усиленное чувство скорости в игровых единицах
    game.position += units * dt;
    game.totalMeters += game.speed * (1000/3600) * dt;
    game.time += dt;
    game.lap = Math.floor(game.position / track.length) + 1;
    if (game.lap !== oldLap && game.lap <= track.laps) { msg(`Круг ${game.lap}/${track.laps}`, 900); sfx('checkpoint', .42); }
    if (game.lap > track.laps) finishRace();

    const slip = Math.abs(game.lateralV) * speedPct + Math.abs(game.steer) * speedPct * (controls.handbrake ? .45 : .12);
    if (slip > .44 && game.speed > 85) {
      game.skidTimer -= dt;
      if (game.skidTimer <= 0) { sfx('skid', .10); game.skidTimer = .48; }
    }
    updateObjects(dt);
    game.hudBlink = Math.max(0, game.hudBlink - dt);
  }

  function updateObjects(dt) {
    const track = game.track;
    for (const coin of game.coins) {
      if (coin.taken) { if (relZ(coin.z, game.position, track.length) < -1000) coin.taken = false; continue; }
      const dz = relZ(coin.z, game.position, track.length);
      if (dz > -80 && dz < 270 && Math.abs(coin.x - game.playerX) < .16) { coin.taken = true; game.raceCoins++; sfx('checkpoint', .14); }
    }
    for (const t of game.traffic) {
      t.z = wrap(t.z + t.speed * 32 * dt, track.length);
      const dz = relZ(t.z, game.position, track.length);
      if (dz > -110 && dz < 260 && Math.abs(t.x - game.playerX) < .22 * t.width && game.speed > 45) {
        game.damage = clamp(game.damage + (.06 + game.speed / 1650) * game.diff.damage, 0, 1);
        game.speed *= .62;
        game.lateralV += (game.playerX > t.x ? 1 : -1) * .45;
        t.x += (t.x > game.playerX ? 1 : -1) * .18;
        game.hudBlink = .35; msg('HIT!', 450); sfx('scrape', .5);
      }
    }
    if (game.damage >= 1) {
      game.finishLock = 1.7; msg('TOTAL DAMAGE', 1600); save.odometer += game.totalMeters; persist();
      setTimeout(() => { game.mode='menu'; menu.classList.remove('hidden'); buildMenu(); }, 1650);
    }
  }

  function palette(bg) {
    if (bg === 'night') return { sky1:'#071225', sky2:'#163d66', grass1:'#0b402e', grass2:'#0e5c3a', road1:'#60636a', road2:'#545860' };
    if (bg === 'lava') return { sky1:'#431220', sky2:'#df9145', grass1:'#613b20', grass2:'#7a4921', road1:'#5d5962', road2:'#514d55' };
    if (bg === 'valley') return { sky1:'#4ba4ff', sky2:'#80d3ff', grass1:'#18a34b', grass2:'#22c657', road1:'#6d7075', road2:'#60656b' };
    return { sky1:'#4aa4ff', sky2:'#82cfff', grass1:'#23c92f', grass2:'#52eb2f', road1:'#686b70', road2:'#5d6064' };
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    const track = game.mode === 'race' ? game.track : currentTrack();
    drawBackground(track);
    if (game.mode === 'race') {
      drawRoad(track);
      drawObjects();
      drawPlayerCar();
      drawHud();
    } else drawAttract(track);
  }

  function drawBackground(track) {
    const pal = palette(track.bg);
    const g = ctx.createLinearGradient(0,0,0,raceH);
    g.addColorStop(0, pal.sky1); g.addColorStop(1, pal.sky2);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,raceH);
    drawClouds(track.bg);
    const line = horizon - 8*DPR;
    if (track.bg === 'city' || track.bg === 'night') drawCity(line, track.bg === 'night');
    else if (track.bg === 'lava') drawLava(line);
    else if (track.bg === 'valley') drawMountains(line);
    else drawTrees(line);
    const stripe = Math.max(8*DPR, Math.round(9*DPR));
    const shift = game.mode === 'race' ? Math.floor((game.position * .018) % (stripe*2)) : 0;
    for (let y=Math.floor(line); y<raceH; y+=stripe) {
      ctx.fillStyle = (((y + shift) / stripe) | 0) % 2 ? pal.grass1 : pal.grass2;
      ctx.fillRect(0, y, W, stripe+1);
    }
  }
  function drawClouds(bg) {
    if (bg === 'night') {
      ctx.fillStyle = '#fff2a6';
      for (let i=0;i<40;i++) { const x=((i*197 - game.position*.006)%(W+20*DPR))-10*DPR; const y=(18+(i*31)%125)*DPR; ctx.fillRect(x,y,3*DPR,3*DPR); }
      return;
    }
    ctx.fillStyle = bg === 'lava' ? '#ffd9af' : '#fff';
    for (let i=0;i<8;i++) {
      const x=((i*250 - game.position*.006)%(W+220*DPR))-110*DPR, y=(22+(i*33)%105)*DPR, s=(2+(i%3))*DPR;
      ctx.fillRect(x,y+8*s,45*s,6*s); ctx.fillRect(x+11*s,y+2*s,27*s,10*s); ctx.fillRect(x+38*s,y+6*s,22*s,5*s); ctx.fillRect(x-12*s,y+13*s,19*s,4*s);
    }
  }
  function drawCity(y, night) {
    let x = -80*DPR - ((game.position*.007)%(130*DPR)), n=0;
    const colors = night ? ['#0b1120','#16233b','#25324a'] : ['#f4fbff','#c5e7ff','#172336'];
    while (x < W+110*DPR) {
      const bw=(34+(n*23)%68)*DPR, bh=(42+(n*37)%125)*DPR;
      ctx.fillStyle=colors[n%colors.length]; ctx.fillRect(x,y-bh,bw,bh);
      ctx.fillStyle=night ? '#ffe577' : '#77bce6';
      for(let yy=y-bh+10*DPR;yy<y-8*DPR;yy+=14*DPR) for(let xx=x+7*DPR;xx<x+bw-8*DPR;xx+=15*DPR) if((((xx+yy+n)|0)%5)) ctx.fillRect(xx,yy,7*DPR,3*DPR);
      x += bw + (5+n%4)*DPR; n++;
    }
  }
  function drawTrees(y) {
    ctx.fillStyle='#0b7c28';
    let x=-60*DPR - ((game.position*.008)%(90*DPR));
    while(x<W+100*DPR){ const w=(46+((x/DPR)|0)%34)*DPR; ctx.fillRect(x,y-18*DPR,w,18*DPR); ctx.fillStyle='#079023'; ctx.fillRect(x+8*DPR,y-25*DPR,w*.45,15*DPR); ctx.fillStyle='#0b7c28'; x+=w+18*DPR; }
  }
  function drawMountains(y) {
    let x = -40*DPR - ((game.position*.004)%(180*DPR));
    ctx.fillStyle='#0b7731';
    while(x<W+200*DPR){ const w=(140+((x/DPR)|0)%80)*DPR, h=(52+((x/DPR)|0)%55)*DPR; poly([[x,y],[x+w*.45,y-h],[x+w,y],[x,y]], '#0b7731'); x+=w*.72; }
  }
  function drawLava(y) {
    drawMountains(y); ctx.fillStyle='#ff6b1a'; for(let x=0;x<W;x+=90*DPR) ctx.fillRect(x,y-5*DPR,45*DPR,5*DPR);
  }

  function project(worldX, z) {
    const safeZ = Math.max(1, z);
    const scale = ROAD.cameraDepth / safeZ;
    return {
      x: Math.round((W/2) + scale * worldX * W/2),
      y: Math.round((raceH/2) + scale * ROAD.cameraHeight * raceH/2),
      w: Math.round(scale * ROAD.roadWidth * W/2),
      scale
    };
  }

  function drawRoad(track) {
    const pal = palette(track.bg);
    const base = Math.floor(game.position / ROAD.segmentLength);
    const basePercent = (game.position % ROAD.segmentLength) / ROAD.segmentLength;
    let x = 0;
    let dx = -(segmentAt(track, game.position).curve * basePercent);
    const cameraX = game.playerX * ROAD.roadWidth * 0.72;
    const rows = [];
    for (let n=0; n<ROAD.drawDistance; n++) {
      const seg = track.segments[(base + n) % track.segments.length];
      const z1 = n * ROAD.segmentLength - (game.position % ROAD.segmentLength) + ROAD.segmentLength;
      const z2 = (n + 1) * ROAD.segmentLength - (game.position % ROAD.segmentLength) + ROAD.segmentLength;
      const p1 = project(x * ROAD.roadWidth - cameraX, z1);
      const p2 = project((x + dx) * ROAD.roadWidth - cameraX, z2);
      rows.push({ seg, p1, p2, n });
      x += dx; dx += seg.curve * 0.045;
    }
    for (let i=rows.length-1; i>=0; i--) {
      const r = rows[i], p1 = r.p1, p2 = r.p2;
      if (p2.y > raceH || p1.y < horizon - 40*DPR) continue;
      const y1 = clamp(p1.y, horizon, raceH), y2 = clamp(p2.y, horizon, raceH);
      if (y1 <= y2) continue;
      const rumble1 = p1.w * 1.13, rumble2 = p2.w * 1.13;
      const road1 = p1.w, road2 = p2.w;
      const lane1 = road1 * 2 / ROAD.lanes, lane2 = road2 * 2 / ROAD.lanes;
      const alt = r.seg.color;
      drawQuad(p1.x-rumble1, y1, p1.x+rumble1, y1, p2.x+rumble2, y2, p2.x-rumble2, y2, alt ? '#d72a1b' : '#ffffff');
      drawQuad(p1.x-road1, y1, p1.x+road1, y1, p2.x+road2, y2, p2.x-road2, y2, alt ? pal.road1 : pal.road2);
      if (r.n > 5) {
        for (let lane=1; lane<ROAD.lanes; lane++) {
          if (((base + r.n) / 4 | 0) % 2 === 0) {
            const lx1 = p1.x - road1 + lane1 * lane;
            const lx2 = p2.x - road2 + lane2 * lane;
            drawQuad(lx1-3*DPR, y1, lx1+3*DPR, y1, lx2+2*DPR, y2, lx2-2*DPR, y2, '#eceff2');
          }
        }
      }
    }
    const near = rows.find(r => r.p2.y < raceH) || rows[0] || { p1:{x:W/2, w:W*.45} };
    game.roadCenterBottom = near.p1.x;
    game.roadWidthBottom = near.p1.w;
  }

  function screenPosFor(track, objZ, objX) {
    const dz = relZ(objZ, game.position, track.length);
    if (dz < 80 || dz > ROAD.drawDistance * ROAD.segmentLength) return null;
    const base = Math.floor(game.position / ROAD.segmentLength);
    const n = Math.floor(dz / ROAD.segmentLength);
    let x=0, dx=-(segmentAt(track, game.position).curve * ((game.position % ROAD.segmentLength)/ROAD.segmentLength));
    for (let i=0; i<n; i++) { const seg=track.segments[(base+i)%track.segments.length]; x += dx; dx += seg.curve * .045; }
    const cameraX = game.playerX * ROAD.roadWidth * .72;
    const p = project((x + objX) * ROAD.roadWidth - cameraX, dz + ROAD.segmentLength);
    return { x:p.x, y:p.y, scale:p.scale, w:p.w, dz };
  }

  function drawObjects() {
    const list = [];
    for (const c of game.coins) if (!c.taken) { const p = screenPosFor(game.track, c.z, c.x); if (p) list.push({ type:'coin', p }); }
    for (const t of game.traffic) { const p = screenPosFor(game.track, t.z, t.x); if (p) list.push({ type:'car', p, obj:t }); }
    list.sort((a,b)=>b.p.dz-a.p.dz);
    for (const item of list) {
      const p = item.p;
      if (item.type === 'coin') {
        const h = clamp(2800 * p.scale * H/720, 4*DPR, 34*DPR);
        ctx.fillStyle='#ffcc23'; ctx.fillRect(p.x-h*.25, p.y-h, h*.5, h);
        ctx.fillStyle='#fff07a'; ctx.fillRect(p.x-h*.08, p.y-h*.9, h*.16, h*.75);
        ctx.strokeStyle='#b97600'; ctx.lineWidth=Math.max(1,DPR); ctx.strokeRect(p.x-h*.25, p.y-h, h*.5, h);
      } else {
        const car = item.obj;
        const scale = clamp(2800 * p.scale * H/720, 4*DPR, 48*DPR) * car.width;
        drawNpcCar(p.x, p.y, scale, car.color);
      }
    }
  }

  function drawPlayerCar() {
    const car = game.car;
    const x = W/2 + game.playerX * W * .145;
    const baseY = raceH - 18*DPR;
    const size = clamp(W * .075, 80*DPR, 150*DPR);
    const lean = clamp(game.steer * 9 + game.lateralV * 8, -16, 16) * DPR;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(lean * Math.PI / 180 / DPR);
    if (img[car.id] && img[car.id].naturalWidth) {
      ctx.drawImage(img[car.id], -size*.55, -size*.72, size*1.1, size*.72);
    } else {
      drawFallbackPlayer(0,0,size,car.color);
    }
    if (game.speed > 20) {
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(-size*.42, -3*DPR, size*.84, 9*DPR);
    }
    ctx.restore();
  }

  function drawNpcCar(x, y, s, color) {
    ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(x-s*.62, y-s*.12, s*1.24, s*.18);
    ctx.fillStyle='#090b0d'; ctx.fillRect(x-s*.58, y-s*.76, s*.24, s*.74); ctx.fillRect(x+s*.34, y-s*.76, s*.24, s*.74);
    ctx.fillStyle=color; ctx.fillRect(x-s*.45, y-s*.90, s*.90, s*.82);
    ctx.fillStyle='#b7f3ff'; ctx.fillRect(x-s*.25, y-s*.82, s*.5, s*.22);
    ctx.fillStyle='#fff2b8'; ctx.fillRect(x-s*.36, y-s*.22, s*.18, s*.08); ctx.fillRect(x+s*.18, y-s*.22, s*.18, s*.08);
  }
  function drawFallbackPlayer(x,y,size,color){
    ctx.fillStyle='#05070a'; ctx.fillRect(x-size*.55,y-size*.66,size*.22,size*.62); ctx.fillRect(x+size*.33,y-size*.66,size*.22,size*.62);
    ctx.fillStyle=color; ctx.fillRect(x-size*.40,y-size*.76,size*.80,size*.68);
    ctx.fillStyle='#111827'; ctx.fillRect(x-size*.22,y-size*.64,size*.44,size*.17);
    ctx.fillStyle='#ffe98a'; ctx.fillRect(x-size*.32,y-size*.18,size*.18,size*.08); ctx.fillRect(x+size*.14,y-size*.18,size*.18,size*.08);
  }

  function drawHud() {
    ctx.fillStyle = game.hudBlink > 0 ? '#170607' : '#020304';
    ctx.fillRect(0, raceH, W, hudH);
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=2*DPR;
    for(let y=raceH+20*DPR; y<H; y+=31*DPR){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    const kmh = Math.round(game.speed);
    const leftX = 10*DPR, top = raceH + 26*DPR;
    pixelText('SPEED', leftX, raceH+21*DPR, 14*DPR, '#fff');
    pixelText(String(kmh).padStart(3,'0'), leftX, top+35*DPR, 42*DPR, '#ff423f');
    pixelText('km/h', leftX + 112*DPR, top+39*DPR, 16*DPR, '#fff');
    pixelText('GEAR', leftX, top+75*DPR, 14*DPR, '#fff');
    const gear = kmh < 25 ? 1 : kmh < 70 ? 2 : kmh < 120 ? 3 : kmh < 180 ? 4 : 5;
    pixelText(String(gear), leftX+60*DPR, top+79*DPR, 30*DPR, '#ff423f');
    pixelText('DAMAGE', leftX+158*DPR, top+75*DPR, 14*DPR, '#fff');
    bar(leftX+255*DPR, top+70*DPR, 250*DPR, 14*DPR, game.damage, '#ff3a3a');

    drawGauge(W*.36, raceH+hudH*.57, Math.min(65*DPR,hudH*.38), clamp(game.speed/game.car.max,0,1), 'TACH');
    drawGauge(W*.54, raceH+hudH*.57, Math.min(65*DPR,hudH*.38), clamp(game.speed/260,0,1), 'MPH/KMH');

    pixelText('LAP', W*.44, top, 16*DPR, '#fff'); pixelText(`${Math.min(game.lap,game.track.laps)}/${game.track.laps}`, W*.49, top+2*DPR, 28*DPR, '#36ff83');
    pixelText('TIME', W*.44, top+37*DPR, 16*DPR, '#fff'); pixelText(fmtTime(game.time), W*.49, top+36*DPR, 24*DPR, '#ff423f');
    pixelText('COINS', W*.44, top+74*DPR, 16*DPR, '#fff'); pixelText(String(game.raceCoins), W*.49, top+73*DPR, 25*DPR, '#ffdf2e');

    const turn = (controls.right?1:0)-(controls.left?1:0);
    pixelText('TURN', W*.64, top+52*DPR, 12*DPR, '#fff');
    drawArrow(W*.63, top+85*DPR, -1, turn<0?'#ffe12b':'#3a3f46'); drawArrow(W*.69, top+85*DPR, 1, turn>0?'#ffe12b':'#3a3f46');

    const progress = clamp((game.position % game.track.length) / game.track.length, 0, 1);
    pixelText('DISTANCE', W*.72, top, 16*DPR, '#fff'); bar(W*.72, top+22*DPR, W*.22, 14*DPR, progress, '#ff423f');
    pixelText(`${Math.floor(progress*game.track.length/10)} m`, W*.72, top+54*DPR, 16*DPR, '#fff');
    pixelText('ODOMETER', W*.72, top+86*DPR, 14*DPR, '#c9d6ef'); pixelText(`${(game.totalMeters/1000).toFixed(2)} km`, W*.82, top+85*DPR, 18*DPR, '#ffdf2e');
    drawMiniMap(W-130*DPR, raceH+15*DPR, 115*DPR, hudH-30*DPR);
  }
  function drawGauge(cx, cy, r, pct, label) {
    ctx.save(); ctx.translate(cx,cy);
    if (img.gauge) ctx.drawImage(img.gauge, -r, -r, r*2, r*2);
    else { ctx.strokeStyle='#fff'; ctx.lineWidth=4*DPR; ctx.beginPath(); ctx.arc(0,0,r,Math.PI*.78,Math.PI*2.22); ctx.stroke(); }
    const a = Math.PI*.78 + pct * Math.PI*1.44;
    ctx.strokeStyle='#ffd633'; ctx.lineWidth=4*DPR; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*r*.74, Math.sin(a)*r*.74); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,5*DPR,0,Math.PI*2); ctx.fill();
    pixelText(label, -r*.65, -r-12*DPR, 10*DPR, '#fff');
    ctx.restore();
  }
  function drawMiniMap(x,y,w,h) {
    ctx.fillStyle='#063019'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='#d8f1e4'; ctx.lineWidth=2*DPR; ctx.strokeRect(x,y,w,h);
    const pts = game.track.segments.filter((_,i)=>i%12===0).map((s,i,arr)=>{
      const a = i/arr.length * Math.PI*2;
      const r = .32 + .18*Math.sin(i*.73) + .08*Math.cos(i*1.7);
      return [x+w/2+Math.cos(a)*w*r, y+h/2+Math.sin(a)*h*r];
    });
    ctx.strokeStyle='#e5fff1'; ctx.lineWidth=3*DPR; ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); ctx.stroke();
    const p = clamp((game.position % game.track.length)/game.track.length,0,1); const idx=Math.floor(p*pts.length)%pts.length; const dot=pts[idx]||[x+w/2,y+h/2];
    ctx.fillStyle='#ff3a3a'; ctx.fillRect(dot[0]-4*DPR,dot[1]-4*DPR,8*DPR,8*DPR);
  }

  function drawAttract(track) {
    ctx.fillStyle='rgba(0,0,0,.16)'; ctx.fillRect(0, raceH-48*DPR, W, 48*DPR);
    pixelText('RETRO RALLY', 28*DPR, raceH-22*DPR, 22*DPR, '#fff');
  }

  function drawQuad(x1,y1,x2,y2,x3,y3,x4,y4,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.lineTo(x4,y4); ctx.closePath(); ctx.fill(); }
  function poly(points, color){ ctx.fillStyle=color; ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); ctx.fill(); }
  function bar(x,y,w,h,p,color){ ctx.strokeStyle='#d6dde8'; ctx.lineWidth=2*DPR; ctx.strokeRect(x,y,w,h); ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(x+2*DPR,y+2*DPR,w-4*DPR,h-4*DPR); ctx.fillStyle=color; ctx.fillRect(x+2*DPR,y+2*DPR,(w-4*DPR)*clamp(p,0,1),h-4*DPR); }
  function drawArrow(x,y,dir,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(x+dir*24*DPR,y); ctx.lineTo(x-dir*4*DPR,y-18*DPR); ctx.lineTo(x-dir*4*DPR,y+18*DPR); ctx.closePath(); ctx.fill(); }
  function pixelText(text,x,y,size,color){ ctx.fillStyle=color; ctx.font=`900 ${size}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline='middle'; ctx.shadowColor='#000'; ctx.shadowBlur=0; ctx.shadowOffsetX=Math.max(1,DPR*2); ctx.shadowOffsetY=Math.max(1,DPR*2); ctx.fillText(text,x,y); ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now-last)/1000)); last = now;
    update(dt); render(); requestAnimationFrame(loop);
  }

  preload().then(() => { loadAudio(); buildMenu(); requestAnimationFrame(loop); });
})();
