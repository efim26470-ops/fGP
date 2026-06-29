(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = 480;
  const H = 270;
  const HUD_H = 58;
  const GAME_H = H - HUD_H;

  const SEGMENT_LENGTH = 80;      // условные метры
  const ROAD_WIDTH = 2100;
  const CAMERA_HEIGHT = 960;
  const CAMERA_DEPTH = 0.72;
  const DRAW_DISTANCE = 92;
  const LANES = 3;
  const STORAGE_KEY = 'retro-grand-prix-v3-save';

  const COLORS = {
    sky: '#58aaf5',
    hud: '#080808',
    white: '#f6f6f6',
    black: '#050505',
    red: '#d73522',
    yellow: '#ffcf33',
    green: '#21d33b',
    darkGreen: '#138b33',
    roadA: '#747474',
    roadB: '#6a6a6a',
    lane: '#e4e4e4',
    rumbleRed: '#c93423',
    rumbleWhite: '#f6f6f6'
  };

  const CARS = [
    { id: 'starter', name: 'Pixel Hatch', cost: 0, color: '#28c7ff', max: 210, accel: 42, brake: 110, handling: 1.55, grip: 1.00, mass: 1.00, desc: 'Бесплатная машина: легче рулить, но слабая скорость.' },
    { id: 'turbo', name: 'Turbo Berlinetta', cost: 280, color: '#e3392d', max: 275, accel: 58, brake: 118, handling: 1.68, grip: 1.05, mass: .94, desc: 'Быстрее стартует, держит повороты стабильнее.' },
    { id: 'formula', name: 'Formula RX', cost: 720, color: '#f2f2f2', max: 318, accel: 70, brake: 132, handling: 2.08, grip: 1.23, mass: .80, desc: 'Болид: резкий руль, лучший темп на извилистых трассах.' },
    { id: 'v12', name: 'V12 Meteor', cost: 1100, color: '#7d35ff', max: 350, accel: 76, brake: 120, handling: 1.50, grip: .98, mass: 1.25, desc: 'Очень быстрый на прямых, тяжелый в поворотах.' },
    { id: 'rally', name: 'Rally Box', cost: 520, color: '#ffb21f', max: 245, accel: 60, brake: 128, handling: 1.86, grip: 1.38, mass: .96, desc: 'Лучше всех едет по траве и грязным обочинам.' },
    { id: 'drift', name: 'Drift Wedge', cost: 900, color: '#18e078', max: 300, accel: 64, brake: 115, handling: 2.28, grip: .92, mass: .88, desc: 'Острый, нервный, легко уходит в занос.' }
  ];

  const TRACKS = [
    {
      id: 'classic', name: 'Classic GP', lengthName: '5.8 км', scenery: 'classic',
      desc: 'NES-стиль: прямые, плавные S-повороты, простая разметка.',
      sections: [
        [16, 0], [18, .75], [12, 0], [20, -1.05], [10, 0], [26, 1.22],
        [14, -.55], [18, 0], [16, -1.40], [20, 1.00], [18, 0], [10, -.35]
      ], coinRate: 2.7, traffic: 11
    },
    {
      id: 'city', name: 'Metro Straight', lengthName: '6.4 км', scenery: 'city',
      desc: 'Больше длинных прямых, но есть резкие городские связки.',
      sections: [
        [22, 0], [30, .25], [18, 0], [15, -1.55], [10, 1.35], [24, 0],
        [20, .80], [12, 0], [16, -1.20], [30, 0], [14, .55]
      ], coinRate: 2.2, traffic: 8
    },
    {
      id: 'mountain', name: 'Mountain Snake', lengthName: '5.3 км', scenery: 'mountain',
      desc: 'Много поворотов, мало прямых, обочина сильнее замедляет.',
      sections: [
        [10, 0], [14, 1.65], [8, -1.75], [16, 1.85], [8, 0], [14, -1.95],
        [12, .95], [10, -.85], [14, 1.70], [12, -1.50], [12, 0]
      ], coinRate: 3.1, traffic: 12
    },
    {
      id: 'coast', name: 'Coast Run', lengthName: '7.0 км', scenery: 'coast',
      desc: 'Широкие быстрые дуги и монеты ближе к краям дороги.',
      sections: [
        [28, 0], [36, .62], [22, 0], [30, -.72], [16, 0], [24, 1.10],
        [20, -.92], [34, 0], [18, .35]
      ], coinRate: 2.9, traffic: 9
    }
  ];

  const DIFFICULTIES = [
    { id: 'easy', name: 'Easy', reward: 1.0, trafficMul: .72, damageMul: .65, gripMul: 1.10, desc: 'Больше сцепления, меньше трафика.' },
    { id: 'normal', name: 'Normal', reward: 1.25, trafficMul: 1.00, damageMul: 1.00, gripMul: 1.0, desc: 'Баланс как в классической аркаде.' },
    { id: 'hard', name: 'Hard', reward: 1.65, trafficMul: 1.45, damageMul: 1.35, gripMul: .92, desc: 'Сложнее удержать машину, больше соперников.' },
    { id: 'retro', name: 'Retro Pain', reward: 2.1, trafficMul: 1.90, damageMul: 1.65, gripMul: .84, desc: 'Почти без права на ошибку.' }
  ];

  const state = {
    save: loadSave(),
    selectedCar: 'starter', selectedTrack: 'classic', selectedDifficulty: 'normal',
    segments: [], trackLength: 0, map: [], objects: [],
    running: false, paused: false, finished: false,
    position: 0, speed: 0, playerX: 0, steerVelocity: 0, carLean: 0,
    lap: 1, laps: 2, lapStartedAt: 0, raceTime: 0, raceCoins: 0, damage: 0, odometer: 0,
    lastFrame: 0, flash: 0, countdown: 0
  };

  const input = { left: false, right: false, gas: false, brake: false };

  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        coins: Number.isFinite(raw.coins) ? raw.coins : 0,
        owned: Array.isArray(raw.owned) ? raw.owned : ['starter'],
        best: raw.best || {},
        selectedCar: raw.selectedCar || 'starter',
        selectedTrack: raw.selectedTrack || 'classic',
        selectedDifficulty: raw.selectedDifficulty || 'normal'
      };
    } catch {
      return { coins: 0, owned: ['starter'], best: {}, selectedCar: 'starter', selectedTrack: 'classic', selectedDifficulty: 'normal' };
    }
  }

  function saveGame() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
  }

  function byId(list, id) { return list.find(x => x.id === id) || list[0]; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return (1 - Math.cos(t * Math.PI)) / 2; }
  function percentRemaining(n, total) { return (n % total) / total; }
  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const cs = Math.floor((t - Math.floor(t)) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  function newPoint(z, y = 0) {
    return { world: { x: 0, y, z }, camera: {}, screen: {} };
  }

  function addSegment(curve, y) {
    const n = state.segments.length;
    state.segments.push({
      index: n,
      p1: newPoint(n * SEGMENT_LENGTH, y),
      p2: newPoint((n + 1) * SEGMENT_LENGTH, y),
      curve,
      color: Math.floor(n / 3) % 2
    });
  }

  function buildTrack(track) {
    state.segments = [];
    let currentCurve = 0;
    let y = 0;
    for (const [length, targetCurve] of track.sections) {
      for (let i = 0; i < length; i++) {
        const t = easeInOut(i / Math.max(1, length - 1));
        const c = lerp(currentCurve, targetCurve, t);
        y += Math.sin((state.segments.length / 17)) * 0.25;
        addSegment(c, y);
      }
      currentCurve = targetCurve;
    }
    // плавное возвращение к нулю перед финишем
    for (let i = 0; i < 18; i++) {
      addSegment(lerp(currentCurve, 0, easeInOut(i / 17)), y);
    }
    state.trackLength = state.segments.length * SEGMENT_LENGTH;
    buildObjects(track);
    buildMap();
  }

  function buildObjects(track) {
    const difficulty = byId(DIFFICULTIES, state.selectedDifficulty);
    state.objects = [];
    for (let i = 18; i < state.segments.length - 8; i += Math.max(5, Math.floor(11 / track.coinRate))) {
      const zig = Math.sin(i * 1.77);
      const offset = clamp(zig * .55 + Math.sin(i * .23) * .22, -.82, .82);
      state.objects.push({ type: 'coin', z: i * SEGMENT_LENGTH + 22, offset, taken: false, spin: (i % 8) / 8 });
    }
    const trafficEvery = Math.max(7, Math.floor(track.traffic / difficulty.trafficMul));
    for (let i = 24; i < state.segments.length - 12; i += trafficEvery) {
      const offset = [-.56, -.24, .26, .58][i % 4];
      const color = ['#ffdf28', '#f04747', '#ffffff', '#3268ff', '#29dc83'][i % 5];
      state.objects.push({ type: 'traffic', z: i * SEGMENT_LENGTH + 30, offset, color, wobble: Math.sin(i) });
    }
  }

  function buildMap() {
    const pts = [];
    let x = 0, y = 0, a = 0;
    for (const seg of state.segments) {
      a += seg.curve * 0.012;
      x += Math.sin(a) * 2.4;
      y += Math.cos(a) * 2.4;
      pts.push({ x, y });
    }
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    state.map = pts.map(p => ({ x: (p.x - minX) / Math.max(1, maxX - minX), y: (p.y - minY) / Math.max(1, maxY - minY) }));
  }

  function findSegment(z) {
    return state.segments[Math.floor(z / SEGMENT_LENGTH) % state.segments.length];
  }

  function startRace() {
    const track = byId(TRACKS, state.selectedTrack);
    buildTrack(track);
    state.position = 0;
    state.speed = 0;
    state.playerX = 0;
    state.steerVelocity = 0;
    state.carLean = 0;
    state.lap = 1;
    state.laps = 2;
    state.raceTime = 0;
    state.raceCoins = 0;
    state.damage = 0;
    state.odometer = 0;
    state.running = true;
    state.paused = false;
    state.finished = false;
    state.countdown = 2.2;
    state.lastFrame = performance.now();
    document.getElementById('menu').classList.remove('open');
    document.getElementById('finish').classList.remove('open');
    requestAnimationFrame(frame);
  }

  function finishRace(reason = 'finish') {
    state.running = false;
    state.finished = true;
    const difficulty = byId(DIFFICULTIES, state.selectedDifficulty);
    const timeBonus = reason === 'finish' ? Math.max(0, Math.floor((190 - state.raceTime) * difficulty.reward)) : 0;
    const reward = Math.floor((state.raceCoins + timeBonus) * difficulty.reward);
    state.save.coins += reward;
    const key = `${state.selectedTrack}_${state.selectedDifficulty}`;
    if (reason === 'finish' && (!state.save.best[key] || state.raceTime < state.save.best[key])) state.save.best[key] = state.raceTime;
    saveGame();
    document.getElementById('finishTitle').textContent = reason === 'crash' ? 'МАШИНА РАЗБИТА' : 'ФИНИШ!';
    document.getElementById('finishText').innerHTML = reason === 'crash'
      ? `Урон достиг 100%. Собрано монет за заезд: <b>${state.raceCoins}</b>. Начислено: <b>${reward}</b>.`
      : `Время: <b>${formatTime(state.raceTime)}</b><br>Монеты на трассе: <b>${state.raceCoins}</b><br>Бонус: <b>${timeBonus}</b><br>Начислено всего: <b>${reward}</b>.`;
    document.getElementById('finish').classList.add('open');
    renderMenu();
  }

  function update(dt) {
    if (!state.running || state.paused) return;
    const car = byId(CARS, state.selectedCar);
    const track = byId(TRACKS, state.selectedTrack);
    const difficulty = byId(DIFFICULTIES, state.selectedDifficulty);
    if (state.countdown > 0) {
      state.countdown -= dt;
      return;
    }

    const maxSpeed = car.max * (1 - state.damage * 0.0035);
    const throttle = input.gas ? 1 : 0;
    const brake = input.brake ? 1 : 0;
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speedRatio = clamp(state.speed / Math.max(1, car.max), 0, 1.25);
    const offRoad = Math.abs(state.playerX) > 1.0;
    const offRoadAmount = Math.max(0, Math.abs(state.playerX) - 1.0);
    const rallyBonus = car.id === 'rally' ? .48 : 1;

    if (throttle) state.speed += car.accel * (1 - speedRatio * .36) * dt;
    else state.speed -= (16 + speedRatio * 24) * dt;
    if (brake) state.speed -= car.brake * dt;
    state.speed -= (5.8 + speedRatio * 9.5) * dt; // сопротивление
    if (offRoad) {
      state.speed -= (52 + 135 * offRoadAmount) * rallyBonus * dt;
      state.damage += (3.5 + 13 * offRoadAmount) * difficulty.damageMul * dt;
    }
    state.speed = clamp(state.speed, 0, maxSpeed);

    const seg = findSegment(state.position);
    const grip = car.grip * difficulty.gripMul * (offRoad ? (car.id === 'rally' ? .88 : .55) : 1);
    const steeringPower = car.handling * grip * (0.22 + speedRatio * 1.05);
    const targetSteerVelocity = steer * steeringPower;
    state.steerVelocity = lerp(state.steerVelocity, targetSteerVelocity, clamp(dt * 7.5, 0, 1));
    state.playerX += state.steerVelocity * dt;

    // Снос наружу поворота: чем выше скорость, тем сильнее дорога "выкидывает".
    const centrifugal = seg.curve * speedRatio * speedRatio * (1.08 / Math.max(.55, grip));
    state.playerX -= centrifugal * dt;

    if (Math.abs(state.playerX) > 1.42) {
      state.playerX = clamp(state.playerX, -1.42, 1.42);
      state.speed *= 1 - .9 * dt;
      state.damage += 8 * difficulty.damageMul * dt;
    }

    state.carLean = lerp(state.carLean, steer * .65 - seg.curve * .18, clamp(dt * 8, 0, 1));

    const oldPosition = state.position;
    const meters = (state.speed / 3.6) * dt;
    state.position = (state.position + meters) % state.trackLength;
    state.odometer += meters / 1000;
    state.raceTime += dt;

    if (oldPosition > state.position) {
      state.lap += 1;
      if (state.lap > state.laps) finishRace('finish');
    }

    updateObjects(dt);
    if (state.damage >= 100) finishRace('crash');
  }

  function updateObjects(dt) {
    const difficulty = byId(DIFFICULTIES, state.selectedDifficulty);
    for (const obj of state.objects) {
      let dz = obj.z - state.position;
      if (dz < -50) dz += state.trackLength;
      if (dz > 45 || dz < 0) continue;
      const laneHit = Math.abs(obj.offset - state.playerX);
      if (obj.type === 'coin' && !obj.taken && laneHit < .17) {
        obj.taken = true;
        state.raceCoins += 1;
        state.flash = .25;
        state.save.coins += 1;
        saveGame();
      } else if (obj.type === 'traffic' && laneHit < .27 && state.speed > 25) {
        state.speed *= .46;
        state.damage += 18 * difficulty.damageMul;
        state.playerX += (state.playerX > obj.offset ? .17 : -.17);
        state.flash = .45;
      }
    }
    if (state.flash > 0) state.flash -= dt;
  }

  function project(point, cameraX, cameraY, cameraZ, looped) {
    const z = point.world.z + (looped ? state.trackLength : 0);
    point.camera.x = point.world.x - cameraX;
    point.camera.y = point.world.y - cameraY;
    point.camera.z = z - cameraZ;
    point.screen.scale = CAMERA_DEPTH / Math.max(1, point.camera.z);
    point.screen.x = Math.round((W / 2) + (point.screen.scale * point.camera.x * W / 2));
    point.screen.y = Math.round((GAME_H / 2) - (point.screen.scale * point.camera.y * GAME_H / 2));
    point.screen.w = Math.round(point.screen.scale * ROAD_WIDTH * W / 2);
  }

  function polygon(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function drawSegment(seg) {
    const p1 = seg.p1.screen;
    const p2 = seg.p2.screen;
    const grass = seg.color ? '#20c83a' : '#1fbf37';
    const rumble = seg.color ? COLORS.rumbleRed : COLORS.rumbleWhite;
    const road = seg.color ? COLORS.roadA : COLORS.roadB;
    const r1 = p1.w / 5.8, r2 = p2.w / 5.8;
    polygon([[0, p2.y], [W, p2.y], [W, p1.y], [0, p1.y]], grass);
    polygon([[p2.x - p2.w - r2, p2.y], [p2.x - p2.w, p2.y], [p1.x - p1.w, p1.y], [p1.x - p1.w - r1, p1.y]], rumble);
    polygon([[p2.x + p2.w, p2.y], [p2.x + p2.w + r2, p2.y], [p1.x + p1.w + r1, p1.y], [p1.x + p1.w, p1.y]], rumble);
    polygon([[p2.x - p2.w, p2.y], [p2.x + p2.w, p2.y], [p1.x + p1.w, p1.y], [p1.x - p1.w, p1.y]], road);
    if (seg.color) {
      for (let lane = 1; lane < LANES; lane++) {
        const laneW1 = p1.w * 2 / LANES;
        const laneW2 = p2.w * 2 / LANES;
        const x1 = p1.x - p1.w + laneW1 * lane;
        const x2 = p2.x - p2.w + laneW2 * lane;
        const mark1 = Math.max(1, p1.w / 70);
        const mark2 = Math.max(1, p2.w / 70);
        polygon([[x2 - mark2, p2.y], [x2 + mark2, p2.y], [x1 + mark1, p1.y], [x1 - mark1, p1.y]], COLORS.lane);
      }
    }
  }

  function drawBackground(track) {
    ctx.fillStyle = track.scenery === 'night' ? '#12203f' : COLORS.sky;
    ctx.fillRect(0, 0, W, GAME_H);
    drawClouds();
    if (track.scenery === 'city') drawCity();
    else if (track.scenery === 'mountain') drawMountains();
    else if (track.scenery === 'coast') drawCoast();
    else drawClassicHorizon();
    // дальнее поле
    ctx.fillStyle = '#21d33b';
    ctx.fillRect(0, 124, W, GAME_H - 124);
    ctx.fillStyle = '#17b735';
    for (let y = 128; y < GAME_H; y += 6) ctx.fillRect(0, y, W, 2);
  }

  function drawClouds() {
    ctx.fillStyle = '#fff';
    const shift = Math.floor((state.position * .012) % 96);
    const clouds = [[35,24,20],[102,34,13],[180,18,16],[278,28,22],[390,20,14],[442,34,18]];
    for (const [x0, y, s] of clouds) {
      let x = (x0 - shift + W + 40) % (W + 60) - 30;
      ctx.fillRect(x, y + 8, s * 2, 3);
      ctx.fillRect(x + 5, y + 4, s, 4);
      ctx.fillRect(x + 14, y, s * .9, 4);
      ctx.fillRect(x + 25, y + 5, s, 4);
    }
  }

  function drawCity() {
    const base = 122;
    const shift = Math.floor((state.position * .018) % 80);
    const buildings = [18, 28, 45, 24, 38, 32, 50, 27, 42, 34, 26, 49, 31, 36, 22];
    let x = -shift;
    for (let i = 0; i < buildings.length + 4; i++) {
      const h = buildings[i % buildings.length];
      const w = 18 + (i % 3) * 8;
      ctx.fillStyle = i % 4 === 0 ? '#111925' : '#e9f0f6';
      ctx.fillRect(x, base - h, w, h);
      ctx.fillStyle = i % 4 === 0 ? '#dbe8f4' : '#8db9dc';
      for (let wx = x + 4; wx < x + w - 3; wx += 6) {
        for (let wy = base - h + 6; wy < base - 4; wy += 8) ctx.fillRect(wx, wy, 2, 2);
      }
      x += w + 4;
    }
  }

  function drawMountains() {
    const base = 124;
    const shift = Math.floor((state.position * .010) % 140);
    ctx.fillStyle = '#1d4a51';
    for (let x = -shift - 60; x < W + 120; x += 78) polygon([[x, base], [x + 40, 68], [x + 82, base]], '#1d4a51');
    for (let x = -shift - 28; x < W + 120; x += 78) polygon([[x, base], [x + 24, 78], [x + 54, base]], '#5d887d');
  }

  function drawCoast() {
    const base = 120;
    ctx.fillStyle = '#3ea2d8';
    ctx.fillRect(0, base, W, 9);
    ctx.fillStyle = '#fff0a8';
    ctx.fillRect(0, base + 9, W, 5);
    ctx.fillStyle = '#0f9f42';
    for (let x = 0; x < W; x += 52) {
      ctx.fillRect(x + 20, base - 18, 3, 18);
      polygon([[x + 21, base - 18], [x + 5, base - 4], [x + 24, base - 12]], '#0b7a35');
      polygon([[x + 21, base - 18], [x + 40, base - 5], [x + 22, base - 12]], '#0b7a35');
    }
  }

  function drawClassicHorizon() {
    const base = 124;
    ctx.fillStyle = '#0b9928';
    for (let x = 0; x < W; x += 32) {
      ctx.fillRect(x, base - 8 - (x % 3) * 2, 22, 8 + (x % 3) * 2);
      ctx.fillRect(x + 8, base - 13, 18, 13);
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(58, base - 26, 10, 26);
    ctx.fillRect(72, base - 16, 12, 16);
  }

  function drawVisibleWorld() {
    const track = byId(TRACKS, state.selectedTrack);
    drawBackground(track);
    const baseSegment = findSegment(state.position);
    const basePercent = percentRemaining(state.position, SEGMENT_LENGTH);
    const playerY = lerp(baseSegment.p1.world.y, baseSegment.p2.world.y, basePercent);
    let x = 0;
    let dx = -baseSegment.curve * basePercent;
    const visible = [];

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const seg = state.segments[(baseSegment.index + n) % state.segments.length];
      const looped = seg.index < baseSegment.index;
      project(seg.p1, state.playerX * ROAD_WIDTH - x, playerY + CAMERA_HEIGHT, state.position, looped);
      project(seg.p2, state.playerX * ROAD_WIDTH - x - dx, playerY + CAMERA_HEIGHT, state.position, looped);
      x += dx;
      dx += seg.curve;
      if (seg.p1.camera.z <= 1 || seg.p2.screen.y > GAME_H + 180 || seg.p2.screen.y < -80) continue;
      visible.push(seg);
    }

    for (let i = visible.length - 1; i >= 0; i--) drawSegment(visible[i]);
    drawRoadside(visible);
    drawObjects(visible);
    drawPlayerCar();
    if (state.flash > 0) {
      ctx.globalAlpha = Math.min(.55, state.flash * 2);
      ctx.fillStyle = state.flash > .35 ? '#ff2828' : '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    drawHud();
    if (state.countdown > 0 && state.running) drawCountdown();
  }

  function drawRoadside(visible) {
    for (let i = visible.length - 8; i >= 0; i -= 9) {
      const seg = visible[i];
      if (!seg) continue;
      const p = seg.p1.screen;
      const side = (seg.index % 2) ? -1 : 1;
      const scale = seg.p1.screen.scale * 1500;
      const x = p.x + side * (p.w + 16 * scale + Math.max(18, p.w * .22));
      if (scale < .35 || scale > 8) continue;
      drawBillboard(x, p.y, scale, seg.index);
    }
  }

  function drawBillboard(x, y, s, idx) {
    s = clamp(s, .55, 6.5);
    const w = 8 * s, h = 12 * s;
    ctx.fillStyle = idx % 3 === 0 ? '#151515' : '#34444b';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = idx % 3 === 0 ? '#ffcf33' : '#f2f2f2';
    ctx.fillRect(x - w / 2 + s, y - h + s, w - 2 * s, 2 * s);
  }

  function drawObjects(visible) {
    const minZ = state.position;
    const maxZ = state.position + DRAW_DISTANCE * SEGMENT_LENGTH;
    const candidates = [];
    for (const obj of state.objects) {
      if (obj.type === 'coin' && obj.taken) continue;
      let z = obj.z;
      if (z < state.position) z += state.trackLength;
      if (z < minZ || z > maxZ) continue;
      const seg = findSegment(z % state.trackLength);
      if (!seg || !visible.includes(seg)) continue;
      const percent = percentRemaining(z, SEGMENT_LENGTH);
      const p1 = seg.p1.screen, p2 = seg.p2.screen;
      const sx = lerp(p1.x, p2.x, percent) + lerp(p1.w, p2.w, percent) * obj.offset;
      const sy = lerp(p1.y, p2.y, percent);
      const sc = lerp(p1.scale, p2.scale, percent);
      candidates.push({ obj, x: sx, y: sy, scale: sc, z });
    }
    candidates.sort((a, b) => b.z - a.z);
    for (const c of candidates) {
      if (c.obj.type === 'coin') drawCoin(c.x, c.y, c.scale, c.obj.spin);
      else drawTraffic(c.x, c.y, c.scale, c.obj.color);
    }
  }

  function drawCoin(x, y, scale, spin) {
    const s = clamp(scale * 2600, 2, 18);
    ctx.fillStyle = '#8a5d00';
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s * 1.2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
    ctx.fillStyle = '#ffcf33';
    ctx.fillRect(Math.round(x - s / 2 + 1), Math.round(y - s * 1.2 + 1), Math.max(1, Math.round(s - 2)), Math.max(1, Math.round(s - 2)));
    ctx.fillStyle = '#fff27a';
    ctx.fillRect(Math.round(x - s / 4), Math.round(y - s * 1.08), Math.max(1, Math.round(s / 3)), Math.max(1, Math.round(s / 6)));
  }

  function drawTraffic(x, y, scale, color) {
    const s = clamp(scale * 3600, 3, 32);
    ctx.fillStyle = '#050505';
    ctx.fillRect(Math.round(x - s * .58), Math.round(y - s * .28), Math.round(s * .28), Math.round(s * .25));
    ctx.fillRect(Math.round(x + s * .30), Math.round(y - s * .28), Math.round(s * .28), Math.round(s * .25));
    ctx.fillStyle = color;
    polygon([[x - s * .55, y - s * .22], [x - s * .30, y - s * .62], [x + s * .30, y - s * .62], [x + s * .55, y - s * .22], [x + s * .45, y], [x - s * .45, y]], color);
    ctx.fillStyle = '#0f1a22';
    ctx.fillRect(Math.round(x - s * .24), Math.round(y - s * .56), Math.round(s * .48), Math.round(s * .22));
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.round(x - s * .44), Math.round(y - s * .18), Math.max(1, Math.round(s * .13)), Math.max(1, Math.round(s * .05)));
    ctx.fillRect(Math.round(x + s * .30), Math.round(y - s * .18), Math.max(1, Math.round(s * .13)), Math.max(1, Math.round(s * .05)));
  }

  function drawPlayerCar() {
    const car = byId(CARS, state.selectedCar);
    const x = W / 2 + state.playerX * 42;
    const y = GAME_H - 12;
    const lean = state.carLean;
    const w = 48;
    const h = 26;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(lean * .10);
    // тень
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(-w / 2 - 1, -5, w + 2, 8);
    // колеса
    ctx.fillStyle = '#050505';
    ctx.fillRect(-24, -16, 9, 22);
    ctx.fillRect(15, -16, 9, 22);
    ctx.fillRect(-20, -21, 8, 8);
    ctx.fillRect(12, -21, 8, 8);
    // кузов
    ctx.fillStyle = car.color;
    polygon([[-22, -5], [-16, -20], [16, -20], [23, -5], [21, 4], [-21, 4]], car.color);
    ctx.fillStyle = '#101820';
    ctx.fillRect(-12, -18, 24, 8);
    ctx.fillStyle = '#e8f5ff';
    ctx.fillRect(-18, -4, 9, 3);
    ctx.fillRect(9, -4, 9, 3);
    ctx.fillStyle = '#111';
    ctx.fillRect(-9, 2, 18, 4);
    ctx.restore();
  }

  function text(txt, x, y, size = 8, color = '#fff', align = 'left') {
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(txt, x, y);
  }

  function drawHud() {
    const y0 = GAME_H;
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, y0, W, HUD_H);
    ctx.globalAlpha = .18;
    ctx.fillStyle = '#1d2d38';
    for (let y = y0 + 4; y < H; y += 8) ctx.fillRect(0, y, W, 4);
    ctx.globalAlpha = 1;

    const car = byId(CARS, state.selectedCar);
    const speed = Math.round(state.speed);
    const rpm = clamp(state.speed / Math.max(1, car.max), 0, 1);
    const gear = speed < 15 ? 1 : Math.min(6, Math.floor(speed / 54) + 1);

    text('SPEED', 5, y0 + 8, 7);
    text(String(speed).padStart(3, '0'), 5, y0 + 24, 16, '#ff3e34');
    text('km/h', 42, y0 + 32, 7);
    text('GEAR', 5, y0 + 45, 7);
    text(String(gear), 34, y0 + 44, 12, '#ff3e34');

    // damage bar
    text('DAMAGE', 64, y0 + 45, 7);
    ctx.strokeStyle = '#cbd5df';
    ctx.strokeRect(104, y0 + 46, 82, 5);
    ctx.fillStyle = state.damage > 70 ? '#ff3e34' : '#e13d30';
    ctx.fillRect(105, y0 + 47, Math.round(80 * clamp(state.damage / 100, 0, 1)), 3);

    drawTachometer(245, y0 + 32, 30, rpm, 'TACH');
    drawTachometer(382, y0 + 32, 33, rpm, 'MPH/KMH');

    text('LAP', 206, y0 + 9, 7);
    text(`${Math.min(state.lap, state.laps)}/${state.laps}`, 235, y0 + 8, 11, '#40ff75');
    text('TIME', 206, y0 + 25, 7);
    text(formatTime(state.raceTime), 235, y0 + 24, 10, '#ff3e34');
    text('COINS', 206, y0 + 42, 7);
    text(String(state.raceCoins), 235, y0 + 41, 10, COLORS.yellow);

    // turn indicators
    text('TURN', 305, y0 + 20, 6);
    const seg = findSegment(state.position);
    const turn = seg.curve;
    drawArrow(297, y0 + 38, -1, input.left || turn < -.55);
    drawArrow(327, y0 + 38, 1, input.right || turn > .55);

    // distance / odometer
    text('DISTANCE', 350, y0 + 8, 7);
    ctx.strokeStyle = '#d6d6d6';
    ctx.strokeRect(350, y0 + 18, 120, 4);
    ctx.fillStyle = '#d73522';
    ctx.fillRect(351, y0 + 19, Math.round(118 * ((state.lap - 1) * state.trackLength + state.position) / (state.trackLength * state.laps)), 2);
    text(`${Math.round(state.position)} m`, 350, y0 + 28, 7);
    text('ODOMETER', 350, y0 + 42, 7);
    text(`${state.odometer.toFixed(2)} km`, 404, y0 + 40, 8, COLORS.yellow);

    drawMiniMap(444, y0 + 10, 32, 42);
  }

  function drawTachometer(cx, cy, r, v, label) {
    text(label, cx - r, cy - r - 9, 6);
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * .78, Math.PI * 2.20);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (.78 + (2.20 - .78) * i / 8);
      ctx.strokeStyle = i > 6 ? '#ff3e34' : '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    const a = Math.PI * (.78 + (2.20 - .78) * clamp(v, 0, 1));
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.lineWidth = 1;
  }

  function drawArrow(x, y, dir, active) {
    ctx.fillStyle = active ? COLORS.yellow : '#4b4b4b';
    if (dir < 0) polygon([[x, y], [x + 12, y - 8], [x + 12, y + 8]], ctx.fillStyle);
    else polygon([[x, y - 8], [x + 12, y], [x, y + 8]], ctx.fillStyle);
  }

  function drawMiniMap(x, y, w, h) {
    ctx.fillStyle = '#082010';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.strokeStyle = '#cfd8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < state.map.length; i++) {
      const p = state.map[i];
      const px = x + p.x * w;
      const py = y + p.y * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    const idx = Math.floor(state.position / SEGMENT_LENGTH) % Math.max(1, state.map.length);
    const me = state.map[idx] || { x: 0, y: 0 };
    ctx.fillStyle = '#ff3e34';
    ctx.fillRect(x + me.x * w - 2, y + me.y * h - 2, 4, 4);
  }

  function drawCountdown() {
    const n = Math.ceil(state.countdown);
    const label = n > 0 ? String(n) : 'GO!';
    text(label, W / 2, 70, 40, state.countdown < .7 ? '#40ff75' : '#ffcf33', 'center');
  }

  function frame(now) {
    const dt = Math.min(.05, (now - state.lastFrame) / 1000 || 0);
    state.lastFrame = now;
    update(dt);
    drawVisibleWorld();
    if (state.running || document.getElementById('menu').classList.contains('open')) requestAnimationFrame(frame);
  }

  function renderMenu() {
    const wallet = document.getElementById('walletCoins');
    wallet.textContent = state.save.coins;
    state.selectedCar = state.save.selectedCar || state.selectedCar;
    state.selectedTrack = state.save.selectedTrack || state.selectedTrack;
    state.selectedDifficulty = state.save.selectedDifficulty || state.selectedDifficulty;

    const carsEl = document.getElementById('cars');
    carsEl.innerHTML = '';
    for (const car of CARS) {
      const owned = state.save.owned.includes(car.id);
      const selected = state.selectedCar === car.id;
      const card = document.createElement('article');
      card.className = `card ${selected ? 'selected' : ''} ${owned ? '' : 'locked'}`;
      card.innerHTML = `
        <h3>${car.name}</h3>
        <p>${car.desc}</p>
        ${statLine('Скорость', car.max / 350)}
        ${statLine('Разгон', car.accel / 76)}
        ${statLine('Руль', car.handling / 2.3)}
        ${statLine('Сцепление', car.grip / 1.4)}
        <button class="${owned ? '' : 'buy'}" ${(!owned && state.save.coins < car.cost) ? 'disabled' : ''}>${owned ? (selected ? 'Выбрано' : 'Выбрать') : `Купить • ${car.cost}`}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        if (!owned) {
          if (state.save.coins < car.cost) return;
          state.save.coins -= car.cost;
          state.save.owned.push(car.id);
        }
        state.selectedCar = car.id;
        state.save.selectedCar = car.id;
        saveGame();
        renderMenu();
      });
      carsEl.appendChild(card);
    }

    const tracksEl = document.getElementById('tracks');
    tracksEl.innerHTML = '';
    for (const track of TRACKS) {
      const selected = state.selectedTrack === track.id;
      const bestEasy = Object.entries(state.save.best).filter(([k]) => k.startsWith(track.id)).map(([,v]) => v).sort((a,b)=>a-b)[0];
      const card = document.createElement('article');
      card.className = `card ${selected ? 'selected' : ''}`;
      card.innerHTML = `<h3>${track.name}</h3><p>${track.desc}</p><p>Длина: <b>${track.lengthName}</b>${bestEasy ? `<br>Лучшее: <b>${formatTime(bestEasy)}</b>` : ''}</p><button>${selected ? 'Выбрано' : 'Выбрать'}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        state.selectedTrack = track.id;
        state.save.selectedTrack = track.id;
        saveGame();
        renderMenu();
      });
      tracksEl.appendChild(card);
    }

    const diffsEl = document.getElementById('difficulties');
    diffsEl.innerHTML = '';
    for (const diff of DIFFICULTIES) {
      const selected = state.selectedDifficulty === diff.id;
      const card = document.createElement('article');
      card.className = `card ${selected ? 'selected' : ''}`;
      card.innerHTML = `<h3>${diff.name}</h3><p>${diff.desc}</p><p>Множитель награды: <b>x${diff.reward}</b></p><button>${selected ? 'Выбрано' : 'Выбрать'}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        state.selectedDifficulty = diff.id;
        state.save.selectedDifficulty = diff.id;
        saveGame();
        renderMenu();
      });
      diffsEl.appendChild(card);
    }
  }

  function statLine(name, value) {
    return `<div class="stat"><span>${name}</span><span class="bar"><i style="width:${Math.round(clamp(value,0,1)*100)}%"></i></span></div>`;
  }

  function openMenu() {
    state.paused = true;
    renderMenu();
    document.getElementById('menu').classList.add('open');
    if (!state.running) requestAnimationFrame(frame);
  }

  function bindEvents() {
    const setKey = (key, value) => {
      if (['ArrowLeft', 'a', 'A', 'ф', 'Ф'].includes(key)) input.left = value;
      if (['ArrowRight', 'd', 'D', 'в', 'В'].includes(key)) input.right = value;
      if (['ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(key)) input.gas = value;
      if (['ArrowDown', 's', 'S', 'ы', 'Ы'].includes(key)) input.brake = value;
    };
    window.addEventListener('keydown', e => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','W','a','A','s','S','d','D'].includes(e.key)) e.preventDefault();
      if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') state.paused = !state.paused;
      setKey(e.key, true);
    }, { passive: false });
    window.addEventListener('keyup', e => setKey(e.key, false));

    document.getElementById('startBtn').addEventListener('click', startRace);
    document.getElementById('pauseBtn').addEventListener('click', () => { if (state.running) state.paused = !state.paused; });
    document.getElementById('menuBtn').addEventListener('click', openMenu);
    document.getElementById('finishMenu').addEventListener('click', () => {
      document.getElementById('finish').classList.remove('open');
      openMenu();
    });
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (!confirm('Сбросить монеты, покупки и рекорды?')) return;
      localStorage.removeItem(STORAGE_KEY);
      state.save = loadSave();
      renderMenu();
    });

    document.querySelectorAll('.touch-controls button').forEach(btn => {
      const name = btn.dataset.control;
      const map = { left: 'left', right: 'right', gas: 'gas', brake: 'brake' };
      const prop = map[name];
      const down = e => { e.preventDefault(); input[prop] = true; };
      const up = e => { e.preventDefault(); input[prop] = false; };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    window.addEventListener('blur', () => { input.left = input.right = input.gas = input.brake = false; });
  }

  // Boot
  state.selectedCar = state.save.selectedCar || 'starter';
  state.selectedTrack = state.save.selectedTrack || 'classic';
  state.selectedDifficulty = state.save.selectedDifficulty || 'normal';
  buildTrack(byId(TRACKS, state.selectedTrack));
  bindEvents();
  renderMenu();
  drawVisibleWorld();
})();
