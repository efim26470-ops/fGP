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
  const ease = (t) => (1 - Math.cos(clamp(t, 0, 1) * Math.PI)) / 2;
  const sign = (v) => v < 0 ? -1 : 1;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const fmtTime = (s) => {
    const m = Math.floor(Math.max(0, s) / 60);
    const sec = Math.floor(Math.max(0, s) % 60);
    const cs = Math.floor((Math.max(0, s) * 100) % 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const ROAD = {
    segmentLength: 200,
    roadWidth: 2200,
    lanes: 3,
    cameraDepth: 700,
    drawDistance: 250,
    curveStep: 0.050
  };

  const ASSETS = {
    gauge: 'assets/hud/gauge.png',
    needle: 'assets/hud/needle.png',
    alpine: 'assets/cars/alpine.png',
    mini: 'assets/cars/mini.png',
    roadster: 'assets/cars/roadster.png',
    camaro: 'assets/cars/camaro.png',
    viper: 'assets/cars/viper.png',
    sidepipe: 'assets/cars/sidepipe.png',
    raptor: 'assets/cars/raptor.png',
    slingshot: 'assets/cars/slingshot.png'
  };
  const AUDIO = {
    go: 'assets/audio/go.ogg',
    checkpoint: 'assets/audio/checkpoint.ogg',
    skid: 'assets/audio/skid.ogg',
    scrape: 'assets/audio/scrape.ogg'
  };
  const images = {};
  const sounds = {};
  function loadImages() {
    return Promise.all(Object.entries(ASSETS).map(([k, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[k] = img; resolve(); };
      img.onerror = () => { images[k] = null; resolve(); };
      img.src = src;
    })));
  }
  function loadAudio() {
    Object.entries(AUDIO).forEach(([k, src]) => {
      const a = new Audio(src);
      a.preload = 'auto';
      sounds[k] = a;
    });
  }
  function sfx(k, vol = .25) {
    const a = sounds[k];
    if (!a) return;
    try {
      const n = a.cloneNode(true);
      n.volume = vol;
      n.play().catch(() => {});
    } catch (_) {}
  }

  const CARS = [
    { id: 'alpine', name: 'Alpine 8V', price: 0, img: 'alpine', color: '#ffd337', maxKmh: 178, accel: 3600, brake: 4300, turn: 1.04, grip: 1.16, mass: .92, drift: .58, desc: 'стабильный стартовый баланс' },
    { id: 'mini', name: 'Mini Rally', price: 180, img: 'mini', color: '#52cbff', maxKmh: 158, accel: 3950, brake: 4650, turn: 1.20, grip: 1.32, mass: .78, drift: .35, desc: 'цепкая, легче рулится' },
    { id: 'roadster', name: 'Roadster', price: 420, img: 'roadster', color: '#ff314d', maxKmh: 205, accel: 4200, brake: 4550, turn: 1.05, grip: 1.08, mass: .90, drift: .75, desc: 'быстрее, но нервнее' },
    { id: 'camaro', name: 'Camaro GT', price: 680, img: 'camaro', color: '#ffb128', maxKmh: 218, accel: 4450, brake: 4200, turn: .92, grip: .98, mass: 1.18, drift: .95, desc: 'тяжёлый маслкар' },
    { id: 'viper', name: 'Viper R', price: 980, img: 'viper', color: '#ff4336', maxKmh: 238, accel: 4750, brake: 4550, turn: .98, grip: 1.04, mass: 1.05, drift: .92, desc: 'очень быстрая' },
    { id: 'sidepipe', name: 'Sidepipe V8', price: 1450, img: 'sidepipe', color: '#ff7c2b', maxKmh: 248, accel: 4950, brake: 4520, turn: .90, grip: .99, mass: 1.14, drift: 1.06, desc: 'силовая, требует плавности' },
    { id: 'raptor', name: 'Raptor 4x4', price: 1650, img: 'raptor', color: '#111820', maxKmh: 194, accel: 4050, brake: 4300, turn: .88, grip: 1.48, mass: 1.38, drift: .28, desc: 'лучше всех держит обочину' },
    { id: 'slingshot', name: 'Slingshot X', price: 2200, img: 'slingshot', color: '#315dff', maxKmh: 265, accel: 5350, brake: 5100, turn: .95, grip: .98, mass: .98, drift: 1.18, desc: 'максималка и риск' }
  ];

  const DIFFICULTY = {
    easy: { name: 'Лёгкая', traffic: .60, damage: .55, grip: 1.15, coins: 1, desc: 'меньше трафика' },
    normal: { name: 'Нормальная', traffic: 1, damage: 1, grip: 1, coins: 1.15, desc: 'баланс' },
    hard: { name: 'Хард', traffic: 1.55, damage: 1.35, grip: .90, coins: 1.45, desc: 'сложнее, но богаче' }
  };

  const TRACK_DEFS = [
    { id: 'country', name: 'Roll On Down The Line', shot: 'country', laps: 3, bg: 'country', grip: 1.08, desc: 'прямые и плавные дуги', parts: [[80,0],[45,.45],[70,0],[55,-.55],[70,0],[55,.75],[45,.20],[90,0],[70,-.85],[55,0],[45,.45],[90,0]] },
    { id: 'downtown', name: 'Downtown Sprint', shot: 'downtown', laps: 3, bg: 'city', grip: .98, desc: 'короткие прямые и городские связки', parts: [[40,0],[45,.95],[35,0],[45,-1.05],[35,.25],[55,.85],[40,-.70],[55,0],[50,-.95],[45,.75],[60,0]] },
    { id: 'nightcity', name: 'Night City Loop', shot: 'nightcity', laps: 4, bg: 'night', grip: .92, desc: 'ночь, скользко и быстро', parts: [[50,0],[75,.38],[45,-.90],[45,-.35],[70,.95],[40,0],[80,-1.05],[55,.85],[65,0]] },
    { id: 'lava', name: 'Lavafalls Ridge', shot: 'lavafalls', laps: 2, bg: 'lava', grip: .88, desc: 'опасные повороты и низкое сцепление', parts: [[65,0],[60,-.75],[35,.65],[70,-1.08],[50,0],[75,1.05],[35,-.30],[70,0],[60,.80],[60,-.85]] },
    { id: 'valley', name: 'Valley Run', shot: 'valley', laps: 3, bg: 'valley', grip: 1.14, desc: 'широкий быстрый поток', parts: [[100,0],[85,.28],[70,0],[75,-.36],[90,0],[70,.55],[75,0],[70,-.55],[95,0]] }
  ];

  function makeTrack(def) {
    const segments = [];
    let curve = 0;
    let i = 0;
    const add = (count, target) => {
      for (let n = 0; n < count; n++) {
        const t = count <= 1 ? 1 : n / (count - 1);
        curve = lerp(curve, target, .035 + .08 * ease(t));
        segments.push({ index: i, z: i * ROAD.segmentLength, curve, color: Math.floor(i / 4) % 2 });
        i++;
      }
    };
    def.parts.forEach(([count, c]) => add(count, c));
    add(80, 0);
    return { ...def, segments, length: segments.length * ROAD.segmentLength };
  }
  const TRACKS = TRACK_DEFS.map(makeTrack);

  const defaultSave = () => ({
    coins: 0,
    selectedCar: 'alpine',
    selectedTrack: 'country',
    difficulty: 'normal',
    unlocked: { alpine: true },
    bestTimes: {},
    odometer: 0
  });
  const storeKey = 'q3-html-retro-rally-v8';
  let save = defaultSave();
  try {
    save = { ...defaultSave(), ...(JSON.parse(localStorage.getItem(storeKey) || '{}')) };
    save.unlocked = { ...defaultSave().unlocked, ...(save.unlocked || {}) };
    save.bestTimes = save.bestTimes || {};
  } catch (_) {}
  function persist() {
    localStorage.setItem(storeKey, JSON.stringify(save));
    updateMenuNumbers();
  }

  const controls = { gas: false, brake: false, left: false, right: false, handbrake: false };
  const active = new Set();
  const codeMap = {
    ArrowUp: 'gas', KeyW: 'gas', Numpad8: 'gas',
    ArrowDown: 'brake', KeyS: 'brake', Numpad2: 'brake', Numpad5: 'brake',
    ArrowLeft: 'left', KeyA: 'left', Numpad4: 'left',
    ArrowRight: 'right', KeyD: 'right', Numpad6: 'right',
    Space: 'handbrake', ShiftLeft: 'handbrake', ShiftRight: 'handbrake'
  };
  const keyMap = {
    w: 'gas', W: 'gas', ц: 'gas', Ц: 'gas',
    s: 'brake', S: 'brake', ы: 'brake', Ы: 'brake',
    a: 'left', A: 'left', ф: 'left', Ф: 'left',
    d: 'right', D: 'right', в: 'right', В: 'right',
    ' ': 'handbrake'
  };
  function syncControls() {
    controls.gas = controls.brake = controls.left = controls.right = controls.handbrake = false;
    for (const k of active) {
      const c = codeMap[k] || keyMap[k];
      if (c) controls[c] = true;
    }
  }
  function eventControl(e) { return codeMap[e.code] || keyMap[e.key] || keyMap[String(e.key || '').toLowerCase()]; }
  addEventListener('keydown', (e) => {
    const c = eventControl(e);
    if (c) {
      active.add(e.code || e.key);
      if (e.key) active.add(e.key);
      syncControls();
      e.preventDefault();
    }
    const k = String(e.key || '').toLowerCase();
    if (e.code === 'KeyP' || k === 'p' || k === 'з') togglePause();
  }, { passive: false });
  addEventListener('keyup', (e) => {
    const c = eventControl(e);
    if (c) {
      active.delete(e.code || e.key);
      if (e.key) active.delete(e.key);
      syncControls();
      e.preventDefault();
    }
  }, { passive: false });
  addEventListener('blur', () => { active.clear(); syncControls(); });
  document.querySelectorAll('[data-touch]').forEach((btn) => {
    const name = btn.dataset.touch;
    const set = (v) => { if (controls[name] !== undefined) controls[name] = v; };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); btn.setPointerCapture(e.pointerId); });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); set(false); });
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('pointerleave', () => set(false));
  });

  let W = 1280, H = 720, DPR = 1, hudH = 160, horizon = 245, roadBottom = 560;
  function resize() {
    DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    W = Math.max(720, Math.floor(innerWidth * DPR));
    H = Math.max(420, Math.floor(innerHeight * DPR));
    canvas.width = W;
    canvas.height = H;
    hudH = clamp(Math.floor(H * .19), 132 * DPR, 176 * DPR);
    roadBottom = H - hudH;
    horizon = Math.floor(roadBottom * .39);
  }
  addEventListener('resize', resize);
  resize();

  const game = {
    mode: 'menu', paused: false,
    car: CARS[0], track: TRACKS[0], diff: DIFFICULTY.normal,
    speed: 0, maxSpeed: 1, position: 0, playerX: 0, lateralV: 0, steer: 0,
    lap: 1, time: 0, damage: 0, raceCoins: 0, totalMeters: 0,
    coins: [], traffic: [], messageTimer: 0, finishLock: 0, shake: 0, skidTimer: 0, speedFx: 0, lastRoadRows: []
  };

  function currentCar() { return CARS.find(c => c.id === save.selectedCar) || CARS[0]; }
  function currentTrack() { return TRACKS.find(t => t.id === save.selectedTrack) || TRACKS[0]; }
  function currentDiff() { return DIFFICULTY[save.difficulty] || DIFFICULTY.normal; }
  function wrap(z, len) { z %= len; return z < 0 ? z + len : z; }
  function baseIndex(track) { return Math.floor((game.position % track.length) / ROAD.segmentLength) % track.segments.length; }
  function segmentAt(track, z) {
    const idx = Math.floor((((z % track.length) + track.length) % track.length) / ROAD.segmentLength) % track.segments.length;
    return track.segments[idx];
  }
  function relZ(z, pos, len) {
    let d = z - (pos % len);
    if (d < -ROAD.segmentLength) d += len;
    return d;
  }

  function updateMenuNumbers() {
    if (totalCoinsEl) totalCoinsEl.textContent = Math.floor(save.coins);
    if (garageOdoEl) garageOdoEl.textContent = `${(save.odometer / 1000).toFixed(1)} км`;
  }
  function msg(text, ms = 900) {
    raceMessage.textContent = text;
    raceMessage.classList.remove('hidden');
    game.messageTimer = ms / 1000;
  }

  function buildMenu() {
    carsEl.innerHTML = '';
    CARS.forEach((car) => {
      const unlocked = !!save.unlocked[car.id];
      const selected = save.selectedCar === car.id;
      const card = document.createElement('button');
      card.className = `card car-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <img src="assets/cars/${car.img}.png" alt="${car.name}" loading="lazy" onerror="this.style.display='none'">
        <div>
          <h3>${car.name}</h3>
          <div class="meta"><span>${car.desc}</span><span>${unlocked ? 'Открыта' : `Цена: ${car.price} монет`}</span></div>
          <div class="bars">
            <div class="bar"><i style="width:${clamp(car.maxKmh / 265 * 100, 5, 100)}%"></i></div>
            <div class="bar"><i style="width:${clamp(car.accel / 5350 * 100, 5, 100)}%"></i></div>
            <div class="bar"><i style="width:${clamp(car.turn / 1.20 * 100, 5, 100)}%"></i></div>
          </div>
        </div>
        <span class="card-action ${unlocked ? '' : 'buy'}">${unlocked ? (selected ? 'Выбрано' : 'Выбрать') : 'Купить'}</span>`;
      card.addEventListener('click', () => {
        if (!unlocked) {
          if (save.coins >= car.price) {
            save.coins -= car.price; save.unlocked[car.id] = true; save.selectedCar = car.id; persist(); buildMenu(); msg('Куплено', 850);
          } else msg(`Нужно ${car.price - save.coins} монет`, 1100);
          return;
        }
        save.selectedCar = car.id; persist(); buildMenu();
      });
      carsEl.appendChild(card);
    });
    tracksEl.innerHTML = '';
    TRACKS.forEach((track) => {
      const selected = save.selectedTrack === track.id;
      const card = document.createElement('button');
      card.className = `card track-card ${selected ? 'selected' : ''}`;
      card.style.backgroundImage = `url(assets/levelshots/${track.shot}.jpg)`;
      const best = save.bestTimes[track.id] ? `Лучшее: ${fmtTime(save.bestTimes[track.id])}` : 'Лучшее: —';
      card.innerHTML = `<div><h3>${track.name}</h3><div class="meta"><span>${track.desc}</span><span>${track.laps} круга • ${(track.length / 1000).toFixed(1)} км • ${best}</span></div></div>`;
      card.addEventListener('click', () => { save.selectedTrack = track.id; persist(); buildMenu(); });
      tracksEl.appendChild(card);
    });
    diffEl.innerHTML = '';
    Object.entries(DIFFICULTY).forEach(([id, d]) => {
      const b = document.createElement('button');
      b.className = `diff-btn ${save.difficulty === id ? 'selected' : ''}`;
      b.innerHTML = `${d.name}<br><small>${d.desc}</small>`;
      b.addEventListener('click', () => { save.difficulty = id; persist(); buildMenu(); });
      diffEl.appendChild(b);
    });
    updateMenuNumbers();
  }

  function buildCoins() {
    game.coins = [];
    const count = Math.floor(game.track.length / 600);
    for (let i = 0; i < count; i++) {
      game.coins.push({ z: wrap(1000 + i * game.track.length / count + rand(-140, 140), game.track.length), x: pick([-.55, -.30, 0, .30, .55]) + rand(-.025, .025), taken: false, spin: Math.random() * 10 });
    }
  }
  function buildTraffic() {
    game.traffic = [];
    const count = Math.floor((15 + game.track.length / 3900) * game.diff.traffic);
    for (let i = 0; i < count; i++) {
      game.traffic.push({ z: wrap(1500 + i * game.track.length / count + rand(0, 1000), game.track.length), x: pick([-.58, -.28, .28, .58]) + rand(-.04, .04), speed: rand(650, 1450), color: pick(['#ef4444', '#2563eb', '#ffd236', '#f7f7f7', '#22d375', '#ff7b2a']), width: rand(.86, 1.12) });
    }
  }

  function startRace() {
    game.mode = 'race'; game.paused = false;
    game.car = currentCar(); game.track = currentTrack(); game.diff = currentDiff();
    game.maxSpeed = game.car.maxKmh * 47; // внутренняя скорость: калибрована под ощущение дороги
    game.speed = 0; game.position = 0; game.playerX = 0; game.lateralV = 0; game.steer = 0;
    game.lap = 1; game.time = 0; game.damage = 0; game.raceCoins = 0; game.totalMeters = 0;
    game.finishLock = 0; game.shake = 0; game.speedFx = 0;
    buildCoins(); buildTraffic();
    menu.classList.add('hidden');
    canvas.focus(); msg('GO!', 850); sfx('go', .42);
  }
  function finishRace() {
    if (game.finishLock > 0) return;
    game.finishLock = 2.4;
    const bonus = Math.max(0, Math.floor(40 - game.damage * 35));
    const earned = Math.floor(game.raceCoins * game.diff.coins + bonus);
    save.coins += earned; save.odometer += game.totalMeters;
    if (!save.bestTimes[game.track.id] || game.time < save.bestTimes[game.track.id]) save.bestTimes[game.track.id] = game.time;
    persist(); msg(`ФИНИШ +${earned}`, 2400); sfx('checkpoint', .65);
    setTimeout(() => { game.mode = 'menu'; menu.classList.remove('hidden'); buildMenu(); }, 2400);
  }
  function togglePause() {
    if (game.mode !== 'race') return;
    game.paused = !game.paused;
    msg(game.paused ? 'Пауза' : 'GO!', 700);
  }
  startBtn.addEventListener('click', startRace);
  resetBtn.addEventListener('click', () => { if (confirm('Сбросить монеты, покупки, рекорды и одометр?')) { save = defaultSave(); persist(); buildMenu(); } });
  pauseBtn.addEventListener('click', togglePause);
  menuBtn.addEventListener('click', () => { game.mode = 'menu'; game.paused = false; menu.classList.remove('hidden'); buildMenu(); });

  function update(dt) {
    if (game.messageTimer > 0) {
      game.messageTimer -= dt;
      if (game.messageTimer <= 0) raceMessage.classList.add('hidden');
    }
    if (game.mode !== 'race' || game.paused || game.finishLock > 0) return;

    const car = game.car;
    const track = game.track;
    const diff = game.diff;
    const ahead = segmentAt(track, game.position + 520);
    const speedPct = clamp(game.speed / game.maxSpeed, 0, 1.25);
    const offroad = Math.abs(game.playerX) > 1.02;
    const deepOffroad = Math.abs(game.playerX) > 1.28;
    const traction = car.grip * track.grip * diff.grip * (offroad ? (car.id === 'raptor' ? .82 : .50) : 1) * (controls.handbrake ? .58 : 1);

    let accel = 0;
    if (controls.gas) accel += car.accel * (1 - speedPct * .34);
    if (controls.brake) accel -= car.brake * (game.speed > 320 ? 1 : .60);
    if (!controls.gas) accel -= 620 + game.speed * .040;
    accel -= game.speed * game.speed * .000075;
    if (offroad) accel -= 850 + game.speed * .13;
    if (controls.handbrake && game.speed > 900) accel -= 520;
    game.speed = clamp(game.speed + accel * dt, 0, game.maxSpeed * (offroad ? (car.id === 'raptor' ? .76 : .56) : 1));

    const input = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const steerRate = input ? 4.6 : 6.8;
    game.steer = lerp(game.steer, input, 1 - Math.exp(-dt * steerRate));

    const curvePush = ahead.curve * speedPct * speedPct * (0.56 + 0.20 / Math.max(.4, traction));
    const maxLat = (0.60 + 0.32 * (1 - speedPct)) * car.turn * Math.sqrt(clamp(traction, .22, 1.7)) / Math.sqrt(car.mass);
    const wantedLat = game.steer * maxLat * (controls.handbrake ? 1.08 : 1) - curvePush;
    const latResponse = (controls.handbrake ? 2.2 : 3.6) * clamp(traction, .28, 1.7);
    game.lateralV = lerp(game.lateralV, wantedLat, 1 - Math.exp(-dt * latResponse));
    game.lateralV *= Math.exp(-dt * (offroad ? 1.5 : .25));
    game.playerX += game.lateralV * dt;

    if (Math.abs(game.playerX) > 1.42) {
      game.playerX = sign(game.playerX) * 1.42;
      game.lateralV *= -.18;
      game.damage = clamp(game.damage + dt * .035 * diff.damage, 0, 1);
      game.shake = Math.max(game.shake, .36);
      if (Math.random() < dt * 3.4) sfx('scrape', .20);
    }
    if (deepOffroad) game.damage = clamp(game.damage + dt * .010 * diff.damage, 0, 1);

    const oldLap = game.lap;
    game.position += game.speed * dt;
    game.totalMeters += game.speed * dt / 30;
    game.time += dt;
    game.lap = Math.floor(game.position / track.length) + 1;
    if (game.lap !== oldLap && game.lap <= track.laps) { msg(`Круг ${game.lap}/${track.laps}`, 1000); sfx('checkpoint', .45); }
    if (game.lap > track.laps) finishRace();

    const slip = Math.abs(game.lateralV) * speedPct + Math.abs(game.steer) * speedPct * (controls.handbrake ? .55 : .18) + (offroad ? .18 : 0);
    if (slip > .46 && game.speed > 1200) {
      game.skidTimer -= dt;
      if (game.skidTimer <= 0) { sfx('skid', .13); game.skidTimer = .50; }
    }
    game.speedFx = lerp(game.speedFx, speedPct, 1 - Math.exp(-dt * 4.0));
    game.shake = Math.max(0, game.shake - dt * 1.9);
    updateObjects(dt);
  }

  function updateObjects(dt) {
    const track = game.track;
    for (const coin of game.coins) {
      if (coin.taken) {
        if (relZ(coin.z, game.position, track.length) < -800) coin.taken = false;
        continue;
      }
      const dz = relZ(coin.z, game.position, track.length);
      if (dz > -70 && dz < 300 && Math.abs(coin.x - game.playerX) < .17) {
        coin.taken = true; game.raceCoins++; sfx('checkpoint', .15);
      }
    }
    for (const t of game.traffic) {
      t.z = wrap(t.z + t.speed * dt, track.length);
      const dz = relZ(t.z, game.position, track.length);
      if (dz > -120 && dz < 280 && Math.abs(t.x - game.playerX) < .24 * t.width && game.speed > 620) {
        game.damage = clamp(game.damage + (.08 + game.speed / 15500) * game.diff.damage, 0, 1);
        game.speed *= .62;
        game.lateralV += (game.playerX > t.x ? 1 : -1) * .35;
        t.x += (t.x > game.playerX ? 1 : -1) * .16;
        game.shake = 1;
        msg('HIT!', 420); sfx('scrape', .55);
      }
    }
    if (game.damage >= 1) {
      game.finishLock = 1.7; msg('TOTAL DAMAGE', 1600); save.odometer += game.totalMeters; persist();
      setTimeout(() => { game.mode = 'menu'; menu.classList.remove('hidden'); buildMenu(); }, 1650);
    }
  }

  function bgPalette(bg) {
    if (bg === 'night') return { sky1: '#06132d', sky2: '#123b60', grass1: '#0d3b2a', grass2: '#0e4d35', road1: '#5a5c60', road2: '#515359' };
    if (bg === 'lava') return { sky1: '#331123', sky2: '#c9813a', grass1: '#5f3a21', grass2: '#754822', road1: '#575057', road2: '#4c474d' };
    if (bg === 'valley') return { sky1: '#52a7ff', sky2: '#7fd0ff', grass1: '#18a44b', grass2: '#22bd57', road1: '#686b6f', road2: '#5d6064' };
    return { sky1: '#52a7ff', sky2: '#7fd0ff', grass1: '#24ce30', grass2: '#52ed2f', road1: '#66696d', road2: '#5d6062' };
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (game.shake > 0) ctx.translate(rand(-2, 2) * DPR * game.shake, rand(-1.5, 1.5) * DPR * game.shake);
    const track = game.mode === 'race' ? game.track : currentTrack();
    drawBackground(track);
    if (game.mode === 'race') {
      drawRoad(track);
      drawObjects();
      drawPlayerCar();
      if (game.speedFx > .56) drawSpeedLines();
      drawHud();
    } else {
      drawAttract(track);
    }
    ctx.restore();
  }

  function drawBackground(track) {
    const pal = bgPalette(track.bg);
    const grad = ctx.createLinearGradient(0, 0, 0, roadBottom);
    grad.addColorStop(0, pal.sky1); grad.addColorStop(1, pal.sky2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, roadBottom);
    drawClouds(track.bg);
    const hline = horizon - 8 * DPR;
    if (track.bg === 'city' || track.bg === 'night') drawCity(hline, track.bg === 'night');
    else if (track.bg === 'lava') drawLava(hline);
    else if (track.bg === 'valley') drawMountains(hline);
    else drawTrees(hline);
    const stripe = Math.max(8 * DPR, Math.round(10 * DPR));
    const shift = game.mode === 'race' ? Math.floor((game.position * .040) % (stripe * 2)) : 0;
    for (let y = Math.floor(hline); y < roadBottom; y += stripe) {
      ctx.fillStyle = (((y + shift) / stripe) | 0) % 2 ? pal.grass1 : pal.grass2;
      ctx.fillRect(0, y, W, stripe + 1);
    }
  }
  function drawClouds(bg) {
    if (bg === 'night') {
      ctx.fillStyle = '#fff6b5';
      for (let i = 0; i < 42; i++) {
        const x = ((i * 197 - game.position * .012) % (W + 8 * DPR));
        const y = (18 + (i * 31) % 125) * DPR;
        ctx.fillRect(x, y, 3 * DPR, 3 * DPR);
      }
      return;
    }
    ctx.fillStyle = bg === 'lava' ? '#ffd8b1' : '#fff';
    for (let i = 0; i < 8; i++) {
      const x = ((i * 245 - game.position * .014) % (W + 220 * DPR)) - 110 * DPR;
      const y = (24 + (i * 34) % 110) * DPR;
      const s = (2 + (i % 3)) * DPR;
      ctx.fillRect(x, y + 8*s, 45*s, 6*s);
      ctx.fillRect(x + 11*s, y + 2*s, 27*s, 10*s);
      ctx.fillRect(x + 38*s, y + 6*s, 22*s, 5*s);
      ctx.fillRect(x - 12*s, y + 13*s, 19*s, 4*s);
    }
  }
  function drawCity(y, night) {
    let x = -80 * DPR - ((game.position * .014) % (130 * DPR));
    let n = 0;
    const colors = night ? ['#0b1120', '#16233b', '#25324a'] : ['#f4fbff', '#c5e7ff', '#172336'];
    while (x < W + 100 * DPR) {
      const bw = (34 + (n * 23) % 68) * DPR;
      const bh = (42 + (n * 37) % 125) * DPR;
      ctx.fillStyle = colors[n % colors.length]; ctx.fillRect(x, y - bh, bw, bh);
      ctx.fillStyle = night ? '#ffe577' : '#77bce6';
      for (let yy = y - bh + 10 * DPR; yy < y - 8 * DPR; yy += 14 * DPR) for (let xx = x + 7 * DPR; xx < x + bw - 8 * DPR; xx += 15 * DPR) if (((xx + yy + n) | 0) % 5) ctx.fillRect(xx, yy, 7 * DPR, 3 * DPR);
      x += bw + (5 + n % 4) * DPR; n++;
    }
  }
  function drawTrees(y) {
    ctx.fillStyle = '#0a7b27';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 156 - game.position * .010) % (W + 260 * DPR)) - 110 * DPR;
      const h = (28 + (i * 31) % 70) * DPR;
      ctx.beginPath(); ctx.moveTo(x, y + 8 * DPR); ctx.lineTo(x + 80 * DPR, y - h); ctx.lineTo(x + 160 * DPR, y + 8 * DPR); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#086322'; ctx.fillRect(0, y + 5 * DPR, W, 12 * DPR);
  }
  function drawMountains(y) {
    ctx.fillStyle = '#214f47';
    for (let i = 0; i < 10; i++) {
      const x = ((i * 230 - game.position * .008) % (W + 360 * DPR)) - 170 * DPR;
      const h = (75 + (i * 53) % 105) * DPR;
      ctx.beginPath(); ctx.moveTo(x, y + 12 * DPR); ctx.lineTo(x + 100 * DPR, y - h); ctx.lineTo(x + 220 * DPR, y + 12 * DPR); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5d8c7e'; ctx.beginPath(); ctx.moveTo(x + 100 * DPR, y - h); ctx.lineTo(x + 126 * DPR, y + 12 * DPR); ctx.lineTo(x + 65 * DPR, y + 12 * DPR); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#214f47';
    }
  }
  function drawLava(y) {
    ctx.fillStyle = '#2a1721';
    for (let i = 0; i < 8; i++) {
      const x = ((i * 265 - game.position * .008) % (W + 400 * DPR)) - 200 * DPR;
      const h = (80 + (i * 73) % 125) * DPR;
      ctx.beginPath(); ctx.moveTo(x, y + 17 * DPR); ctx.lineTo(x + 130 * DPR, y - h); ctx.lineTo(x + 270 * DPR, y + 17 * DPR); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff612e'; ctx.fillRect(x + 124 * DPR, y - h + 16 * DPR, 9 * DPR, h * .72); ctx.fillStyle = '#2a1721';
    }
  }

  function project(normRoadX, objNormX, z) {
    const scale = ROAD.cameraDepth / Math.max(1, z);
    const y = horizon + scale * (roadBottom - horizon);
    const camera = game.playerX * 0.42;
    const x = W / 2 + (normRoadX + objNormX - camera) * scale * W * .47;
    const w = scale * W * .47;
    return { x, y, w, scale };
  }
  function roadCenterAt(track, relDist) {
    const base = baseIndex(track);
    const basePercent = (game.position % ROAD.segmentLength) / ROAD.segmentLength;
    const steps = Math.max(0, (relDist - ROAD.cameraDepth) / ROAD.segmentLength);
    const nWhole = Math.floor(steps);
    const frac = steps - nWhole;
    let x = 0;
    let dx = -track.segments[base].curve * basePercent * ROAD.curveStep;
    for (let i = 0; i < nWhole; i++) {
      const s = track.segments[(base + i) % track.segments.length];
      x += dx;
      dx += s.curve * ROAD.curveStep;
    }
    const s = track.segments[(base + nWhole) % track.segments.length];
    x += dx * frac;
    dx += s.curve * ROAD.curveStep * frac;
    return x;
  }
  function calcRoadRows(track) {
    const base = baseIndex(track);
    const basePercent = (game.position % ROAD.segmentLength) / ROAD.segmentLength;
    const rows = [];
    let x = 0;
    let dx = -track.segments[base].curve * basePercent * ROAD.curveStep;
    for (let n = 0; n < ROAD.drawDistance; n++) {
      const s1 = track.segments[(base + n) % track.segments.length];
      const s2 = track.segments[(base + n + 1) % track.segments.length];
      const z1 = ROAD.cameraDepth + (n - basePercent) * ROAD.segmentLength;
      x += dx;
      dx += s1.curve * ROAD.curveStep;
      const p1 = project(x, 0, z1);
      const x2 = x + dx;
      const z2 = ROAD.cameraDepth + (n + 1 - basePercent) * ROAD.segmentLength;
      const p2 = project(x2, 0, z2);
      rows.push({ n, s: s1, s2, p1, p2, x1: x, x2, z1, z2 });
      x = x2;
    }
    return rows;
  }
  function drawQuad(x1,y1,x2,y2,x3,y3,x4,y4,fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.lineTo(x4,y4); ctx.closePath(); ctx.fill();
  }
  function drawRoad(track) {
    const pal = bgPalette(track.bg);
    const rows = calcRoadRows(track);
    game.lastRoadRows = rows;
    let clipY = roadBottom + 4 * DPR;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      const p1 = r.p1, p2 = r.p2;
      if (p2.y >= clipY || p1.y < horizon - 5 * DPR) continue;
      const y1 = Math.min(p1.y + 2 * DPR, clipY);
      const y2 = p2.y;
      const roadColor = r.s.color ? pal.road1 : pal.road2;
      const rumble = r.s.color ? '#d72e1f' : '#f4f5f4';
      const shoulder = r.s.color ? '#f4f5f4' : '#d72e1f';
      drawQuad(p1.x - p1.w * 1.20, y1, p1.x - p1.w, y1, p2.x - p2.w, y2, p2.x - p2.w * 1.20, y2, shoulder);
      drawQuad(p1.x + p1.w, y1, p1.x + p1.w * 1.20, y1, p2.x + p2.w * 1.20, y2, p2.x + p2.w, y2, shoulder);
      drawQuad(p1.x - p1.w * 1.08, y1, p1.x - p1.w, y1, p2.x - p2.w, y2, p2.x - p2.w * 1.08, y2, rumble);
      drawQuad(p1.x + p1.w, y1, p1.x + p1.w * 1.08, y1, p2.x + p2.w * 1.08, y2, p2.x + p2.w, y2, rumble);
      drawQuad(p1.x - p1.w, y1, p1.x + p1.w, y1, p2.x + p2.w, y2, p2.x - p2.w, y2, roadColor);
      if (i % 3 === 0) {
        for (let lane = 1; lane < ROAD.lanes; lane++) {
          const lanex = lane / ROAD.lanes * 2 - 1;
          const lw1 = Math.max(1.5 * DPR, p1.w * .018);
          const lw2 = Math.max(1.0 * DPR, p2.w * .018);
          const x1 = p1.x + p1.w * lanex;
          const x2 = p2.x + p2.w * lanex;
          drawQuad(x1-lw1, y1, x1+lw1, y1, x2+lw2, y2, x2-lw2, y2, 'rgba(255,255,255,.78)');
        }
      }
      if (r.n < 8) {
        ctx.fillStyle = 'rgba(255,255,255,.035)';
        ctx.fillRect(0, y2, W, Math.max(1, y1 - y2));
      }
      clipY = y2 + 1;
    }
  }
  function projectSprite(objZ, objX) {
    const dz = relZ(objZ, game.position, game.track.length);
    if (dz < ROAD.cameraDepth * .72 || dz > ROAD.drawDistance * ROAD.segmentLength) return null;
    const center = roadCenterAt(game.track, dz);
    const p = project(center, objX * .92, dz);
    return { ...p, dz };
  }
  function drawObjects() {
    const objs = [];
    for (const c of game.coins) if (!c.taken) objs.push({ type: 'coin', ...c });
    for (const t of game.traffic) objs.push({ type: 'traffic', ...t });
    objs.sort((a, b) => relZ(b.z, game.position, game.track.length) - relZ(a.z, game.position, game.track.length));
    for (const o of objs) {
      const p = projectSprite(o.z, o.x);
      if (!p || p.y < horizon || p.y > roadBottom + 30 * DPR) continue;
      if (o.type === 'coin') drawCoin(p, o); else drawTraffic(p, o);
    }
  }
  function drawCoin(p, o) {
    const r = clamp(p.scale * 42 * DPR, 3 * DPR, 18 * DPR);
    ctx.save(); ctx.translate(p.x, p.y - r * 1.2);
    ctx.fillStyle = '#ffc928'; ctx.strokeStyle = '#8f5400'; ctx.lineWidth = Math.max(1, DPR);
    ctx.beginPath(); ctx.ellipse(0, 0, r * .45 * Math.abs(Math.sin(performance.now() * .006 + o.spin)), r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff2a2'; ctx.fillRect(-r * .10, -r * .55, Math.max(1, r * .17), r * 1.1);
    ctx.restore();
  }
  function drawTraffic(p, o) {
    const s = clamp(p.scale * 4.2 * DPR, .18 * DPR, 2.4 * DPR) * o.width;
    ctx.save(); ctx.translate(p.x, p.y - 17 * s); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(-23, 19, 46, 8);
    ctx.fillStyle = '#050505'; ctx.fillRect(-25, 1, 9, 20); ctx.fillRect(16, 1, 9, 20);
    ctx.fillStyle = o.color; ctx.fillRect(-18, -7, 36, 25); ctx.fillRect(-12, -20, 24, 16);
    ctx.fillStyle = '#bff4ff'; ctx.fillRect(-8, -17, 16, 8);
    ctx.fillStyle = '#fff3a2'; ctx.fillRect(-16, 11, 7, 4); ctx.fillRect(9, 11, 7, 4);
    ctx.restore();
  }

  function drawPlayerCar() {
    const car = game.car;
    const roadX = W / 2 - game.playerX * W * .42 * .47; // road camera shift at near plane
    const roadHalf = W * .47;
    const desired = roadX + game.playerX * roadHalf * .78;
    const sc = clamp(W / 1280, .74, 1.18) * DPR;
    const carX = clamp(desired, roadX - roadHalf * .92, roadX + roadHalf * .92);
    const carY = roadBottom - 5 * DPR;
    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(clamp(game.lateralV * .12 + game.steer * .06, -.10, .10));
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.50)'; ctx.fillRect(-58, 14, 116, 12);
    drawRearCar(car);
    ctx.restore();
  }
  function drawRearCar(car) {
    const wide = car.mass > 1.15 || car.id === 'raptor';
    const low = car.id === 'slingshot' || car.id === 'viper' || car.id === 'roadster';
    const bodyW = wide ? 106 : 90;
    const bodyH = low ? 44 : 52;
    const roofW = wide ? 64 : 54;
    const roofH = low ? 18 : 23;
    ctx.fillStyle = '#050505'; ctx.fillRect(-bodyW/2 - 12, -4, 18, 39); ctx.fillRect(bodyW/2 - 6, -4, 18, 39);
    ctx.fillStyle = '#080a0e'; ctx.fillRect(-bodyW/2 - 5, -bodyH + 5, bodyW + 10, bodyH + 31);
    ctx.fillStyle = car.color; ctx.fillRect(-bodyW/2, -bodyH, bodyW, bodyH + 24);
    ctx.fillStyle = shade(car.color, -36); ctx.fillRect(-bodyW/2 + 8, -13, bodyW - 16, 19);
    ctx.fillStyle = shade(car.color, 35); ctx.fillRect(-roofW/2, -bodyH - roofH + 7, roofW, roofH);
    ctx.fillStyle = '#111b25'; ctx.fillRect(-roofW/2 + 8, -bodyH - roofH + 10, roofW - 16, 10);
    ctx.fillStyle = '#eaf7ff'; ctx.fillRect(-bodyW/2 + 10, 8, 17, 7); ctx.fillRect(bodyW/2 - 27, 8, 17, 7);
    ctx.fillStyle = '#ff2338'; ctx.fillRect(-bodyW/2 + 4, -29, 8, 14); ctx.fillRect(bodyW/2 - 12, -29, 8, 14);
    ctx.fillStyle = '#070707'; ctx.fillRect(-21, 18, 42, 7);
    ctx.fillStyle = '#dfe8ef'; for (let i = 0; i < 4; i++) ctx.fillRect(-17 + i*10, 19, 5, 5);
    if (controls.left || controls.right) { ctx.fillStyle = '#ffd338'; ctx.fillRect(controls.left ? -bodyW/2 - 23 : bodyW/2 + 14, -31, 9, 18); }
  }
  function shade(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = clamp((n >> 16) + amt, 0, 255) | 0;
    const g = clamp(((n >> 8) & 255) + amt, 0, 255) | 0;
    const b = clamp((n & 255) + amt, 0, 255) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function drawSpeedLines() {
    const alpha = clamp((game.speedFx - .56) / .44, 0, 1);
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.10 * alpha})`; ctx.lineWidth = Math.max(1, 2 * DPR);
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? -1 : 1;
      const y = horizon + (roadBottom - horizon) * (.22 + (i * 37 % 70) / 100);
      const x = W/2 + side * (W * (.18 + (i * 19 % 38) / 100));
      const len = (60 + i * 8) * DPR * alpha;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * len, y + len * .25); ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    const y = roadBottom;
    ctx.fillStyle = 'rgba(0,0,0,.94)'; ctx.fillRect(0, y, W, hudH + 4 * DPR);
    ctx.fillStyle = 'rgba(255,255,255,.045)'; for (let yy = y + 12 * DPR; yy < H; yy += 24 * DPR) ctx.fillRect(0, yy, W, 3 * DPR);
    const kmh = Math.floor(clamp(game.speed / game.maxSpeed, 0, 1) * game.car.maxKmh);
    const left = 12 * DPR;
    drawText('SPEED', left, y + 22 * DPR, 13 * DPR, '#fff');
    drawText(String(kmh).padStart(3, '0'), left, y + 46 * DPR, 36 * DPR, '#ff382d');
    drawText('km/h', left + 108 * DPR, y + 66 * DPR, 13 * DPR, '#fff');
    const gear = clamp(Math.floor(kmh / Math.max(1, game.car.maxKmh / 5)) + 1, 1, 6);
    drawText('GEAR', left, y + 94 * DPR, 13 * DPR, '#fff'); drawText(String(gear), left + 72 * DPR, y + 89 * DPR, 32 * DPR, '#ff382d');
    drawBar(left + 168 * DPR, y + 107 * DPR, 270 * DPR, 13 * DPR, game.damage, '#ff334b', 'DAMAGE');

    const gsize = clamp(100 * DPR, 82 * DPR, hudH * .78);
    drawGauge(W * .34, y + hudH * .56, gsize, clamp(game.speed / game.maxSpeed + (controls.gas ? .08 : 0), 0, 1), 'TACH');
    drawText('LAP', W * .44, y + 33 * DPR, 14 * DPR, '#fff'); drawText(`${Math.min(game.lap, game.track.laps)}/${game.track.laps}`, W * .49, y + 33 * DPR, 19 * DPR, '#50ff8d');
    drawText('TIME', W * .44, y + 65 * DPR, 14 * DPR, '#fff'); drawText(fmtTime(game.time), W * .49, y + 65 * DPR, 18 * DPR, '#ff4a35');
    drawText('COINS', W * .44, y + 98 * DPR, 14 * DPR, '#fff'); drawText(String(game.raceCoins), W * .49, y + 98 * DPR, 18 * DPR, '#ffd338');
    drawGauge(W * .55, y + hudH * .56, gsize, clamp(game.speed / game.maxSpeed, 0, 1), 'MPH/KMH');

    const turnX = W * .65;
    drawText('TURN', turnX, y + 62 * DPR, 11 * DPR, '#c4d1ee');
    ctx.fillStyle = controls.left ? '#ffd338' : 'rgba(255,255,255,.18)'; triangle(turnX - 23 * DPR, y + 80 * DPR, 19 * DPR, -1);
    ctx.fillStyle = controls.right ? '#ffd338' : 'rgba(255,255,255,.18)'; triangle(turnX + 39 * DPR, y + 80 * DPR, 19 * DPR, 1);

    const distX = W * .71;
    const progress = (game.position % game.track.length) / game.track.length;
    drawText('DISTANCE', distX, y + 31 * DPR, 13 * DPR, '#fff'); drawBar(distX, y + 49 * DPR, W * .22, 12 * DPR, progress, '#ff3a2d');
    drawText(`${Math.floor(game.position % game.track.length)} m`, distX, y + 81 * DPR, 14 * DPR, '#fff');
    drawText('ODOMETER', distX, y + 110 * DPR, 11 * DPR, '#b8c6e9'); drawText(`${((save.odometer + game.totalMeters) / 1000).toFixed(2)} km`, distX + 130 * DPR, y + 110 * DPR, 13 * DPR, '#ffd338');
    drawMiniMap(W - 144 * DPR, y + 20 * DPR, 124 * DPR, hudH - 34 * DPR);
  }
  function drawText(text, x, y, size, color) {
    ctx.font = `900 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillText(text, x + 2 * DPR, y + 2 * DPR); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function drawBar(x, y, w, h, v, fill, label) {
    if (label) drawText(label, x, y - 18 * DPR, 11 * DPR, '#fff');
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1 * DPR; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x + 2 * DPR, y + 2 * DPR, w - 4 * DPR, h - 4 * DPR);
    ctx.fillStyle = fill; ctx.fillRect(x + 2 * DPR, y + 2 * DPR, (w - 4 * DPR) * clamp(v, 0, 1), h - 4 * DPR);
  }
  function drawGauge(cx, cy, size, val, label) {
    ctx.save(); ctx.translate(cx, cy);
    if (images.gauge) ctx.drawImage(images.gauge, -size/2, -size/2, size, size);
    else { ctx.strokeStyle = '#dfe6f0'; ctx.lineWidth = 4 * DPR; ctx.beginPath(); ctx.arc(0, 0, size * .42, Math.PI * .80, Math.PI * 2.20); ctx.stroke(); }
    const a = lerp(-2.30, .92, clamp(val, 0, 1));
    ctx.rotate(a);
    if (images.needle) ctx.drawImage(images.needle, -4 * DPR, -size * .43, 8 * DPR, size * .50);
    else { ctx.strokeStyle = '#ffd338'; ctx.lineWidth = 3 * DPR; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -size*.36); ctx.stroke(); }
    ctx.restore(); drawText(label, cx - size * .32, cy - size * .62, 10 * DPR, '#fff');
  }
  function triangle(x, y, s, dir) { ctx.beginPath(); ctx.moveTo(x + s * dir, y); ctx.lineTo(x - s * dir, y - s * .8); ctx.lineTo(x - s * dir, y + s * .8); ctx.closePath(); ctx.fill(); }
  function drawMiniMap(x, y, w, h) {
    ctx.fillStyle = 'rgba(0,55,25,.85)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 2 * DPR; ctx.strokeRect(x, y, w, h);
    const segs = game.track.segments;
    let px = x + w * .5, py = y + h * .15;
    let dir = Math.PI / 2;
    const pts = [];
    const step = Math.max(1, Math.floor(segs.length / 95));
    for (let i = 0; i < segs.length; i += step) {
      dir += segs[i].curve * .015;
      px += Math.cos(dir) * w * .018 * step;
      py += Math.sin(dir) * h * .018 * step;
      pts.push([px, py]);
    }
    const minx = Math.min(...pts.map(p => p[0])), maxx = Math.max(...pts.map(p => p[0]));
    const miny = Math.min(...pts.map(p => p[1])), maxy = Math.max(...pts.map(p => p[1]));
    const sx = (v) => x + 10 * DPR + (v - minx) / Math.max(1, maxx - minx) * (w - 20 * DPR);
    const sy = (v) => y + 10 * DPR + (v - miny) / Math.max(1, maxy - miny) * (h - 20 * DPR);
    ctx.strokeStyle = '#dfffea'; ctx.lineWidth = 3 * DPR; ctx.beginPath();
    pts.forEach((p, i) => { const xx = sx(p[0]), yy = sy(p[1]); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }); ctx.closePath(); ctx.stroke();
    const progress = (game.position % game.track.length) / game.track.length;
    const idx = Math.floor(progress * pts.length) % pts.length;
    ctx.fillStyle = '#ff334b'; ctx.fillRect(sx(pts[idx][0]) - 4 * DPR, sy(pts[idx][1]) - 4 * DPR, 8 * DPR, 8 * DPR);
  }
  function drawAttract(track) {
    const oldMode = game.mode;
    const oldTrack = game.track;
    const oldPos = game.position;
    const oldX = game.playerX;
    game.track = track; game.mode = 'race'; game.position += 1500 / 60; game.playerX = Math.sin(performance.now() * .0007) * .22;
    drawRoad(track);
    game.track = oldTrack; game.mode = oldMode; game.position = oldPos; game.playerX = oldX;
    ctx.save(); ctx.translate(W/2, roadBottom - 12 * DPR); ctx.scale(clamp(W/1280,.75,1.2) * DPR, clamp(W/1280,.75,1.2) * DPR); drawRearCar(currentCar()); ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.033, Math.max(.001, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  buildMenu(); loadAudio(); loadImages().then(() => requestAnimationFrame(frame));
})();
