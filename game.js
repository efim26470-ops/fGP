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
  const ease = (t) => (1 - Math.cos(t * Math.PI)) / 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const sign = (v) => v < 0 ? -1 : 1;
  const fmtTime = (s) => {
    const m = Math.floor(Math.max(0, s) / 60);
    const sec = Math.floor(Math.max(0, s) % 60);
    const cs = Math.floor((Math.max(0, s) * 100) % 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const ROAD = {
    segmentLength: 200,
    roadWidth: 2000,
    lanes: 3,
    cameraDepth: 700,
    rumbleLength: 4,
    drawDistance: 250
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
    return Promise.all(Object.entries(ASSETS).map(([key, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[key] = img; resolve(); };
      img.onerror = () => { images[key] = null; resolve(); };
      img.src = src;
    })));
  }
  function loadAudio() {
    Object.entries(AUDIO).forEach(([key, src]) => {
      const a = new Audio(src);
      a.preload = 'auto';
      sounds[key] = a;
    });
  }
  function sfx(key, vol = 0.35) {
    const a = sounds[key];
    if (!a) return;
    try {
      const n = a.cloneNode(true);
      n.volume = vol;
      n.play().catch(() => {});
    } catch (_) {}
  }

  const CARS = [
    { id: 'alpine', name: 'Alpine 8V', price: 0, img: 'alpine', color: '#ffd337', maxKmh: 186, accel: 4100, brake: 5200, turn: 1.10, grip: 1.18, mass: .94, drift: .70, desc: 'баланс, мягкий руль' },
    { id: 'mini', name: 'Mini Rally', price: 180, img: 'mini', color: '#52cbff', maxKmh: 162, accel: 4550, brake: 5700, turn: 1.34, grip: 1.32, mass: .78, drift: .45, desc: 'легко держать дугу' },
    { id: 'roadster', name: 'Roadster', price: 420, img: 'roadster', color: '#ff314d', maxKmh: 210, accel: 4850, brake: 5400, turn: 1.12, grip: 1.08, mass: .90, drift: .86, desc: 'быстрый спорткар' },
    { id: 'camaro', name: 'Camaro GT', price: 680, img: 'camaro', color: '#ffb128', maxKmh: 232, accel: 5200, brake: 5000, turn: .96, grip: .98, mass: 1.18, drift: 1.06, desc: 'тяжелый V8' },
    { id: 'viper', name: 'Viper R', price: 980, img: 'viper', color: '#ff4336', maxKmh: 254, accel: 5600, brake: 5450, turn: 1.02, grip: 1.08, mass: 1.05, drift: .94, desc: 'мощная, требует аккуратности' },
    { id: 'sidepipe', name: 'Sidepipe V8', price: 1450, img: 'sidepipe', color: '#ff7c2b', maxKmh: 268, accel: 5900, brake: 5400, turn: .94, grip: 1.02, mass: 1.14, drift: 1.14, desc: 'широкая и тяжелая' },
    { id: 'raptor', name: 'Raptor 4x4', price: 1650, img: 'raptor', color: '#111820', maxKmh: 205, accel: 4600, brake: 5100, turn: .90, grip: 1.48, mass: 1.38, drift: .35, desc: 'лучше на обочине' },
    { id: 'slingshot', name: 'Slingshot X', price: 2200, img: 'slingshot', color: '#315dff', maxKmh: 286, accel: 6500, brake: 6100, turn: .98, grip: .98, mass: .98, drift: 1.32, desc: 'максимальная скорость' }
  ];

  const DIFFICULTY = {
    easy: { name: 'Лёгкая', traffic: .65, damage: .55, grip: 1.16, coins: 1, desc: 'меньше трафика' },
    normal: { name: 'Нормальная', traffic: 1, damage: 1, grip: 1, coins: 1.15, desc: 'баланс' },
    hard: { name: 'Хард', traffic: 1.6, damage: 1.42, grip: .88, coins: 1.45, desc: 'сложнее, но богаче' }
  };

  const TRACK_DEFS = [
    { id: 'country', name: 'Roll On Down The Line', shot: 'country', laps: 3, bg: 'country', grip: 1.08, length: 0, desc: 'длинные прямые и плавные дуги', parts: [
      [80,0], [45,.45], [70,0], [55,-.55], [70,0], [55,.75], [45,.2], [90,0], [70,-.85], [55,0], [45,.45], [90,0]
    ]},
    { id: 'downtown', name: 'Downtown Sprint', shot: 'downtown', laps: 3, bg: 'city', grip: .98, desc: 'резкие повороты, короткие прямые', parts: [
      [40,0], [45,.95], [35,0], [45,-1.05], [35,.25], [55,.85], [40,-.70], [55,0], [50,-.95], [45,.75], [60,0]
    ]},
    { id: 'nightcity', name: 'Night City Loop', shot: 'nightcity', laps: 4, bg: 'night', grip: .92, desc: 'скользкая ночь и быстрые связки', parts: [
      [50,0], [75,.38], [45,-.90], [45,-.35], [70,.95], [40,0], [80,-1.05], [55,.85], [65,0]
    ]},
    { id: 'lava', name: 'Lavafalls Ridge', shot: 'lavafalls', laps: 2, bg: 'lava', grip: .88, desc: 'опасные края и сильные повороты', parts: [
      [65,0], [60,-.75], [35,.65], [70,-1.08], [50,0], [75,1.05], [35,-.30], [70,0], [60,.80], [60,-.85]
    ]},
    { id: 'valley', name: 'Valley Run', shot: 'valley', laps: 3, bg: 'valley', grip: 1.14, desc: 'широкий быстрый поток', parts: [
      [100,0], [85,.28], [70,0], [75,-.36], [90,0], [70,.55], [75,0], [70,-.55], [95,0]
    ]}
  ];

  function makeTrack(def) {
    const segments = [];
    let curve = 0;
    let roadX = 0;
    let dx = 0;
    let index = 0;
    const push = (count, target) => {
      for (let i = 0; i < count; i++) {
        const t = count <= 1 ? 1 : i / (count - 1);
        curve = lerp(curve, target, .045 + .12 * ease(t));
        dx += curve * 18;
        roadX += dx;
        const seg = {
          index,
          z: index * ROAD.segmentLength,
          curve,
          roadX,
          colorIndex: Math.floor(index / ROAD.rumbleLength) % 2
        };
        segments.push(seg);
        index++;
      }
    };
    def.parts.forEach(([count, curve]) => push(count, curve));
    push(80, 0);
    const length = segments.length * ROAD.segmentLength;
    return { ...def, segments, length };
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
  const storeKey = 'q3-html-retro-rally-v7';
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
  const activeCodes = new Set();
  const keyMapCode = {
    ArrowUp: 'gas', KeyW: 'gas', Numpad8: 'gas',
    ArrowDown: 'brake', KeyS: 'brake', Numpad5: 'brake', Numpad2: 'brake',
    ArrowLeft: 'left', KeyA: 'left', Numpad4: 'left',
    ArrowRight: 'right', KeyD: 'right', Numpad6: 'right',
    Space: 'handbrake', ShiftLeft: 'handbrake', ShiftRight: 'handbrake'
  };
  const keyMapKey = {
    w: 'gas', ц: 'gas', W: 'gas', Ц: 'gas',
    s: 'brake', ы: 'brake', S: 'brake', Ы: 'brake',
    a: 'left', ф: 'left', A: 'left', Ф: 'left',
    d: 'right', в: 'right', D: 'right', В: 'right',
    ' ': 'handbrake'
  };
  function syncControls() {
    controls.gas = controls.brake = controls.left = controls.right = controls.handbrake = false;
    for (const code of activeCodes) {
      const k = keyMapCode[code] || keyMapKey[code];
      if (k && controls[k] !== undefined) controls[k] = true;
    }
  }
  function controlFromEvent(e) {
    return keyMapCode[e.code] || keyMapKey[e.key] || keyMapKey[String(e.key || '').toLowerCase()];
  }
  addEventListener('keydown', (e) => {
    const k = controlFromEvent(e);
    if (k) {
      activeCodes.add(e.code || e.key);
      if (keyMapKey[e.key]) activeCodes.add(e.key);
      syncControls();
      game.controlFlash = .35;
      e.preventDefault();
    }
    if (e.code === 'KeyP' || e.key?.toLowerCase?.() === 'p' || e.key?.toLowerCase?.() === 'з') togglePause();
  }, { passive: false });
  addEventListener('keyup', (e) => {
    const k = controlFromEvent(e);
    if (k) {
      activeCodes.delete(e.code || e.key);
      activeCodes.delete(e.key);
      syncControls();
      e.preventDefault();
    }
  }, { passive: false });
  addEventListener('blur', () => { activeCodes.clear(); syncControls(); });
  document.querySelectorAll('[data-touch]').forEach((btn) => {
    const name = btn.dataset.touch;
    const set = (v) => { if (controls[name] !== undefined) controls[name] = v; };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); btn.setPointerCapture(e.pointerId); });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); set(false); });
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('pointerleave', () => set(false));
  });

  let W = 1280;
  let H = 720;
  let DPR = 1;
  let hudH = 158;
  let roadBottom = 562;
  let horizon = 250;
  function resize() {
    DPR = clamp(devicePixelRatio || 1, 1, 2);
    W = Math.max(480, Math.floor(innerWidth * DPR));
    H = Math.max(360, Math.floor(innerHeight * DPR));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.imageSmoothingEnabled = false;
    hudH = clamp(H * .205, 126 * DPR, 174 * DPR);
    roadBottom = H - hudH;
    horizon = clamp(roadBottom * .39, 92 * DPR, roadBottom * .48);
  }
  addEventListener('resize', resize);
  resize();

  const game = {
    mode: 'menu',
    paused: false,
    car: CARS[0],
    track: TRACKS[0],
    diff: DIFFICULTY.normal,
    speed: 0,
    maxSpeed: 1,
    position: 0,
    playerX: 0,
    lateralV: 0,
    steer: 0,
    carRoll: 0,
    lap: 1,
    time: 0,
    damage: 0,
    raceCoins: 0,
    totalMeters: 0,
    coins: [],
    traffic: [],
    messageTimer: 0,
    finishLock: 0,
    shake: 0,
    roadJolt: 0,
    skidTimer: 0,
    lastBase: 0,
    scanShift: 0,
    speedFx: 0,
    cameraX: 0,
    controlFlash: 0
  };

  function currentCar() { return CARS.find(c => c.id === save.selectedCar) || CARS[0]; }
  function currentTrack() { return TRACKS.find(t => t.id === save.selectedTrack) || TRACKS[0]; }
  function currentDiff() { return DIFFICULTY[save.difficulty] || DIFFICULTY.normal; }
  function segmentAt(track, z) {
    const idx = Math.floor((((z % track.length) + track.length) % track.length) / ROAD.segmentLength) % track.segments.length;
    return track.segments[idx];
  }
  function baseIndex(track) {
    return Math.floor((game.position % track.length) / ROAD.segmentLength) % track.segments.length;
  }
  function relZ(z, pos, len) {
    let d = z - (pos % len);
    if (d < -ROAD.segmentLength) d += len;
    return d;
  }
  function wrap(z, len) { z %= len; return z < 0 ? z + len : z; }

  function updateMenuNumbers() {
    if (totalCoinsEl) totalCoinsEl.textContent = Math.floor(save.coins);
    if (garageOdoEl) garageOdoEl.textContent = `${(save.odometer / 1000).toFixed(1)} км`;
  }
  function msg(text, ms = 950) {
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
        <img src="assets/cars/${car.img}.png" alt="${car.name}" loading="lazy">
        <div>
          <h3>${car.name}</h3>
          <div class="meta">
            <span>${car.desc}</span>
            <span>${unlocked ? 'Открыта' : `Цена: ${car.price} монет`}</span>
          </div>
          <div class="bars">
            <div class="bar"><i style="width:${clamp(car.maxKmh / 286 * 100, 5, 100)}%"></i></div>
            <div class="bar"><i style="width:${clamp(car.accel / 6500 * 100, 5, 100)}%"></i></div>
            <div class="bar"><i style="width:${clamp(car.turn / 1.34 * 100, 5, 100)}%"></i></div>
          </div>
        </div>
        <span class="card-action ${unlocked ? '' : 'buy'}">${unlocked ? (selected ? 'Выбрано' : 'Выбрать') : 'Купить'}</span>`;
      card.addEventListener('click', () => {
        if (!unlocked) {
          if (save.coins >= car.price) {
            save.coins -= car.price;
            save.unlocked[car.id] = true;
            save.selectedCar = car.id;
            persist();
            buildMenu();
            msg('Куплено', 900);
          } else {
            msg(`Нужно ${car.price - save.coins} монет`, 1200);
          }
          return;
        }
        save.selectedCar = car.id;
        persist();
        buildMenu();
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
      card.innerHTML = `<div><h3>${track.name}</h3><div class="meta"><span>${track.desc}</span><span>${track.laps} круга • ${Math.round(track.length / 1000 * 10) / 10} км • ${best}</span></div></div>`;
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
    const track = game.track;
    const count = Math.floor(track.length / 520);
    for (let i = 0; i < count; i++) {
      game.coins.push({
        z: wrap(900 + i * track.length / count + rand(-120, 120), track.length),
        x: pick([-.55, -.28, 0, .28, .55]) + rand(-.035, .035),
        taken: false,
        spin: Math.random() * 10
      });
    }
  }
  function buildTraffic() {
    game.traffic = [];
    const track = game.track;
    const count = Math.floor((18 + track.length / 3200) * game.diff.traffic);
    for (let i = 0; i < count; i++) {
      game.traffic.push({
        z: wrap(1400 + i * track.length / count + rand(0, 900), track.length),
        x: pick([-.62, -.32, .32, .62]) + rand(-.05, .05),
        speed: rand(900, 2200),
        color: pick(['#ef4444', '#2563eb', '#ffd236', '#f7f7f7', '#22d375', '#ff7b2a']),
        width: rand(.82, 1.16)
      });
    }
  }

  function startRace() {
    game.mode = 'race';
    game.paused = false;
    game.car = currentCar();
    game.track = currentTrack();
    game.diff = currentDiff();
    game.maxSpeed = game.car.maxKmh * 32;
    game.speed = 0;
    game.position = 0;
    game.playerX = 0;
    game.lateralV = 0;
    game.steer = 0;
    game.carRoll = 0;
    game.lap = 1;
    game.time = 0;
    game.damage = 0;
    game.raceCoins = 0;
    game.totalMeters = 0;
    game.finishLock = 0;
    game.shake = 0;
    game.speedFx = 0;
    game.cameraX = 0;
    game.controlFlash = 0;
    buildCoins();
    buildTraffic();
    menu.classList.add('hidden');
    canvas.focus();
    msg('GO!', 800);
    sfx('go', .45);
  }
  function finishRace() {
    if (game.finishLock > 0) return;
    game.finishLock = 2.8;
    const bonus = Math.max(0, Math.floor(45 - game.damage * 42));
    const earned = Math.floor(game.raceCoins * game.diff.coins + bonus);
    save.coins += earned;
    save.odometer += game.totalMeters;
    if (!save.bestTimes[game.track.id] || game.time < save.bestTimes[game.track.id]) save.bestTimes[game.track.id] = game.time;
    persist();
    msg(`ФИНИШ +${earned}`, 2600);
    sfx('checkpoint', .65);
    setTimeout(() => {
      game.mode = 'menu';
      menu.classList.remove('hidden');
      buildMenu();
    }, 2600);
  }
  function togglePause() {
    if (game.mode !== 'race') return;
    game.paused = !game.paused;
    msg(game.paused ? 'Пауза' : 'GO!', 700);
  }

  startBtn.addEventListener('click', startRace);
  resetBtn.addEventListener('click', () => {
    if (!confirm('Сбросить монеты, покупки, рекорды и одометр?')) return;
    save = defaultSave();
    persist();
    buildMenu();
  });
  pauseBtn.addEventListener('click', togglePause);
  menuBtn.addEventListener('click', () => {
    game.mode = 'menu';
    game.paused = false;
    menu.classList.remove('hidden');
    buildMenu();
  });

  function update(dt) {
    if (game.messageTimer > 0) {
      game.messageTimer -= dt;
      if (game.messageTimer <= 0) raceMessage.classList.add('hidden');
    }
    if (game.mode !== 'race' || game.paused || game.finishLock > 0) return;

    const car = game.car;
    const track = game.track;
    const diff = game.diff;
    const seg = segmentAt(track, game.position + 420);
    const speedPct = clamp(game.speed / game.maxSpeed, 0, 1.25);
    const offroad = Math.abs(game.playerX) > 1.02;
    const deepOffroad = Math.abs(game.playerX) > 1.23;
    const traction = car.grip * track.grip * diff.grip * (offroad ? (car.id === 'raptor' ? .78 : .46) : 1) * (controls.handbrake ? .45 : 1);

    let accel = 0;
    if (controls.gas) accel += car.accel * (1 - speedPct * .38);
    if (controls.brake) accel -= car.brake * (game.speed > 350 ? 1 : .55);
    if (!controls.gas) accel -= 1050 + game.speed * .055;
    accel -= game.speed * game.speed * .00012;
    if (offroad) accel -= 1550 + game.speed * .30;
    if (controls.handbrake && game.speed > 1000) accel -= 850;
    game.speed = clamp(game.speed + accel * dt, 0, game.maxSpeed * (offroad ? (car.id === 'raptor' ? .72 : .55) : 1));

    const input = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    // v7: управление сделано как в старых аркадных гонках: машина реально смещается по полосе,
    // а камера только немного догоняет её. Руль не должен быть ни «ватным», ни мгновенно резким.
    const steerLag = input ? (controls.handbrake ? 8.5 : 7.2) : 10.5;
    game.steer = lerp(game.steer, input, 1 - Math.exp(-dt * steerLag));

    const curvePush = seg.curve * speedPct * (0.50 + speedPct * 0.82);
    const sidePower = car.turn * (0.72 + speedPct * 0.88) * (offroad ? 0.58 : 1) / Math.sqrt(car.mass);
    const targetLatV = game.steer * sidePower * (controls.handbrake ? 1.18 : 1) - curvePush;
    const response = (controls.handbrake ? 2.9 : 5.9) * clamp(traction, .25, 1.8);
    game.lateralV = lerp(game.lateralV, targetLatV, 1 - Math.exp(-dt * response));
    if (!input && Math.abs(game.steer) < .04) game.steer = 0;
    if (offroad) game.lateralV *= Math.exp(-dt * 1.8);
    game.playerX += game.lateralV * dt;
    game.cameraX = lerp(game.cameraX, game.playerX, 1 - Math.exp(-dt * 2.2));

    if (Math.abs(game.playerX) > 1.42) {
      game.playerX = sign(game.playerX) * 1.42;
      game.lateralV *= -.28;
      game.damage = clamp(game.damage + dt * .055 * diff.damage, 0, 1);
      game.shake = Math.max(game.shake, .38);
      game.roadJolt = Math.max(game.roadJolt, .8);
      if (Math.random() < dt * 4) sfx('scrape', .22);
    }
    if (deepOffroad) {
      game.damage = clamp(game.damage + dt * .014 * diff.damage, 0, 1);
    }

    const oldLap = game.lap;
    game.position += game.speed * dt;
    game.totalMeters += game.speed * dt / 30;
    game.time += dt;
    game.lap = Math.floor(game.position / track.length) + 1;
    if (game.lap !== oldLap && game.lap <= track.laps) {
      msg(`Круг ${game.lap}/${track.laps}`, 1100);
      sfx('checkpoint', .48);
    }
    if (game.lap > track.laps) finishRace();

    const slip = Math.abs(game.lateralV) * speedPct + Math.abs(game.steer) * speedPct * (controls.handbrake ? .75 : .22) + (offroad ? .20 : 0);
    if (slip > .48 && game.speed > 1500) {
      game.skidTimer -= dt;
      if (game.skidTimer <= 0) { sfx('skid', .16); game.skidTimer = .45; }
    }
    game.carRoll = lerp(game.carRoll, clamp(game.lateralV * .28 + game.steer * .34, -1, 1), 1 - Math.exp(-dt * 6.2));
    game.speedFx = lerp(game.speedFx, speedPct, 1 - Math.exp(-dt * 4.5));
    game.shake = Math.max(0, game.shake - dt * 1.8);
    game.roadJolt = Math.max(0, game.roadJolt - dt * 2.8);

    updateObjects(dt);
  }

  function updateObjects(dt) {
    const track = game.track;
    for (const coin of game.coins) {
      if (coin.taken) {
        const d = relZ(coin.z, game.position, track.length);
        if (d < -800) coin.taken = false;
        continue;
      }
      const dz = relZ(coin.z, game.position, track.length);
      if (dz > -70 && dz < 260 && Math.abs(coin.x - game.playerX) < .18) {
        coin.taken = true;
        game.raceCoins++;
        sfx('checkpoint', .16);
      }
    }
    for (const t of game.traffic) {
      t.z = wrap(t.z + t.speed * dt, track.length);
      const dz = relZ(t.z, game.position, track.length);
      if (dz > -120 && dz < 260 && Math.abs(t.x - game.playerX) < .22 * t.width && game.speed > 650) {
        game.damage = clamp(game.damage + (.10 + game.speed / 13000) * game.diff.damage, 0, 1);
        game.speed *= .56;
        game.lateralV += (game.playerX > t.x ? 1 : -1) * .45;
        t.x += (t.x > game.playerX ? 1 : -1) * .12;
        game.shake = 1.0;
        game.roadJolt = 1.0;
        msg('HIT!', 430);
        sfx('scrape', .58);
      }
    }
    if (game.damage >= 1) {
      game.finishLock = 1.8;
      msg('TOTAL DAMAGE', 1700);
      save.odometer += game.totalMeters;
      persist();
      setTimeout(() => {
        game.mode = 'menu';
        menu.classList.remove('hidden');
        buildMenu();
      }, 1700);
    }
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (game.shake > 0) ctx.translate(rand(-2, 2) * DPR * game.shake, rand(-1.6, 1.6) * DPR * game.shake);
    const track = game.mode === 'race' ? game.track : currentTrack();
    drawBackground(track);
    if (game.mode === 'race') {
      const road = drawRoad(track);
      drawObjects(road);
      drawPlayerCar();
      if (game.speedFx > .62) drawSpeedLines();
      drawHud();
    } else {
      drawAttract(track);
    }
    ctx.restore();
  }

  function drawBackground(track) {
    const bg = track.bg;
    const sky = ctx.createLinearGradient(0, 0, 0, roadBottom);
    if (bg === 'night') { sky.addColorStop(0, '#06132d'); sky.addColorStop(1, '#123b60'); }
    else if (bg === 'lava') { sky.addColorStop(0, '#331123'); sky.addColorStop(.55, '#824533'); sky.addColorStop(1, '#c9813a'); }
    else { sky.addColorStop(0, '#52a7ff'); sky.addColorStop(1, '#7fd0ff'); }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, roadBottom);
    drawClouds(bg);
    const hline = horizon - 8 * DPR;
    if (bg === 'city' || bg === 'night') drawCity(hline, bg === 'night');
    else if (bg === 'lava') drawLava(hline);
    else if (bg === 'valley') drawMountains(hline);
    else drawTrees(hline);

    const g1 = bg === 'lava' ? '#5f3a21' : bg === 'night' ? '#0d3b2a' : bg === 'valley' ? '#18a44b' : '#24ce30';
    const g2 = bg === 'lava' ? '#754822' : bg === 'night' ? '#0e4d35' : bg === 'valley' ? '#22bd57' : '#52ed2f';
    const stripe = Math.max(8 * DPR, Math.round(10 * DPR));
    const shift = game.mode === 'race' ? Math.floor((game.position * .010) % (stripe * 2)) : 0;
    for (let y = Math.floor(hline); y < roadBottom; y += stripe) {
      ctx.fillStyle = (((y + shift) / stripe) | 0) % 2 ? g1 : g2;
      ctx.fillRect(0, y, W, stripe + 1);
    }
  }
  function drawClouds(bg) {
    if (bg === 'night') {
      ctx.fillStyle = '#fff6b5';
      for (let i = 0; i < 40; i++) {
        const x = ((i * 197 - game.position * .01) % (W + 6 * DPR));
        const y = (18 + (i * 31) % 125) * DPR;
        ctx.fillRect(x, y, 3 * DPR, 3 * DPR);
      }
      return;
    }
    ctx.fillStyle = bg === 'lava' ? '#ffd8b1' : '#fff';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 228 - game.position * .012) % (W + 220 * DPR)) - 100 * DPR;
      const y = (24 + (i * 29) % 110) * DPR;
      const s = (2 + (i % 3)) * DPR;
      ctx.fillRect(x, y + 8*s, 45*s, 6*s);
      ctx.fillRect(x + 11*s, y + 2*s, 27*s, 10*s);
      ctx.fillRect(x + 38*s, y + 6*s, 22*s, 5*s);
      ctx.fillRect(x - 12*s, y + 13*s, 19*s, 4*s);
    }
  }
  function drawCity(y, night) {
    let x = -80 * DPR - ((game.position * .010) % (130 * DPR));
    let n = 0;
    const colors = night ? ['#0b1120', '#16233b', '#25324a'] : ['#f4fbff', '#c5e7ff', '#172336'];
    while (x < W + 100 * DPR) {
      const bw = (34 + (n * 23) % 68) * DPR;
      const bh = (42 + (n * 37) % 125) * DPR;
      ctx.fillStyle = colors[n % colors.length];
      ctx.fillRect(x, y - bh, bw, bh);
      ctx.fillStyle = night ? '#ffe577' : '#77bce6';
      for (let yy = y - bh + 10 * DPR; yy < y - 8 * DPR; yy += 14 * DPR) {
        for (let xx = x + 7 * DPR; xx < x + bw - 8 * DPR; xx += 15 * DPR) {
          if (((xx + yy + n) | 0) % 5) ctx.fillRect(xx, yy, 7 * DPR, 3 * DPR);
        }
      }
      x += bw + (5 + n % 4) * DPR;
      n++;
    }
  }
  function drawTrees(y) {
    ctx.fillStyle = '#0a7b27';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 156 - game.position * .008) % (W + 260 * DPR)) - 110 * DPR;
      const h = (28 + (i * 31) % 70) * DPR;
      ctx.beginPath();
      ctx.moveTo(x, y + 8 * DPR);
      ctx.lineTo(x + 80 * DPR, y - h);
      ctx.lineTo(x + 160 * DPR, y + 8 * DPR);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#086322';
    ctx.fillRect(0, y + 5 * DPR, W, 12 * DPR);
  }
  function drawMountains(y) {
    ctx.fillStyle = '#214f47';
    for (let i = 0; i < 10; i++) {
      const x = ((i * 230 - game.position * .006) % (W + 360 * DPR)) - 170 * DPR;
      const h = (75 + (i * 53) % 105) * DPR;
      ctx.beginPath();
      ctx.moveTo(x, y + 12 * DPR);
      ctx.lineTo(x + 100 * DPR, y - h);
      ctx.lineTo(x + 220 * DPR, y + 12 * DPR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5d8c7e';
      ctx.beginPath();
      ctx.moveTo(x + 100 * DPR, y - h);
      ctx.lineTo(x + 126 * DPR, y + 12 * DPR);
      ctx.lineTo(x + 65 * DPR, y + 12 * DPR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#214f47';
    }
  }
  function drawLava(y) {
    ctx.fillStyle = '#2a1721';
    for (let i = 0; i < 8; i++) {
      const x = ((i * 265 - game.position * .005) % (W + 400 * DPR)) - 200 * DPR;
      const h = (80 + (i * 73) % 125) * DPR;
      ctx.beginPath();
      ctx.moveTo(x, y + 17 * DPR);
      ctx.lineTo(x + 130 * DPR, y - h);
      ctx.lineTo(x + 270 * DPR, y + 17 * DPR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff612e';
      ctx.fillRect(x + 124 * DPR, y - h + 16 * DPR, 9 * DPR, h * .72);
      ctx.fillStyle = '#2a1721';
    }
  }

  function project(worldX, z) {
    const scale = ROAD.cameraDepth / Math.max(1, z);
    const y = horizon + scale * (roadBottom - horizon);
    // Камера не прилипает к машине полностью: иначе кажется, что руль не работает.
    const cameraWorld = (game.cameraX || 0) * ROAD.roadWidth * .28;
    const x = W / 2 + scale * (worldX - cameraWorld) * W * .00055;
    const w = scale * W * 1.05;
    return { x, y, w, scale };
  }
  function calcRoad() {
    const track = game.track;
    const base = baseIndex(track);
    const basePercent = ((game.position % ROAD.segmentLength) / ROAD.segmentLength);
    const rows = [];
    let x = 0;
    let dx = -track.segments[base].curve * basePercent * 22;
    for (let n = 0; n < ROAD.drawDistance; n++) {
      const s1 = track.segments[(base + n) % track.segments.length];
      const s2 = track.segments[(base + n + 1) % track.segments.length];
      const z1 = ROAD.cameraDepth + (n - basePercent) * ROAD.segmentLength;
      const z2 = ROAD.cameraDepth + (n + 1 - basePercent) * ROAD.segmentLength;
      const p1 = project(x, z1);
      x += dx;
      dx += s1.curve * 22;
      const p2 = project(x, z2);
      rows.push({ s: s1, s2, p1, p2, worldX: x, z1, z2, n });
    }
    return rows;
  }
  function drawRoad(track) {
    const rows = calcRoad();
    let maxY = roadBottom + 8 * DPR;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      // p1 is closer to the player, p2 is farther away. Render far edge at the top
      // and near edge at the bottom. This keeps the car visibly locked to the road.
      const near = r.p1;
      const far = r.p2;
      if (far.y >= maxY) continue;
      const yTop = Math.floor(far.y);
      const yBottom = Math.ceil(Math.min(near.y, maxY)) + 1;
      if (yBottom <= yTop) continue;
      maxY = yTop;

      const roadFar = far.w;
      const roadNear = near.w;
      const rumbleFar = roadFar * .072;
      const rumbleNear = roadNear * .072;
      const strip = r.s.colorIndex;
      const roadColor = track.bg === 'night' ? (strip ? '#2a3a52' : '#344860') : track.bg === 'lava' ? (strip ? '#574f4b' : '#6b615d') : (strip ? '#747474' : '#858585');
      const shoulderA = strip ? '#df2b20' : '#f6f6f6';
      const shoulderB = strip ? '#f6f6f6' : '#df2b20';

      drawQuad(far.x - roadFar - rumbleFar, yTop, far.x - roadFar, yTop, near.x - roadNear, yBottom, near.x - roadNear - rumbleNear, yBottom, shoulderA);
      drawQuad(far.x + roadFar, yTop, far.x + roadFar + rumbleFar, yTop, near.x + roadNear + rumbleNear, yBottom, near.x + roadNear, yBottom, shoulderB);
      drawQuad(far.x - roadFar, yTop, far.x + roadFar, yTop, near.x + roadNear, yBottom, near.x - roadNear, yBottom, roadColor);

      const laneMarker = ((r.s.index + Math.floor(game.position / 120)) % 7) < 2;
      if (laneMarker && i > 5) {
        for (let lane = 1; lane < ROAD.lanes; lane++) {
          const laneOffset = (lane / ROAD.lanes * 2 - 1);
          const xFar = far.x + roadFar * laneOffset;
          const xNear = near.x + roadNear * laneOffset;
          const wFar = Math.max(1 * DPR, far.w * .012);
          const wNear = Math.max(2 * DPR, near.w * .012);
          drawQuad(xFar - wFar, yTop, xFar + wFar, yTop, xNear + wNear, yBottom, xNear - wNear, yBottom, 'rgba(255,255,255,.88)');
        }
      }

      if (game.speedFx > .38 && i < 52 && i % 2 === 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.10 + game.speedFx * .10})`;
        ctx.lineWidth = Math.max(1, 1 * DPR);
        const wob = Math.sin((r.s.index + game.position * .006) * .7) * near.w * .08;
        ctx.beginPath();
        ctx.moveTo(near.x - near.w * .55 + wob, yBottom - 2);
        ctx.lineTo(far.x - far.w * .25 + wob, yTop);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(near.x + near.w * .55 - wob, yBottom - 2);
        ctx.lineTo(far.x + far.w * .25 - wob, yTop);
        ctx.stroke();
      }
    }
    return rows;
  }
  function drawQuad(x1, y1, x2, y2, x3, y3, x4, y4, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function projectSprite(objZ, objX) {
    const track = game.track;
    const dz = relZ(objZ, game.position, track.length);
    if (dz < ROAD.cameraDepth * .80 || dz > ROAD.drawDistance * ROAD.segmentLength) return null;
    let x = 0;
    const base = baseIndex(track);
    const basePercent = ((game.position % ROAD.segmentLength) / ROAD.segmentLength);
    let dx = -track.segments[base].curve * basePercent * 22;
    const n = Math.floor((dz - ROAD.cameraDepth) / ROAD.segmentLength);
    for (let i = 0; i <= n; i++) {
      const s = track.segments[(base + i) % track.segments.length];
      x += dx;
      dx += s.curve * 22;
    }
    const p = project(x + objX * ROAD.roadWidth, dz);
    return { x: p.x, y: p.y, scale: p.scale, dz };
  }
  function drawObjects() {
    const objs = [];
    for (const c of game.coins) if (!c.taken) objs.push({ type: 'coin', ...c });
    for (const t of game.traffic) objs.push({ type: 'traffic', ...t });
    objs.sort((a, b) => relZ(b.z, game.position, game.track.length) - relZ(a.z, game.position, game.track.length));
    for (const o of objs) {
      const p = projectSprite(o.z, o.x);
      if (!p || p.y < horizon || p.y > roadBottom + 40 * DPR) continue;
      if (o.type === 'coin') drawCoin(p, o);
      else drawTraffic(p, o);
    }
  }
  function drawCoin(p, o) {
    const r = clamp(p.scale * 38 * DPR, 3 * DPR, 19 * DPR);
    ctx.save();
    ctx.translate(p.x, p.y - r * 1.2);
    ctx.fillStyle = '#ffc928';
    ctx.strokeStyle = '#8f5400';
    ctx.lineWidth = Math.max(1, DPR);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * .48 * Math.abs(Math.sin(performance.now() * .006 + o.spin)), r, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff2a2';
    ctx.fillRect(-r * .12, -r * .55, Math.max(1, r * .18), r * 1.1);
    ctx.restore();
  }
  function drawTraffic(p, o) {
    const s = clamp(p.scale * 4.0 * DPR, .18 * DPR, 2.1 * DPR) * o.width;
    ctx.save();
    ctx.translate(p.x, p.y - 18 * s);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-22, 18, 44, 8);
    ctx.fillStyle = '#070707';
    ctx.fillRect(-25, 2, 9, 19);
    ctx.fillRect(16, 2, 9, 19);
    ctx.fillStyle = o.color;
    ctx.fillRect(-18, -7, 36, 25);
    ctx.fillRect(-12, -19, 24, 15);
    ctx.fillStyle = '#bff4ff';
    ctx.fillRect(-8, -16, 16, 8);
    ctx.fillStyle = '#fff3a2';
    ctx.fillRect(-16, 11, 7, 4);
    ctx.fillRect(9, 11, 7, 4);
    ctx.restore();
  }

  function drawPlayerCar() {
    const car = game.car;
    const sc = clamp(W / 1280, .72, 1.22) * DPR;
    const laneShift = (game.playerX - (game.cameraX || 0) * .28) * W * .34;
    const carX = clamp(W / 2 + laneShift + game.steer * 12 * DPR, 86 * DPR, W - 86 * DPR);
    const carY = roadBottom - 42 * DPR + Math.sin(game.position * .045) * game.roadJolt * 2 * DPR;
    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(clamp(game.carRoll, -1, 1) * .055);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(-56, 24, 112, 12);
    drawRearCar(car);
    ctx.restore();
  }
  function drawRearCar(car) {
    const wide = car.mass > 1.18 || car.id === 'raptor';
    const low = car.id === 'slingshot' || car.id === 'viper' || car.id === 'roadster';
    const bodyW = wide ? 104 : 88;
    const bodyH = low ? 43 : 52;
    const roofW = wide ? 62 : 54;
    const roofH = low ? 18 : 22;
    ctx.fillStyle = '#050505';
    ctx.fillRect(-bodyW/2 - 12, -2, 18, 38);
    ctx.fillRect(bodyW/2 - 6, -2, 18, 38);
    ctx.fillStyle = '#080a0e';
    ctx.fillRect(-bodyW/2 - 4, -bodyH + 4, bodyW + 8, bodyH + 29);
    ctx.fillStyle = car.color;
    ctx.fillRect(-bodyW/2, -bodyH, bodyW, bodyH + 24);
    ctx.fillStyle = shade(car.color, -36);
    ctx.fillRect(-bodyW/2 + 8, -12, bodyW - 16, 18);
    ctx.fillStyle = shade(car.color, 35);
    ctx.fillRect(-roofW/2, -bodyH - roofH + 7, roofW, roofH);
    ctx.fillStyle = '#111b25';
    ctx.fillRect(-roofW/2 + 8, -bodyH - roofH + 10, roofW - 16, 10);
    ctx.fillStyle = '#eaf7ff';
    ctx.fillRect(-bodyW/2 + 10, 8, 17, 7);
    ctx.fillRect(bodyW/2 - 27, 8, 17, 7);
    ctx.fillStyle = '#ff2338';
    ctx.fillRect(-bodyW/2 + 4, -28, 8, 14);
    ctx.fillRect(bodyW/2 - 12, -28, 8, 14);
    ctx.fillStyle = '#070707';
    ctx.fillRect(-21, 18, 42, 7);
    ctx.fillStyle = '#dfe8ef';
    for (let i = 0; i < 4; i++) ctx.fillRect(-17 + i*10, 19, 5, 5);
    if (controls.left || controls.right) {
      ctx.fillStyle = '#ffd338';
      ctx.fillRect(controls.left ? -bodyW/2 - 24 : bodyW/2 + 15, -31, 9, 18);
    }
  }
  function shade(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = clamp((n >> 16) + amt, 0, 255) | 0;
    const g = clamp(((n >> 8) & 255) + amt, 0, 255) | 0;
    const b = clamp((n & 255) + amt, 0, 255) | 0;
    return `rgb(${r},${g},${b})`;
  }
  function drawSpeedLines() {
    const alpha = clamp((game.speedFx - .62) / .38, 0, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.09 * alpha})`;
    ctx.lineWidth = Math.max(1, 2 * DPR);
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? -1 : 1;
      const y = horizon + (roadBottom - horizon) * (.20 + (i * 37 % 70) / 100);
      const x = W/2 + side * (W * (.18 + (i * 19 % 38) / 100));
      const len = (60 + i * 7) * DPR * alpha;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * len, y + len * .25);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    const y = roadBottom;
    ctx.fillStyle = 'rgba(0,0,0,.94)';
    ctx.fillRect(0, y, W, hudH + 4 * DPR);
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    for (let yy = y + 12 * DPR; yy < H; yy += 24 * DPR) ctx.fillRect(0, yy, W, 3 * DPR);

    const kmh = Math.floor(game.speed / game.maxSpeed * game.car.maxKmh);
    const left = 12 * DPR;
    drawText('SPEED', left, y + 22 * DPR, 13 * DPR, '#fff');
    drawText(String(kmh).padStart(3, '0'), left, y + 46 * DPR, 36 * DPR, '#ff382d');
    drawText('km/h', left + 108 * DPR, y + 66 * DPR, 13 * DPR, '#fff');
    const gear = clamp(Math.floor(kmh / Math.max(1, game.car.maxKmh / 5)) + 1, 1, 6);
    drawText('GEAR', left, y + 94 * DPR, 13 * DPR, '#fff');
    drawText(String(gear), left + 72 * DPR, y + 89 * DPR, 32 * DPR, '#ff382d');
    drawBar(left + 168 * DPR, y + 107 * DPR, 270 * DPR, 13 * DPR, game.damage, '#ff334b', 'DAMAGE');

    const gsize = clamp(100 * DPR, 82 * DPR, hudH * .78);
    drawGauge(W * .35, y + hudH * .56, gsize, clamp(game.speed / game.maxSpeed + (controls.gas ? .08 : 0), 0, 1), 'TACH');

    drawText('LAP', W * .44, y + 33 * DPR, 14 * DPR, '#fff');
    drawText(`${Math.min(game.lap, game.track.laps)}/${game.track.laps}`, W * .49, y + 33 * DPR, 19 * DPR, '#50ff8d');
    drawText('TIME', W * .44, y + 65 * DPR, 14 * DPR, '#fff');
    drawText(fmtTime(game.time), W * .49, y + 65 * DPR, 18 * DPR, '#ff4a35');
    drawText('COINS', W * .44, y + 98 * DPR, 14 * DPR, '#fff');
    drawText(String(game.raceCoins), W * .49, y + 98 * DPR, 18 * DPR, '#ffd338');

    drawGauge(W * .55, y + hudH * .56, gsize, clamp(game.speed / game.maxSpeed, 0, 1), 'MPH/KMH');

    const turnX = W * .65;
    drawText('TURN', turnX, y + 62 * DPR, 11 * DPR, '#c4d1ee');
    ctx.fillStyle = controls.left ? '#ffd338' : 'rgba(255,255,255,.18)';
    triangle(turnX - 23 * DPR, y + 80 * DPR, 19 * DPR, -1);
    ctx.fillStyle = controls.right ? '#ffd338' : 'rgba(255,255,255,.18)';
    triangle(turnX + 39 * DPR, y + 80 * DPR, 19 * DPR, 1);

    const distX = W * .71;
    const progress = (game.position % game.track.length) / game.track.length;
    drawText('DISTANCE', distX, y + 31 * DPR, 13 * DPR, '#fff');
    drawBar(distX, y + 49 * DPR, W * .22, 12 * DPR, progress, '#ff3a2d');
    drawText(`${Math.floor(game.position % game.track.length)} m`, distX, y + 81 * DPR, 14 * DPR, '#fff');
    drawText('ODOMETER', distX, y + 110 * DPR, 11 * DPR, '#b8c6e9');
    drawText(`${((save.odometer + game.totalMeters) / 1000).toFixed(2)} km`, distX + 130 * DPR, y + 110 * DPR, 13 * DPR, '#ffd338');

    drawMiniMap(W - 144 * DPR, y + 20 * DPR, 124 * DPR, hudH - 34 * DPR);
  }
  function drawText(text, x, y, size, color) {
    ctx.font = `900 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillText(text, x + 2 * DPR, y + 2 * DPR);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function drawBar(x, y, w, h, v, fill, label) {
    if (label) drawText(label, x, y - 18 * DPR, 11 * DPR, '#fff');
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1 * DPR;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(x + 2 * DPR, y + 2 * DPR, w - 4 * DPR, h - 4 * DPR);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 2 * DPR, y + 2 * DPR, (w - 4 * DPR) * clamp(v, 0, 1), h - 4 * DPR);
  }
  function drawGauge(cx, cy, size, val, label) {
    ctx.save();
    ctx.translate(cx, cy);
    if (images.gauge) ctx.drawImage(images.gauge, -size/2, -size/2, size, size);
    else {
      ctx.strokeStyle = '#dfe6f0'; ctx.lineWidth = 4 * DPR;
      ctx.beginPath(); ctx.arc(0, 0, size * .42, Math.PI * .80, Math.PI * 2.20); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = 0; i <= 10; i++) {
        const a = lerp(Math.PI * .80, Math.PI * 2.20, i / 10);
        ctx.fillRect(Math.cos(a) * size * .35, Math.sin(a) * size * .35, 4 * DPR, 2 * DPR);
      }
    }
    const a = lerp(-2.30, .92, clamp(val, 0, 1));
    ctx.rotate(a);
    if (images.needle) ctx.drawImage(images.needle, -4 * DPR, -size * .43, 8 * DPR, size * .50);
    else { ctx.strokeStyle = '#ffd338'; ctx.lineWidth = 3 * DPR; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -size*.36); ctx.stroke(); }
    ctx.rotate(-a);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 5 * DPR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    drawText(label, cx - size * .42, cy - size * .58, 10 * DPR, '#fff');
  }
  function triangle(x, y, s, dir) {
    ctx.beginPath();
    ctx.moveTo(x + dir * s, y);
    ctx.lineTo(x - dir * s, y - s * .65);
    ctx.lineTo(x - dir * s, y + s * .65);
    ctx.closePath();
    ctx.fill();
  }
  function drawMiniMap(x, y, w, h) {
    const track = game.track || currentTrack();
    ctx.fillStyle = 'rgba(4,35,20,.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2 * DPR;
    ctx.strokeRect(x, y, w, h);
    let mx = 0, my = 0;
    const pts = [];
    const step = Math.max(1, Math.floor(track.segments.length / 160));
    for (let i = 0; i < track.segments.length; i += step) {
      const s = track.segments[i];
      mx += s.curve * .65;
      my += 1.0;
      pts.push([mx, my]);
    }
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = x + 12 * DPR + ((p[0] - minX) / Math.max(1, maxX - minX)) * (w - 24 * DPR);
      const py = y + 10 * DPR + ((p[1] - minY) / Math.max(1, maxY - minY)) * (h - 20 * DPR);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#e6fff0';
    ctx.lineWidth = 2.2 * DPR;
    ctx.stroke();
    const prog = ((game.position % track.length) / track.length);
    const idx = Math.floor(prog * (pts.length - 1));
    const p = pts[idx] || pts[0];
    const px = x + 12 * DPR + ((p[0] - minX) / Math.max(1, maxX - minX)) * (w - 24 * DPR);
    const py = y + 10 * DPR + ((p[1] - minY) / Math.max(1, maxY - minY)) * (h - 20 * DPR);
    ctx.fillStyle = '#ff334b';
    ctx.fillRect(px - 4 * DPR, py - 4 * DPR, 8 * DPR, 8 * DPR);
  }

  function drawAttract(track) {
    const oldMode = game.mode;
    game.mode = 'race';
    const oldTrack = game.track;
    const oldPos = game.position;
    const oldX = game.playerX;
    game.track = track;
    game.position = performance.now() * .04;
    game.playerX = Math.sin(performance.now() * .0006) * .18;
    const road = drawRoad(track);
    drawObjects(road);
    game.track = oldTrack;
    game.position = oldPos;
    game.playerX = oldX;
    game.mode = oldMode;
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.fillRect(0, 0, W, roadBottom);
    drawText('Q3 RETRO RALLY', 30 * DPR, 36 * DPR, clamp(42 * DPR, 30 * DPR, 58 * DPR), '#fff');
    drawText('Выбери авто, трассу и сложность', 34 * DPR, 96 * DPR, 18 * DPR, '#ffd338');
  }

  let last = 0;
  function frame(ts) {
    if (!last) last = ts;
    const dt = clamp((ts - last) / 1000, 0, 1/24);
    last = ts;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  loadAudio();
  loadImages().then(() => {
    buildMenu();
    requestAnimationFrame(frame);
  });
})();
