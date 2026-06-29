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

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const sign = (v) => v < 0 ? -1 : 1;
  const fmtTime = (s) => {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.floor((s * 100) % 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const ASSET_LIST = {
    gauge: 'assets/hud/gauge.png',
    needle: 'assets/hud/needle.png',
    hudArrow: 'assets/hud/arrow.png',
    alpine: 'assets/cars/alpine.png',
    mini: 'assets/cars/mini.png',
    roadster: 'assets/cars/roadster.png',
    camaro: 'assets/cars/camaro.png',
    viper: 'assets/cars/viper.png',
    sidepipe: 'assets/cars/sidepipe.png',
    raptor: 'assets/cars/raptor.png',
    slingshot: 'assets/cars/slingshot.png',
    countryShot: 'assets/levelshots/country.jpg',
    downtownShot: 'assets/levelshots/downtown.jpg',
    nightShot: 'assets/levelshots/nightcity.jpg',
    lavaShot: 'assets/levelshots/lavafalls.jpg',
    valleyShot: 'assets/levelshots/valley.jpg'
  };
  const SOUND_LIST = {
    go: 'assets/audio/go.ogg',
    checkpoint: 'assets/audio/checkpoint.ogg',
    skid: 'assets/audio/skid.ogg',
    scrape: 'assets/audio/scrape.ogg'
  };

  const images = {};
  const sounds = {};

  function loadImages() {
    return Promise.all(Object.entries(ASSET_LIST).map(([k, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[k] = img; resolve(); };
      img.onerror = () => { images[k] = null; resolve(); };
      img.src = src;
    })));
  }

  function loadSounds() {
    for (const [k, src] of Object.entries(SOUND_LIST)) {
      const a = new Audio(src);
      a.preload = 'auto';
      sounds[k] = a;
    }
  }

  function playSound(name, volume = 0.45) {
    const a = sounds[name];
    if (!a) return;
    try {
      const n = a.cloneNode(true);
      n.volume = volume;
      n.play().catch(() => {});
    } catch (_) {}
  }

  const CARS = [
    { id: 'alpine', name: 'Alpine 8V', price: 0, img: 'alpine', color: '#ffd231', max: 188, accel: 42, brake: 82, handling: 1.22, grip: 1.08, mass: .92, drift: .82, desc: 'баланс / легко рулить' },
    { id: 'mini', name: 'Mini Rally', price: 180, img: 'mini', color: '#4ac7ff', max: 165, accel: 50, brake: 96, handling: 1.62, grip: 1.28, mass: .72, drift: .55, desc: 'лучшее управление' },
    { id: 'roadster', name: 'Roadster', price: 420, img: 'roadster', color: '#ff334b', max: 215, accel: 53, brake: 88, handling: 1.28, grip: 1.05, mass: .88, drift: .95, desc: 'скорость + дрифт' },
    { id: 'camaro', name: 'Camaro GT', price: 680, img: 'camaro', color: '#ffb428', max: 235, accel: 58, brake: 80, handling: 1.02, grip: .96, mass: 1.15, drift: 1.15, desc: 'тяжелая мощь' },
    { id: 'viper', name: 'Viper R', price: 980, img: 'viper', color: '#ff523d', max: 255, accel: 64, brake: 92, handling: 1.12, grip: 1.12, mass: 1.05, drift: .92, desc: 'быстрая, нервная' },
    { id: 'sidepipe', name: 'Sidepipe V8', price: 1450, img: 'sidepipe', color: '#ff7b2a', max: 268, accel: 68, brake: 94, handling: 1.04, grip: 1.04, mass: 1.10, drift: 1.12, desc: 'мощный V8' },
    { id: 'raptor', name: 'Raptor 4x4', price: 1650, img: 'raptor', color: '#0d1217', max: 210, accel: 48, brake: 86, handling: .94, grip: 1.56, mass: 1.36, drift: .35, desc: 'держит грунт' },
    { id: 'slingshot', name: 'Slingshot X', price: 2200, img: 'slingshot', color: '#315dff', max: 290, accel: 78, brake: 102, handling: 1.05, grip: .98, mass: .98, drift: 1.45, desc: 'монстр скорости' }
  ];

  const DIFF = {
    easy: { name: 'Лёгкая', traffic: .65, damage: .55, grip: 1.14, coins: 1.0, desc: 'меньше трафика' },
    normal: { name: 'Нормальная', traffic: 1, damage: 1, grip: 1, coins: 1.15, desc: 'баланс' },
    hard: { name: 'Хард', traffic: 1.65, damage: 1.45, grip: .88, coins: 1.45, desc: 'больше монет' }
  };

  const TRACK_DEFS = [
    { id: 'country', name: 'Roll On Down The Line', shot: 'countryShot', laps: 3, length: 4100, grip: 1.06, curveForce: 1.05, palette: 'country', desc: 'длинные прямые + плавные дуги', cmds: [
      [120,0], [80,.4], [90,0], [110,-.5], [70,0], [90,.75], [70,.25], [130,0], [110,-.85], [60,0], [90,.45], [120,0]
    ]},
    { id: 'downtown', name: 'Downtown Sprint', shot: 'downtownShot', laps: 3, length: 3600, grip: .98, curveForce: 1.2, palette: 'city', desc: 'короткие прямые, резкие повороты', cmds: [
      [60,0], [65,.9], [45,0], [70,-1.05], [50,.2], [80,.85], [55,-.65], [70,0], [75,-.95], [60,.7], [80,0]
    ]},
    { id: 'nightcity', name: 'Night City Loop', shot: 'nightShot', laps: 4, length: 3900, grip: .93, curveForce: 1.35, palette: 'night', desc: 'ночь, скользкий асфальт', cmds: [
      [70,0], [100,.35], [70,-.85], [70,-.35], [120,.9], [55,0], [110,-.95], [70,.8], [90,0]
    ]},
    { id: 'lava', name: 'Lavafalls Ridge', shot: 'lavaShot', laps: 2, length: 4800, grip: .89, curveForce: 1.45, palette: 'lava', desc: 'быстрые связки + опасные края', cmds: [
      [100,0], [90,-.75], [50,.65], [110,-1.1], [70,0], [120,1.0], [50,-.3], [100,0], [85,.75], [85,-.85]
    ]},
    { id: 'valley', name: 'Valley Run', shot: 'valleyShot', laps: 3, length: 4400, grip: 1.13, curveForce: .95, palette: 'valley', desc: 'широкая трасса, быстрый поток', cmds: [
      [150,0], [140,.25], [100,0], [120,-.35], [130,0], [90,.55], [100,0], [120,-.55], [140,0]
    ]}
  ];

  function generateTrack(def) {
    const segLen = 18;
    const segments = [];
    let curve = 0;
    let x = 0;
    let index = 0;
    const push = (target, count) => {
      for (let i = 0; i < count; i++) {
        const t = count <= 1 ? 1 : i / (count - 1);
        curve = lerp(curve, target, .055 + .08 * Math.sin(t * Math.PI));
        x += curve * .025;
        const rumble = Math.floor(index / 3) % 2;
        const lane = Math.floor(index / 8) % 2;
        segments.push({ index, curve, x, rumble, lane });
        index++;
      }
    };
    for (const [count, c] of def.cmds) push(c, count);
    push(0, 80);
    const realLen = segments.length * segLen;
    return { ...def, segLen, segments, realLen };
  }

  const TRACKS = TRACK_DEFS.map(generateTrack);

  const defaultSave = () => ({
    coins: 0,
    selectedCar: 'alpine',
    selectedTrack: 'country',
    difficulty: 'normal',
    unlocked: { alpine: true },
    bestTimes: {},
    odometer: 0
  });

  const storeKey = 'q3-html-retro-rally-v4';
  let save = defaultSave();
  try {
    save = { ...defaultSave(), ...(JSON.parse(localStorage.getItem(storeKey) || '{}')) };
    save.unlocked = { ...defaultSave().unlocked, ...(save.unlocked || {}) };
    save.bestTimes = save.bestTimes || {};
  } catch (_) {}

  function persist() {
    localStorage.setItem(storeKey, JSON.stringify(save));
    updateGarageNumbers();
  }

  const controls = { gas: false, brake: false, left: false, right: false, handbrake: false };
  const keyMap = {
    ArrowUp: 'gas', KeyW: 'gas', KeyЦ: 'gas',
    ArrowDown: 'brake', KeyS: 'brake', KeyЫ: 'brake',
    ArrowLeft: 'left', KeyA: 'left', KeyФ: 'left',
    ArrowRight: 'right', KeyD: 'right', KeyВ: 'right',
    Space: 'handbrake'
  };

  window.addEventListener('keydown', (e) => {
    const k = keyMap[e.code] || keyMap[e.key];
    if (k) { controls[k] = true; e.preventDefault(); }
    if (e.code === 'KeyP') togglePause();
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code] || keyMap[e.key];
    if (k) { controls[k] = false; e.preventDefault(); }
  }, { passive: false });

  document.querySelectorAll('[data-touch]').forEach((btn) => {
    const name = btn.dataset.touch;
    const map = { gas: 'gas', brake: 'brake', left: 'left', right: 'right' };
    const set = (v) => { controls[map[name]] = v; };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); btn.setPointerCapture(e.pointerId); });
    btn.addEventListener('pointerup', (e) => { e.preventDefault(); set(false); });
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('pointerleave', () => set(false));
  });

  let W = 1280, H = 720, DPR = 1;
  let horizon = 280, roadBottom = 560, hudH = 160;

  function resize() {
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);
    W = Math.floor(window.innerWidth * DPR);
    H = Math.floor(window.innerHeight * DPR);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.imageSmoothingEnabled = false;
    hudH = Math.max(132 * DPR, Math.min(188 * DPR, H * .23));
    roadBottom = H - hudH;
    horizon = Math.max(95 * DPR, roadBottom * .42);
  }
  window.addEventListener('resize', resize);
  resize();

  const game = {
    mode: 'menu',
    paused: false,
    car: null,
    track: null,
    diff: null,
    speed: 0,
    gear: 1,
    rpm: 0,
    x: 0,
    dx: 0,
    steerLean: 0,
    pos: 0,
    lap: 1,
    raceTime: 0,
    damage: 0,
    raceCoins: 0,
    totalMeters: 0,
    coins: [],
    traffic: [],
    cameraShake: 0,
    finishCooldown: 0,
    lastSegmentIndex: 0,
    curveVisual: 0,
    skidTimer: 0,
    messageTimer: 0,
    steerState: 0,
    speedFx: 0,
    visualRoadBoost: 1.75
  };

  function selectedCar() { return CARS.find(c => c.id === save.selectedCar) || CARS[0]; }
  function selectedTrack() { return TRACKS.find(t => t.id === save.selectedTrack) || TRACKS[0]; }
  function selectedDiff() { return DIFF[save.difficulty] || DIFF.normal; }

  function getSegmentAt(track, distance) {
    const idx = Math.floor((((distance % track.realLen) + track.realLen) % track.realLen) / track.segLen) % track.segments.length;
    return track.segments[idx];
  }

  function showMessage(txt, ms = 1250) {
    raceMessage.textContent = txt;
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
        <img src="assets/cars/${car.img}.png" alt="${car.name}">
        <div>
          <h3>${car.name}</h3>
          <div class="meta">
            <span>${car.desc}</span>
            <span>${unlocked ? 'Открыта' : `Цена: ${car.price} монет`}</span>
          </div>
          <div class="bars">
            <div class="bar" title="скорость"><i style="width:${clamp(car.max / 290 * 100, 0, 100)}%"></i></div>
            <div class="bar" title="разгон"><i style="width:${clamp(car.accel / 78 * 100, 0, 100)}%"></i></div>
            <div class="bar" title="управление"><i style="width:${clamp(car.handling / 1.62 * 100, 0, 100)}%"></i></div>
          </div>
        </div>
        <span class="card-action ${unlocked ? '' : 'buy'}">${unlocked ? (selected ? 'Выбрано' : 'Выбрать') : 'Купить'}</span>
      `;
      card.addEventListener('click', () => {
        if (!save.unlocked[car.id]) {
          if (save.coins >= car.price) {
            save.coins -= car.price;
            save.unlocked[car.id] = true;
            save.selectedCar = car.id;
            persist();
            buildMenu();
            showMessage('Куплено', 900);
          } else {
            showMessage(`Нужно ${car.price - save.coins} монет`, 1200);
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
      card.style.backgroundImage = `url(assets/levelshots/${track.shot.replace('Shot', '')}.jpg)`;
      const shotMap = { countryShot: 'country', downtownShot: 'downtown', nightShot: 'nightcity', lavaShot: 'lavafalls', valleyShot: 'valley' };
      card.style.backgroundImage = `url(assets/levelshots/${shotMap[track.shot]}.jpg)`;
      const best = save.bestTimes[track.id] ? `Лучшее: ${fmtTime(save.bestTimes[track.id])}` : 'Лучшее: —';
      card.innerHTML = `<div><h3>${track.name}</h3><div class="meta"><span>${track.desc}</span><span>${track.laps} круга • ${Math.round(track.realLen / 1000 * 10) / 10} км • ${best}</span></div></div>`;
      card.addEventListener('click', () => { save.selectedTrack = track.id; persist(); buildMenu(); });
      tracksEl.appendChild(card);
    });

    diffEl.innerHTML = '';
    Object.entries(DIFF).forEach(([id, d]) => {
      const b = document.createElement('button');
      b.className = `diff-btn ${save.difficulty === id ? 'selected' : ''}`;
      b.innerHTML = `${d.name}<br><small>${d.desc}</small>`;
      b.addEventListener('click', () => { save.difficulty = id; persist(); buildMenu(); });
      diffEl.appendChild(b);
    });
    updateGarageNumbers();
  }

  function updateGarageNumbers() {
    totalCoinsEl.textContent = Math.floor(save.coins);
    garageOdoEl.textContent = `${(save.odometer / 1000).toFixed(1)} км`;
  }

  function startRace() {
    game.mode = 'race';
    game.paused = false;
    game.car = selectedCar();
    game.track = selectedTrack();
    game.diff = selectedDiff();
    game.speed = 0;
    game.gear = 1;
    game.rpm = 0;
    game.x = 0;
    game.dx = 0;
    game.steerLean = 0;
    game.pos = 0;
    game.lap = 1;
    game.raceTime = 0;
    game.damage = 0;
    game.raceCoins = 0;
    game.totalMeters = 0;
    game.cameraShake = 0;
    game.finishCooldown = 0;
    game.lastSegmentIndex = 0;
    game.curveVisual = 0;
    game.skidTimer = 0;
    game.steerState = 0;
    game.speedFx = 0;
    buildCoins();
    buildTraffic();
    menu.classList.add('hidden');
    canvas.focus();
    showMessage('GO!', 750);
    playSound('go', .5);
  }

  function finishRace() {
    if (game.finishCooldown > 0) return;
    game.finishCooldown = 3;
    const earned = Math.floor(game.raceCoins * game.diff.coins + Math.max(0, 40 - game.damage * 30));
    save.coins += earned;
    save.odometer += game.totalMeters;
    const best = save.bestTimes[game.track.id];
    if (!best || game.raceTime < best) save.bestTimes[game.track.id] = game.raceTime;
    persist();
    showMessage(`Финиш +${earned} монет`, 2600);
    playSound('checkpoint', .6);
    setTimeout(() => {
      game.mode = 'menu';
      menu.classList.remove('hidden');
      buildMenu();
    }, 2600);
  }

  function buildCoins() {
    game.coins = [];
    const t = game.track;
    const count = Math.floor(t.segments.length / 4);
    for (let i = 0; i < count; i++) {
      const z = (i * t.realLen / count + rand(-20, 20) + 120) % t.realLen;
      const lane = [-.52, -.27, 0, .27, .52][Math.floor(Math.random() * 5)];
      game.coins.push({ z, x: lane + rand(-.04, .04), taken: false });
    }
  }

  function buildTraffic() {
    game.traffic = [];
    const t = game.track;
    const density = Math.floor(18 * game.diff.traffic + t.realLen / 520);
    for (let i = 0; i < density; i++) {
      game.traffic.push({
        z: (i * t.realLen / density + rand(180, 520)) % t.realLen,
        x: [-.58, -.28, .22, .55][Math.floor(Math.random() * 4)] + rand(-.06, .06),
        speed: rand(48, 115),
        color: ['#e73535','#2759ff','#fed133','#f6f6f6','#32dd7c','#ff7b2a'][Math.floor(Math.random() * 6)],
        w: rand(.9, 1.18)
      });
    }
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

  function togglePause() {
    if (game.mode !== 'race') return;
    game.paused = !game.paused;
    showMessage(game.paused ? 'Пауза' : 'GO!', 700);
  }

  function update(dt) {
    if (game.messageTimer > 0) {
      game.messageTimer -= dt;
      if (game.messageTimer <= 0) raceMessage.classList.add('hidden');
    }
    if (game.mode !== 'race' || game.paused || game.finishCooldown > 0) return;

    const car = game.car;
    const track = game.track;
    const diff = game.diff;
    const seg = getSegmentAt(track, game.pos);
    const speedPct = clamp(game.speed / car.max, 0, 1.25);
    const offroad = Math.abs(game.x) > 1.02;
    const hardOff = Math.abs(game.x) > 1.36;
    const traction = car.grip * track.grip * diff.grip * (offroad ? .42 : 1) * (controls.handbrake ? .38 : 1);

    let acc = 0;
    if (controls.gas) acc += car.accel * (1 - speedPct * .45);
    if (controls.brake) acc -= car.brake * (game.speed > 20 ? 1 : .55);
    if (!controls.gas) acc -= 18 + game.speed * .025;
    acc -= game.speed * game.speed * .0012;
    if (offroad) acc -= 36 + game.speed * .18;
    if (hardOff) acc -= 28 + Math.abs(game.x) * 18;
    game.speed = clamp(game.speed + acc * dt, 0, car.max * (offroad ? .58 : 1));

    const rawSteer = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    // Важное отличие от прошлой версии: руль сглажен. Машина больше не дергается
    // мгновенно в сторону, а постепенно набирает боковую скорость как в старых аркадных гонках.
    const steerFollow = rawSteer ? 5.2 : 7.8;
    game.steerState = lerp(game.steerState || 0, rawSteer, 1 - Math.exp(-dt * steerFollow));
    const highSpeedSteerLoss = lerp(1.08, .56, clamp(speedPct, 0, 1));
    const steeringLive = game.speed > 2 ? (0.40 + speedPct * .88) : .12;
    const steerPower = car.handling * steeringLive * highSpeedSteerLoss / Math.sqrt(car.mass);
    const driftBonus = controls.handbrake ? (1.55 + car.drift * .85) : (0.82 + car.drift * .10);
    const curvePush = seg.curve * track.curveForce * (0.42 + speedPct * 1.75) * speedPct;

    game.dx += game.steerState * steerPower * dt * driftBonus;
    game.dx -= curvePush * dt;
    const damping = Math.exp(-dt * (3.45 + traction * 3.1));
    game.dx *= damping;
    if (offroad) game.dx *= Math.exp(-dt * 2.8);
    game.x += game.dx * dt * (0.78 + speedPct * 1.85);
    if (Math.abs(game.x) > 1.64) {
      game.x = sign(game.x) * 1.64;
      game.dx *= -.18;
      game.damage = clamp(game.damage + dt * .04 * diff.damage, 0, 1);
      game.cameraShake = Math.max(game.cameraShake, .35);
      if (Math.random() < dt * 3) playSound('scrape', .25);
    }

    const slip = Math.abs(game.dx) * speedPct + Math.abs(rawSteer) * speedPct * (controls.handbrake ? .8 : .25) + (offroad ? .25 : 0);
    if (slip > .42 && game.speed > 45) {
      game.skidTimer -= dt;
      if (game.skidTimer <= 0) { playSound('skid', .18); game.skidTimer = .62; }
    }

    const steerInput = game.steerState || 0;
    game.steerLean = lerp(game.steerLean, steerInput * .58 + game.dx * 1.35, 1 - Math.exp(-dt * 6.5));
    game.curveVisual = lerp(game.curveVisual, seg.curve, 1 - Math.exp(-dt * 3));
    const arcadeSpeedBoost = 1.55 + clamp(game.speed / Math.max(1, car.max), 0, 1) * .55;
    game.pos += game.speed * dt * arcadeSpeedBoost;
    game.totalMeters += game.speed * dt * 1.18;
    game.speedFx = lerp(game.speedFx || 0, clamp(game.speed / car.max, 0, 1), 1 - Math.exp(-dt * 5));
    game.raceTime += dt;
    game.cameraShake = Math.max(0, game.cameraShake - dt * 1.6);

    const oldLap = game.lap;
    game.lap = Math.floor(game.pos / track.realLen) + 1;
    if (game.lap !== oldLap && game.lap <= track.laps) {
      showMessage(`Круг ${game.lap}/${track.laps}`, 1100);
      playSound('checkpoint', .5);
    }
    if (game.lap > track.laps) finishRace();

    game.gear = clamp(Math.floor(game.speed / (car.max / 5)) + 1, 1, 6);
    game.rpm = clamp((game.speed / car.max) * 0.78 + (game.gear % 2) * .08 + (controls.gas ? .18 : .03), 0, 1.12);

    updateObjects(dt);
  }

  function wrapDistance(d, len) {
    d = d % len;
    if (d < 0) d += len;
    return d;
  }

  function aheadDelta(z, pos, len) {
    let dz = z - (pos % len);
    if (dz < -40) dz += len;
    return dz;
  }

  function updateObjects(dt) {
    const track = game.track;
    for (const coin of game.coins) {
      if (coin.taken) continue;
      const dz = aheadDelta(coin.z, game.pos, track.realLen);
      if (dz > -8 && dz < 24 && Math.abs(coin.x - game.x) < .17) {
        coin.taken = true;
        game.raceCoins += 1;
        playSound('checkpoint', .18);
      }
      if (dz < -22) coin.taken = false;
    }
    for (const t of game.traffic) {
      t.z = wrapDistance(t.z + t.speed * dt * .52, track.realLen);
      const dz = aheadDelta(t.z, game.pos, track.realLen);
      if (dz > -14 && dz < 20 && Math.abs(t.x - game.x) < .22 * t.w && game.speed > 14) {
        game.damage = clamp(game.damage + .11 * game.diff.damage + game.speed / 900, 0, 1);
        game.speed *= .55;
        game.dx += (game.x > t.x ? 1 : -1) * .42;
        t.x += (t.x > game.x ? 1 : -1) * .13;
        game.cameraShake = 1;
        playSound('scrape', .55);
        showMessage('HIT!', 450);
      }
    }
    if (game.damage >= 1) {
      showMessage('TOTAL DAMAGE', 1700);
      setTimeout(() => {
        save.odometer += game.totalMeters;
        persist();
        game.mode = 'menu';
        menu.classList.remove('hidden');
        buildMenu();
      }, 1700);
      game.finishCooldown = 2;
    }
  }

  function rowGeom(i, visible, curveOffset = 0) {
    const t = clamp(i / visible, 0, 1);
    const p = Math.pow(t, 1.78);
    const y = horizon + (roadBottom - horizon) * p;
    const width = lerp(16 * DPR, W * 1.18, Math.pow(t, 1.08));
    const center = W / 2 + curveOffset * width * .66 - game.x * width * .34;
    return { t, p, y, width, center };
  }

  function buildRoadCache() {
    // Больше рядов + меньший шаг = менее заметная «лесенка» и лучше ощущение скорости.
    const visible = Math.max(118, Math.floor(132 + game.speed * .32));
    const rows = [];
    let curveSpeed = 0;
    let curveOffset = 0;
    const step = game.track.segLen * .58;
    for (let i = 0; i <= visible; i++) {
      const dist = game.pos + i * step;
      const seg = getSegmentAt(game.track, dist);
      curveSpeed += seg.curve * .0135;
      curveOffset += curveSpeed;
      const g = rowGeom(i, visible, curveOffset);
      rows.push({ ...g, seg, dist, curveOffset, step });
    }
    return rows;
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    const shakeX = game.cameraShake ? rand(-2.2, 2.2) * DPR * game.cameraShake : 0;
    const shakeY = game.cameraShake ? rand(-1.6, 1.6) * DPR * game.cameraShake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    const track = game.track || selectedTrack();
    drawSky(track);
    if (game.mode === 'race') {
      const road = buildRoadCache();
      drawRoad(road, track);
      drawWorldObjects(road);
      drawPlayerCar();
      drawHud();
    } else {
      drawAttract(track);
    }
    ctx.restore();
  }

  function drawSky(track) {
    const pal = track.palette;
    const grad = ctx.createLinearGradient(0, 0, 0, roadBottom);
    if (pal === 'night') { grad.addColorStop(0, '#061731'); grad.addColorStop(.7, '#102b55'); grad.addColorStop(1, '#143c64'); }
    else if (pal === 'lava') { grad.addColorStop(0, '#3b1020'); grad.addColorStop(.55, '#77412b'); grad.addColorStop(1, '#bb7933'); }
    else { grad.addColorStop(0, '#57a9ff'); grad.addColorStop(.72, '#69b4ff'); grad.addColorStop(1, '#8fd4ff'); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, roadBottom);

    const horizonLine = horizon - 8 * DPR;
    drawClouds(pal);

    if (pal === 'city' || pal === 'night') drawCity(horizonLine, pal === 'night');
    else if (pal === 'lava') drawLavaMountains(horizonLine);
    else if (pal === 'valley') drawValley(horizonLine);
    else drawCountry(horizonLine);

    const grass1 = pal === 'lava' ? '#4b2f1e' : pal === 'night' ? '#0b3c2d' : pal === 'valley' ? '#19a64c' : '#26d737';
    const grass2 = pal === 'lava' ? '#6e3b20' : pal === 'night' ? '#0e4d37' : pal === 'valley' ? '#22be57' : '#54ed2f';
    for (let y = Math.max(horizonLine, 0); y < roadBottom; y += 10 * DPR) {
      ctx.fillStyle = ((y / (10 * DPR)) | 0) % 2 ? grass1 : grass2;
      ctx.fillRect(0, y, W, 10 * DPR);
    }
    ctx.fillStyle = pal === 'night' ? 'rgba(65,180,255,.24)' : 'rgba(75,190,255,.36)';
    ctx.fillRect(0, horizon + 82 * DPR, W, 4 * DPR);
  }

  function drawClouds(pal) {
    if (pal === 'night') {
      ctx.fillStyle = '#fff2a6';
      for (let i = 0; i < 34; i++) {
        const x = ((i * 211 + (game.pos || 0) * .025) % W);
        const y = (24 + (i * 37) % 135) * DPR;
        ctx.fillRect(x, y, 3 * DPR, 3 * DPR);
      }
      return;
    }
    ctx.fillStyle = pal === 'lava' ? '#ffd5b0' : '#fff';
    for (let i = 0; i < 10; i++) {
      const x = ((i * 195 - (game.pos || 0) * .045) % (W + 180 * DPR)) - 90 * DPR;
      const y = (28 + (i * 32) % 95) * DPR;
      pixelCloud(x, y, (i % 3 + 2) * DPR);
    }
  }

  function pixelCloud(x, y, s) {
    ctx.fillRect(x, y + 8*s, 42*s, 6*s);
    ctx.fillRect(x + 9*s, y + 2*s, 24*s, 10*s);
    ctx.fillRect(x + 32*s, y + 6*s, 23*s, 5*s);
    ctx.fillRect(x - 12*s, y + 12*s, 18*s, 4*s);
  }

  function drawCity(y, night) {
    const base = y + 5 * DPR;
    const colors = night ? ['#0b1220','#16243b','#25324a'] : ['#f2f7fb','#bfe6ff','#1b2434'];
    let x = -40 * DPR - ((game.pos * .03) % (150 * DPR));
    let n = 0;
    while (x < W + 80 * DPR) {
      const bw = (36 + (n * 19) % 62) * DPR;
      const bh = (42 + (n * 37) % 118) * DPR;
      ctx.fillStyle = colors[n % colors.length];
      ctx.fillRect(x, base - bh, bw, bh);
      ctx.fillStyle = night ? '#ffe777' : '#78bde6';
      const wx = Math.max(4 * DPR, bw / 7);
      for (let yy = base - bh + 10 * DPR; yy < base - 10 * DPR; yy += 14 * DPR) {
        for (let xx = x + 8 * DPR; xx < x + bw - 8 * DPR; xx += 16 * DPR) {
          if ((xx + yy + n) % 5 !== 0) ctx.fillRect(xx, yy, wx, 3 * DPR);
        }
      }
      x += bw + (6 + n % 3) * DPR;
      n++;
    }
  }

  function drawCountry(y) {
    ctx.fillStyle = '#0d7e28';
    for (let i = 0; i < 13; i++) {
      const x = ((i * 150 - game.pos * .035) % (W + 260 * DPR)) - 120 * DPR;
      const h = (35 + (i * 23) % 70) * DPR;
      ctx.beginPath();
      ctx.moveTo(x, y + 6 * DPR);
      ctx.lineTo(x + 75 * DPR, y - h);
      ctx.lineTo(x + 160 * DPR, y + 6 * DPR);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#0b5d22';
    ctx.fillRect(0, y + 4 * DPR, W, 14 * DPR);
  }

  function drawValley(y) {
    ctx.fillStyle = '#204f47';
    for (let i = 0; i < 10; i++) {
      const x = ((i * 230 - game.pos * .025) % (W + 360 * DPR)) - 180 * DPR;
      const h = (80 + (i * 53) % 95) * DPR;
      ctx.beginPath();
      ctx.moveTo(x, y + 10 * DPR);
      ctx.lineTo(x + 95 * DPR, y - h);
      ctx.lineTo(x + 210 * DPR, y + 10 * DPR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5c8c7f';
      ctx.beginPath();
      ctx.moveTo(x + 95 * DPR, y - h);
      ctx.lineTo(x + 122 * DPR, y + 10 * DPR);
      ctx.lineTo(x + 60 * DPR, y + 10 * DPR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#204f47';
    }
  }

  function drawLavaMountains(y) {
    ctx.fillStyle = '#2a1721';
    for (let i = 0; i < 8; i++) {
      const x = ((i * 260 - game.pos * .02) % (W + 400 * DPR)) - 200 * DPR;
      const h = (90 + (i * 73) % 120) * DPR;
      ctx.beginPath();
      ctx.moveTo(x, y + 18 * DPR);
      ctx.lineTo(x + 120 * DPR, y - h);
      ctx.lineTo(x + 260 * DPR, y + 18 * DPR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff6a2e';
      ctx.fillRect(x + 118 * DPR, y - h + 12 * DPR, 8 * DPR, h * .75);
      ctx.fillStyle = '#2a1721';
    }
    ctx.fillStyle = '#ff4d1f';
    ctx.fillRect(0, y + 15 * DPR, W, 7 * DPR);
  }

  function drawRoad(rows, track) {
    const pal = track.palette;
    // Фон травы уже нарисован в drawSky. Здесь рисуем только полотно дороги,
    // чтобы не было случайного горизонтального «полосения» по всему экрану.
    for (let i = rows.length - 2; i >= 0; i--) {
      const near = rows[i + 1];
      const far = rows[i];
      const strip = Math.floor((far.dist / track.segLen) / 3) % 2;
      const fy = Math.floor(far.y);
      const ny = Math.ceil(near.y) + 1;
      const shoulderWFar = far.width * .062;
      const shoulderWNear = near.width * .062;
      const roadFar = far.width * .50;
      const roadNear = near.width * .50;

      // Обочина/бордюр. Рисуется с небольшим перехлестом, чтобы в браузере не появлялись микротрещины.
      drawQuad(far.center - roadFar - shoulderWFar, fy, far.center - roadFar + 1, fy, near.center - roadNear + 1, ny, near.center - roadNear - shoulderWNear, ny, strip ? '#d82a1d' : '#f4f4f4');
      drawQuad(far.center + roadFar - 1, fy, far.center + roadFar + shoulderWFar, fy, near.center + roadNear + shoulderWNear, ny, near.center + roadNear - 1, ny, strip ? '#f4f4f4' : '#d82a1d');

      // Асфальт почти без полос: только слабая разница рядов, иначе на Retina появлялось мерцание.
      drawQuad(far.center - roadFar, fy, far.center + roadFar, fy, near.center + roadNear, ny, near.center - roadNear, ny, paletteRoad(track, strip));

      // Белые «летящие» штрихи разметки дают ощущение скорости.
      const dashOn = (Math.floor((far.dist + game.pos * .08) / 34) % 3) === 0;
      if (dashOn && i > 8) {
        const laneWFar = Math.max(2 * DPR, far.width * .010);
        const laneWNear = Math.max(3 * DPR, near.width * .012);
        for (const l of [-.33, 0, .33]) {
          const lf = far.center + l * roadFar * 2;
          const ln = near.center + l * roadNear * 2;
          drawQuad(lf - laneWFar, fy, lf + laneWFar, fy, ln + laneWNear, ny, ln - laneWNear, ny, 'rgba(255,255,255,.86)');
        }
      }

      // Дополнительные серые штрихи на ближней части дороги: поток выглядит быстрее, но не полосит весь экран.
      if (i < rows.length * .38 && (Math.floor((far.dist + game.pos) / 18) % 4 === 0)) {
        ctx.fillStyle = pal === 'night' ? 'rgba(170,205,255,.14)' : 'rgba(255,255,255,.18)';
        const side = Math.sin(far.dist * .07) > 0 ? -1 : 1;
        const x1 = near.center + side * roadNear * (.18 + (i % 7) * .07);
        ctx.fillRect(x1, ny - 2 * DPR, Math.max(28 * DPR, near.width * .08), Math.max(1, 2 * DPR));
      }
    }
    drawSpeedLines();
  }

  function drawSpeedLines() {
    const fx = game.speedFx || 0;
    if (fx < .30) return;
    const count = Math.floor(10 + fx * 28);
    ctx.save();
    ctx.globalAlpha = clamp((fx - .25) * .55, 0, .36);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 2 * DPR);
    for (let i = 0; i < count; i++) {
      const seed = (i * 997 + Math.floor(game.pos * .7)) % 997;
      const x = (seed / 997) * W;
      const y = roadBottom - ((seed * 37) % Math.max(1, (roadBottom - horizon))) * .55;
      if (y < horizon + 40 * DPR || y > roadBottom - 8 * DPR) continue;
      const len = (26 + fx * 95) * DPR * (0.5 + (seed % 10) / 10);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * .7, y + len * .08);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paletteRoad(track, idx) {
    if (track.palette === 'lava') return idx ? '#5a514e' : '#6b615d';
    if (track.palette === 'night') return idx ? '#28364b' : '#34465e';
    return idx ? '#777' : '#858585';
  }
  function paletteGrass(track, idx) {
    if (track.palette === 'lava') return idx ? '#55341f' : '#6b4329';
    if (track.palette === 'night') return idx ? '#06381f' : '#074626';
    if (track.palette === 'valley') return idx ? '#149444' : '#20ac51';
    return idx ? '#22c930' : '#52e92d';
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

  function projectObject(z, x, rows) {
    const track = game.track;
    const dz = aheadDelta(z, game.pos, track.realLen);
    if (dz < 0 || dz > track.segLen * (rows.length - 1)) return null;
    const idx = clamp(Math.floor(dz / (track.segLen * .95)), 0, rows.length - 2);
    const a = rows[idx], b = rows[idx + 1];
    const f = (dz - idx * track.segLen * .95) / (track.segLen * .95);
    const y = lerp(a.y, b.y, f);
    const width = lerp(a.width, b.width, f);
    const center = lerp(a.center, b.center, f);
    const roadW = width * .48;
    return { x: center + x * roadW, y, scale: clamp(width / (W * .9), .025, 1.1), roadW, dz };
  }

  function drawWorldObjects(rows) {
    const objs = [];
    for (const c of game.coins) if (!c.taken) objs.push({ type: 'coin', ...c });
    for (const t of game.traffic) objs.push({ type: 'traffic', ...t });
    objs.sort((a, b) => aheadDelta(b.z, game.pos, game.track.realLen) - aheadDelta(a.z, game.pos, game.track.realLen));
    for (const o of objs) {
      const p = projectObject(o.z, o.x, rows);
      if (!p || p.y < horizon || p.y > roadBottom + 20 * DPR) continue;
      if (o.type === 'coin') drawCoin(p);
      else drawTrafficCar(p, o);
    }
  }

  function drawCoin(p) {
    const r = Math.max(3 * DPR, 20 * DPR * p.scale);
    ctx.save();
    ctx.translate(p.x, p.y - r * .6);
    ctx.fillStyle = '#ffce2e';
    ctx.strokeStyle = '#9b5a00';
    ctx.lineWidth = Math.max(1, 2 * DPR * p.scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * .5, r, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3a5';
    ctx.fillRect(-r * .12, -r * .5, r * .22, r);
    ctx.restore();
  }

  function drawTrafficCar(p, o) {
    const s = Math.max(.18, p.scale * 1.9) * DPR;
    ctx.save();
    ctx.translate(p.x, p.y - 10 * s);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-21, 11, 42, 7);
    ctx.fillStyle = '#090909';
    ctx.fillRect(-25, 1, 9, 16);
    ctx.fillRect(16, 1, 9, 16);
    ctx.fillStyle = o.color;
    ctx.fillRect(-18, -7, 36, 19);
    ctx.fillRect(-13, -17, 26, 13);
    ctx.fillStyle = '#bff4ff';
    ctx.fillRect(-8, -14, 16, 7);
    ctx.fillStyle = '#ffec7b';
    ctx.fillRect(-16, 8, 7, 4);
    ctx.fillRect(9, 8, 7, 4);
    ctx.restore();
  }

  function drawPlayerCar() {
    const car = game.car || selectedCar();
    const roadW = W * 1.18 * .50;
    const carX = W / 2 + game.x * roadW * .52;
    const carY = roadBottom - 34 * DPR;
    const sc = clamp(W / 1280, .72, 1.22) * DPR;
    ctx.save();
    ctx.translate(carX, carY);
    // Визуальный наклон тоже сглажен, чтобы машина не дергалась при каждом нажатии.
    ctx.rotate(clamp(game.steerLean, -1.1, 1.1) * .085);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(-58, 23, 116, 13);
    drawRearCarSprite(car);
    ctx.restore();
  }

  function drawRearCarSprite(car) {
    // Ретро-спрайт заднего вида, но с цветом/пропорциями выбранной машины.
    const wide = car.mass > 1.2 || car.id === 'raptor';
    const low = car.id === 'slingshot' || car.id === 'viper' || car.id === 'roadster';
    const bodyW = wide ? 100 : 86;
    const bodyH = low ? 44 : 52;
    const roofW = wide ? 62 : 54;
    const roofH = low ? 18 : 22;
    ctx.fillStyle = '#050505';
    ctx.fillRect(-bodyW/2 - 12, -3, 18, 37);
    ctx.fillRect(bodyW/2 - 6, -3, 18, 37);
    ctx.fillRect(-bodyW/2 + 7, -24, 13, 25);
    ctx.fillRect(bodyW/2 - 20, -24, 13, 25);
    ctx.fillStyle = '#0b0d11';
    ctx.fillRect(-bodyW/2 - 3, -bodyH + 4, bodyW + 6, bodyH + 28);
    ctx.fillStyle = car.color;
    ctx.fillRect(-bodyW/2, -bodyH, bodyW, bodyH + 24);
    ctx.fillStyle = shade(car.color, 34);
    ctx.fillRect(-roofW/2, -bodyH - roofH + 7, roofW, roofH);
    ctx.fillStyle = '#111b25';
    ctx.fillRect(-roofW/2 + 8, -bodyH - roofH + 10, roofW - 16, 10);
    ctx.fillStyle = shade(car.color, -42);
    ctx.fillRect(-bodyW/2 + 8, -12, bodyW - 16, 19);
    ctx.fillStyle = '#eaf7ff';
    ctx.fillRect(-bodyW/2 + 10, 8, 17, 7);
    ctx.fillRect(bodyW/2 - 27, 8, 17, 7);
    ctx.fillStyle = '#ff263c';
    ctx.fillRect(-bodyW/2 + 4, -29, 8, 15);
    ctx.fillRect(bodyW/2 - 12, -29, 8, 15);
    ctx.fillStyle = '#070707';
    ctx.fillRect(-20, 18, 40, 7);
    ctx.fillStyle = '#dfe8ef';
    for (let i = 0; i < 4; i++) ctx.fillRect(-16 + i*9, 19, 5, 5);
    if (controls.left || controls.right) {
      ctx.fillStyle = '#ffd338';
      ctx.fillRect(controls.left ? -bodyW/2 - 25 : bodyW/2 + 15, -32, 9, 19);
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = clamp(r, 0, 255)|0; g = clamp(g, 0, 255)|0; b = clamp(b, 0, 255)|0;
    return `rgb(${r},${g},${b})`;
  }

  function drawHud() {
    const y = roadBottom;
    ctx.fillStyle = 'rgba(0,0,0,.92)';
    ctx.fillRect(0, y, W, hudH + 10 * DPR);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 9; i++) ctx.fillRect(i * W / 8 - game.pos % 80, y + 10 * DPR + i * 3, W / 5, 4 * DPR);

    const speedKmh = Math.floor(game.speed * 3.6);
    const leftX = 10 * DPR;
    drawPixelText('SPEED', leftX, y + 23 * DPR, 13 * DPR, '#fff');
    drawPixelText(String(speedKmh).padStart(3, '0'), leftX, y + 48 * DPR, 36 * DPR, '#ff382d');
    drawPixelText('km/h', leftX + 93 * DPR, y + 67 * DPR, 13 * DPR, '#fff');
    drawPixelText('GEAR', leftX, y + 94 * DPR, 13 * DPR, '#fff');
    drawPixelText(String(game.gear), leftX + 70 * DPR, y + 90 * DPR, 32 * DPR, '#ff382d');
    drawBar(leftX, y + 125 * DPR, 270 * DPR, 12 * DPR, game.damage, '#ff3241', 'DAMAGE');

    const gaugeSize = clamp(112 * DPR, 90 * DPR, hudH * .86);
    drawGauge(W * .36, y + hudH * .58, gaugeSize * .86, game.rpm, 'TACH');
    drawGauge(W * .55, y + hudH * .58, gaugeSize * .86, clamp(game.speed / game.car.max, 0, 1), 'MPH/KMH');

    drawPixelText('LAP', W * .44, y + 34 * DPR, 14 * DPR, '#fff');
    drawPixelText(`${Math.min(game.lap, game.track.laps)}/${game.track.laps}`, W * .49, y + 34 * DPR, 19 * DPR, '#50ff8d');
    drawPixelText('TIME', W * .44, y + 67 * DPR, 14 * DPR, '#fff');
    drawPixelText(fmtTime(game.raceTime), W * .49, y + 67 * DPR, 18 * DPR, '#ff4a35');
    drawPixelText('COINS', W * .44, y + 100 * DPR, 14 * DPR, '#fff');
    drawPixelText(String(game.raceCoins), W * .49, y + 100 * DPR, 18 * DPR, '#ffd338');

    const turnX = W * .65;
    drawPixelText('TURN', turnX, y + 64 * DPR, 11 * DPR, '#b8c6e9');
    ctx.fillStyle = controls.left ? '#ffd338' : 'rgba(255,255,255,.18)';
    triangle(turnX - 24 * DPR, y + 81 * DPR, 19 * DPR, -1);
    ctx.fillStyle = controls.right ? '#ffd338' : 'rgba(255,255,255,.18)';
    triangle(turnX + 38 * DPR, y + 81 * DPR, 19 * DPR, 1);

    const distX = W * .70;
    const progress = ((game.pos % game.track.realLen) / game.track.realLen);
    drawPixelText('DISTANCE', distX, y + 34 * DPR, 13 * DPR, '#fff');
    drawBar(distX, y + 50 * DPR, W * .26, 12 * DPR, progress, '#ff3a2d');
    drawPixelText(`${Math.floor(game.totalMeters)} m`, distX, y + 85 * DPR, 14 * DPR, '#fff');
    drawPixelText('ODOMETER', distX, y + 112 * DPR, 11 * DPR, '#b8c6e9');
    drawPixelText(`${((save.odometer + game.totalMeters) / 1000).toFixed(2)} km`, distX + 120 * DPR, y + 112 * DPR, 13 * DPR, '#ffd338');

    drawMiniMap(W - 150 * DPR, y + 22 * DPR, 132 * DPR, hudH - 38 * DPR);
  }

  function drawPixelText(text, x, y, size, color) {
    ctx.font = `900 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillText(text, x + 2 * DPR, y + 2 * DPR);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawBar(x, y, w, h, val, color, label) {
    if (label) drawPixelText(label, x, y - 18 * DPR, 11 * DPR, '#fff');
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1 * DPR;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(x + 2 * DPR, y + 2 * DPR, w - 4 * DPR, h - 4 * DPR);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2 * DPR, y + 2 * DPR, (w - 4 * DPR) * clamp(val, 0, 1), h - 4 * DPR);
  }

  function drawGauge(cx, cy, size, value, label) {
    ctx.save();
    ctx.translate(cx, cy);
    if (images.gauge) ctx.drawImage(images.gauge, -size / 2, -size / 2, size, size);
    else {
      ctx.strokeStyle = '#dfe4ea'; ctx.lineWidth = 4 * DPR; ctx.beginPath(); ctx.arc(0, 0, size*.42, Math.PI*.82, Math.PI*2.18); ctx.stroke();
    }
    const angle = lerp(-2.35, .85, clamp(value, 0, 1));
    ctx.rotate(angle);
    if (images.needle) ctx.drawImage(images.needle, -4 * DPR, -size * .44, 8 * DPR, size * .5);
    else { ctx.strokeStyle = '#ff2a3a'; ctx.lineWidth = 3 * DPR; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -size*.38); ctx.stroke(); }
    ctx.rotate(-angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 5 * DPR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    drawPixelText(label, cx - size * .42, cy - size * .58, 10 * DPR, '#fff');
  }

  function triangle(x, y, s, dir) {
    ctx.beginPath();
    ctx.moveTo(x + dir * s, y);
    ctx.lineTo(x - dir * s, y - s * .7);
    ctx.lineTo(x - dir * s, y + s * .7);
    ctx.closePath();
    ctx.fill();
  }

  function drawMiniMap(x, y, w, h) {
    ctx.fillStyle = 'rgba(9, 40, 22, .92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2 * DPR;
    ctx.strokeRect(x, y, w, h);
    const segs = game.track.segments;
    ctx.save();
    ctx.translate(x + w*.5, y + h*.5);
    ctx.scale(w / 5, h / 5);
    ctx.strokeStyle = '#d6e8e5';
    ctx.lineWidth = .08;
    ctx.beginPath();
    let px = 0, py = -2;
    ctx.moveTo(px, py);
    for (let i = 0; i < segs.length; i += Math.ceil(segs.length / 90)) {
      const a = i / segs.length * Math.PI * 2;
      const c = segs[i].curve;
      const r = 1.55 + c * .34;
      px = Math.sin(a) * r;
      py = -Math.cos(a) * r;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    const p = (game.pos % game.track.realLen) / game.track.realLen * Math.PI * 2;
    ctx.fillStyle = '#ff303d';
    ctx.fillRect(Math.sin(p)*1.55 - .09, -Math.cos(p)*1.55 - .09, .18, .18);
    ctx.restore();
  }

  function drawAttract(track) {
    const fake = game.mode !== 'race';
    const oldTrack = game.track;
    const oldPos = game.pos;
    if (fake) { game.track = selectedTrack(); game.pos += .65; }
    const road = buildRoadCache();
    drawRoad(road, selectedTrack());
    if (fake) { game.track = oldTrack; game.pos = oldPos; }
    drawPixelText('Q3 RETRO RALLY', W * .06, H * .16, Math.max(30 * DPR, W * .045), '#ffffff');
    drawPixelText('выбери авто, трассу и жми СТАРТ', W * .06, H * .16 + 58 * DPR, Math.max(14 * DPR, W * .015), '#ffd338');
  }

  let last = performance.now();
  function frame(now) {
    const dtRaw = (now - last) / 1000;
    last = now;
    const dt = clamp(dtRaw, 0, 1/25);
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function initPwa() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  loadImages().then(() => {
    loadSounds();
    buildMenu();
    initPwa();
    requestAnimationFrame(frame);
  });
})();
