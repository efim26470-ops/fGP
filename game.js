(() => {
  'use strict';

  const STORAGE_KEY = 'retroTurboGP.v1';
  const SEGMENT_LENGTH = 80;
  const DRAW_DISTANCE = 165;
  const CAMERA_HEIGHT = 1050;
  const CAMERA_DEPTH = 0.82;
  const ROAD_WIDTH = 2100;
  const TWO_PI = Math.PI * 2;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const $ = (id) => document.getElementById(id);
  const menu = $('menu');
  const garagePanel = $('garagePanel');
  const messagePanel = $('messagePanel');
  const iosInfo = $('iosInfo');
  const raceOverlay = $('raceOverlay');

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = new Intl.NumberFormat('ru-RU');

  const CARS = [
    {
      id: 'starter', name: 'Hatch 86', price: 0, color: '#14d9ff', secondary: '#063746',
      desc: 'Бесплатная машина. Предсказуемая, но не очень быстрая.',
      maxSpeed: 205, accel: 78, brake: 138, handling: 1.28, grip: .94, stability: .85, mass: .92
    },
    {
      id: 'compact', name: 'Swift Kei', price: 650, color: '#ffd33d', secondary: '#5b3c00',
      desc: 'Лёгкая и резкая. Отлично проходит связки поворотов.',
      maxSpeed: 225, accel: 92, brake: 146, handling: 1.62, grip: 1.08, stability: .72, mass: .72
    },
    {
      id: 'muscle', name: 'V8 Brick', price: 1450, color: '#ff364d', secondary: '#52111a',
      desc: 'Много мощности на прямых, но требует аккуратности.',
      maxSpeed: 255, accel: 106, brake: 124, handling: 1.05, grip: .82, stability: 1.02, mass: 1.28
    },
    {
      id: 'rally', name: 'Rally Fox', price: 2300, color: '#ffffff', secondary: '#2449ff',
      desc: 'Хорошее сцепление на снегу, гравии и узких трассах.',
      maxSpeed: 245, accel: 98, brake: 154, handling: 1.45, grip: 1.22, stability: .96, mass: .96
    },
    {
      id: 'turbo', name: 'Turbo XR', price: 3800, color: '#9a4dff', secondary: '#21103a',
      desc: 'Сильный турбо‑разгон, высокая максималка и средняя устойчивость.',
      maxSpeed: 292, accel: 128, brake: 145, handling: 1.22, grip: .98, stability: .82, mass: 1.02
    },
    {
      id: 'prototype', name: 'Vector One', price: 7200, color: '#30f07e', secondary: '#063820',
      desc: 'Топовый прототип: быстрый, цепкий и дорогой.',
      maxSpeed: 330, accel: 145, brake: 170, handling: 1.58, grip: 1.35, stability: 1.12, mass: .88
    }
  ];

  const TRACKS = [
    {
      id: 'city', name: 'Metro Straight', tag: 'город',
      desc: 'Широкий проспект, длинные прямые, резкие шиканы перед финишем.',
      laps: 2, roadWidth: 1.08, grip: 1.0, coinRate: 1.12, trafficRate: .9,
      sky: '#55a9ff', grass: '#43e833', road: '#868686', rumbleA: '#f2f2f2', rumbleB: '#b72c1c',
      scenery: 'city', pattern: [
        [34, 0], [12, .38], [18, 0], [10, -.48], [28, 0], [10, -.72], [12, .72], [25, 0], [16, .28], [20, 0], [12, -.34], [28, 0]
      ]
    },
    {
      id: 'green', name: 'Green Loop', tag: 'классика',
      desc: 'Сбалансированная кольцевая трасса: прямые, средние повороты и много монет.',
      laps: 3, roadWidth: 1.0, grip: 1.05, coinRate: 1.3, trafficRate: .72,
      sky: '#5aa8ff', grass: '#19c51f', road: '#737373', rumbleA: '#f4f4f4', rumbleB: '#222',
      scenery: 'hills', pattern: [
        [18, 0], [16, .22], [12, .42], [18, .1], [20, 0], [14, -.38], [12, -.55], [22, 0], [16, .42], [16, 0], [20, -.24], [16, 0]
      ]
    },
    {
      id: 'mountain', name: 'Mountain Pass', tag: 'серпантин',
      desc: 'Узкая дорога, много поворотов и меньше места для ошибок.',
      laps: 2, roadWidth: .82, grip: .95, coinRate: .95, trafficRate: .82,
      sky: '#6fb4ff', grass: '#1b9e47', road: '#686a70', rumbleA: '#e8e8e8', rumbleB: '#a22618',
      scenery: 'mountain', pattern: [
        [12, 0], [10, .62], [18, .92], [8, -.45], [12, -1.05], [10, -.82], [12, .58], [10, .95], [14, 0], [12, -.7], [12, .72], [8, 0]
      ]
    },
    {
      id: 'desert', name: 'Sunset Run', tag: 'скорость',
      desc: 'Длинные прямые, высокая скорость, редкие, но опасные дуги.',
      laps: 2, roadWidth: 1.02, grip: .91, coinRate: 1.05, trafficRate: 1.05,
      sky: '#ff9a46', grass: '#d5a14c', road: '#7b706a', rumbleA: '#fff2cf', rumbleB: '#c04e22',
      scenery: 'desert', pattern: [
        [42, 0], [20, .18], [38, 0], [12, -.38], [18, -.18], [44, 0], [18, .55], [14, 0], [22, -.32], [34, 0]
      ]
    },
    {
      id: 'snow', name: 'Ice Ring', tag: 'скользко',
      desc: 'Снег, длинные заносы и скользкое покрытие. Rally Fox раскрывается здесь.',
      laps: 2, roadWidth: .94, grip: .75, coinRate: 1.25, trafficRate: .65,
      sky: '#a7d7ff', grass: '#d9f4ff', road: '#8a98a8', rumbleA: '#ffffff', rumbleB: '#3a93d8',
      scenery: 'snow', pattern: [
        [18, 0], [22, .52], [16, .35], [16, 0], [20, -.62], [20, -.35], [14, 0], [18, .74], [16, 0], [22, -.44], [18, 0]
      ]
    }
  ];

  const DIFFICULTIES = [
    { id: 'easy', name: 'Лёгкая', desc: 'Меньше трафика, больше времени на реакцию.', reward: 1, traffic: .7, damage: .72, aiSpeed: .82, coin: 1 },
    { id: 'normal', name: 'Нормальная', desc: 'Базовый баланс скорости, трафика и наград.', reward: 1.35, traffic: 1, damage: 1, aiSpeed: 1, coin: 1.15 },
    { id: 'hard', name: 'Сложная', desc: 'Больше машин, сильнее штрафы, выше награда.', reward: 2, traffic: 1.45, damage: 1.45, aiSpeed: 1.14, coin: 1.35 }
  ];

  const state = {
    mode: 'menu',
    width: 1280,
    height: 720,
    pixelRatio: 1,
    keys: Object.create(null),
    touch: { left: false, right: false, gas: false, brake: false },
    now: 0,
    last: 0,
    selectedCar: 'starter',
    selectedTrack: 'city',
    selectedDifficulty: 'normal',
    progress: loadProgress(),
    trackCache: new Map(),
    race: null,
    idleRoadOffset: 0,
    savingDistance: 0
  };

  function defaultProgress() {
    return {
      coins: 350,
      purchased: ['starter'],
      selectedCar: 'starter',
      selectedTrack: 'city',
      selectedDifficulty: 'normal',
      totalOdometer: 0,
      best: {},
      version: 1
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const base = defaultProgress();
      return {
        ...base,
        ...parsed,
        purchased: Array.from(new Set([...(parsed.purchased || []), 'starter']))
      };
    } catch (err) {
      console.warn('Save read failed', err);
      return defaultProgress();
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function setMode(mode) {
    state.mode = mode;
    menu.classList.toggle('active', mode === 'menu');
    raceOverlay.classList.toggle('hidden', mode !== 'race' && mode !== 'pause');
    messagePanel.classList.remove('active');
  }

  function getCar(id = state.selectedCar) { return CARS.find(c => c.id === id) || CARS[0]; }
  function getTrack(id = state.selectedTrack) { return TRACKS.find(t => t.id === id) || TRACKS[0]; }
  function getDifficulty(id = state.selectedDifficulty) { return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1]; }
  function isPurchased(carId) { return state.progress.purchased.includes(carId); }

  function makePixelCarSVG(car, tiny = false) {
    const c = car.color;
    const s = car.secondary;
    const w = tiny ? 92 : 116;
    const h = tiny ? 38 : 44;
    return `
      <svg class="car-pixel" viewBox="0 0 116 44" width="${w}" height="${h}" aria-hidden="true">
        <rect x="13" y="24" width="90" height="13" fill="#07090f"/>
        <rect x="21" y="14" width="74" height="19" fill="${c}"/>
        <rect x="32" y="7" width="52" height="16" fill="${c}"/>
        <rect x="39" y="10" width="14" height="9" fill="#111927"/>
        <rect x="62" y="10" width="14" height="9" fill="#111927"/>
        <rect x="23" y="28" width="16" height="6" fill="${s}"/>
        <rect x="76" y="28" width="16" height="6" fill="${s}"/>
        <rect x="14" y="27" width="9" height="6" fill="#fff7b0"/>
        <rect x="94" y="27" width="9" height="6" fill="#ff5b3d"/>
        <rect x="24" y="34" width="17" height="7" fill="#050505"/>
        <rect x="75" y="34" width="17" height="7" fill="#050505"/>
      </svg>`;
  }

  function statBar(label, value, max) {
    const pct = clamp(value / max, 0, 1) * 100;
    return `<div class="stat-row"><span>${label}</span><span class="stat-bar"><i style="width:${pct}%"></i></span></div>`;
  }

  function renderMenu() {
    state.selectedCar = state.progress.selectedCar || state.selectedCar;
    state.selectedTrack = state.progress.selectedTrack || state.selectedTrack;
    state.selectedDifficulty = state.progress.selectedDifficulty || state.selectedDifficulty;
    $('coinBalance').textContent = fmt.format(Math.floor(state.progress.coins));

    $('carGrid').innerHTML = CARS.map(car => {
      const locked = !isPurchased(car.id);
      const selected = state.selectedCar === car.id;
      return `<article class="car-card ${selected ? 'selected' : ''}" data-car="${car.id}">
        ${makePixelCarSVG(car, true)}
        <h3>${car.name}</h3>
        <p class="lead small">${car.desc}</p>
        <div class="card-meta">
          <span class="badge">${car.maxSpeed} км/ч</span>
          <span class="badge ${locked ? 'locked' : 'good'}">${locked ? `${fmt.format(car.price)} монет` : 'куплено'}</span>
        </div>
      </article>`;
    }).join('');

    $('trackGrid').innerHTML = TRACKS.map(track => {
      const selected = state.selectedTrack === track.id;
      const best = state.progress.best[track.id];
      return `<article class="track-card ${selected ? 'selected' : ''}" data-track="${track.id}">
        <h3>${track.name}</h3>
        <p class="lead small">${track.desc}</p>
        <div class="card-meta">
          <span class="badge">${track.tag}</span>
          <span class="badge">${track.laps} круг.</span>
          ${best ? `<span class="badge good">рекорд ${formatTime(best)}</span>` : ''}
        </div>
      </article>`;
    }).join('');

    $('difficultyGrid').innerHTML = DIFFICULTIES.map(diff => {
      const selected = state.selectedDifficulty === diff.id;
      return `<article class="difficulty-item ${selected ? 'selected' : ''}" data-difficulty="${diff.id}">
        <h3>${diff.name}</h3>
        <p class="lead small">${diff.desc}</p>
        <span class="badge">x${diff.reward} награда</span>
      </article>`;
    }).join('');

    bindMenuCards();
    renderGarage();
  }

  function renderGarage() {
    $('garageGrid').innerHTML = CARS.map(car => {
      const owned = isPurchased(car.id);
      const affordable = state.progress.coins >= car.price;
      const selected = state.selectedCar === car.id;
      return `<article class="garage-item">
        ${makePixelCarSVG(car)}
        <h3>${car.name}</h3>
        <p class="lead small">${car.desc}</p>
        ${statBar('Скорость', car.maxSpeed, 330)}
        ${statBar('Разгон', car.accel, 145)}
        ${statBar('Тормоза', car.brake, 170)}
        ${statBar('Руль', car.handling, 1.7)}
        ${statBar('Сцепление', car.grip, 1.35)}
        <div class="garage-actions">
          ${owned ? `<button class="${selected ? 'ghost-btn' : 'primary-btn'}" data-select-car="${car.id}">${selected ? 'Выбрана' : 'Выбрать'}</button>` : `<button class="primary-btn" data-buy-car="${car.id}" ${affordable ? '' : 'disabled'}>Купить за ${fmt.format(car.price)}</button>`}
        </div>
      </article>`;
    }).join('');

    document.querySelectorAll('[data-buy-car]').forEach(btn => btn.addEventListener('click', () => buyCar(btn.dataset.buyCar)));
    document.querySelectorAll('[data-select-car]').forEach(btn => btn.addEventListener('click', () => selectCar(btn.dataset.selectCar)));
  }

  function bindMenuCards() {
    document.querySelectorAll('[data-car]').forEach(card => card.addEventListener('click', () => selectCar(card.dataset.car)));
    document.querySelectorAll('[data-track]').forEach(card => card.addEventListener('click', () => selectTrack(card.dataset.track)));
    document.querySelectorAll('[data-difficulty]').forEach(card => card.addEventListener('click', () => selectDifficulty(card.dataset.difficulty)));
  }

  function selectCar(carId) {
    if (!isPurchased(carId)) {
      garagePanel.classList.add('active');
      renderGarage();
      return;
    }
    state.selectedCar = carId;
    state.progress.selectedCar = carId;
    saveProgress();
    renderMenu();
  }

  function buyCar(carId) {
    const car = getCar(carId);
    if (isPurchased(car.id) || state.progress.coins < car.price) return;
    state.progress.coins -= car.price;
    state.progress.purchased.push(car.id);
    state.progress.selectedCar = car.id;
    state.selectedCar = car.id;
    saveProgress();
    renderMenu();
  }

  function selectTrack(trackId) {
    state.selectedTrack = trackId;
    state.progress.selectedTrack = trackId;
    saveProgress();
    renderMenu();
  }

  function selectDifficulty(diffId) {
    state.selectedDifficulty = diffId;
    state.progress.selectedDifficulty = diffId;
    saveProgress();
    renderMenu();
  }

  function buildTrack(track) {
    if (state.trackCache.has(track.id)) return state.trackCache.get(track.id);
    const segments = [];
    const coinEvery = Math.max(5, Math.round(9 / track.coinRate));
    let index = 0;

    function add(length, curve, roadWidth = track.roadWidth) {
      const easeIn = Math.max(4, Math.floor(length * .22));
      const easeOut = Math.max(4, Math.floor(length * .22));
      for (let i = 0; i < length; i++) {
        let t = 1;
        if (i < easeIn) t = i / easeIn;
        if (i > length - easeOut) t = Math.min(t, (length - i) / easeOut);
        const eased = curve * Math.sin(t * Math.PI / 2);
        const zebra = index % 2 === 0;
        segments.push({
          index,
          curve: eased,
          roadWidth: ROAD_WIDTH * roadWidth,
          colorShift: index % 2,
          coin: null,
          traffic: [],
          zebra,
          yHill: Math.sin(index * .045) * 12
        });
        index += 1;
      }
    }

    for (const part of track.pattern) add(part[0], part[1]);
    while (segments.length < 180) for (const part of track.pattern) add(part[0], part[1]);

    const totalLength = segments.length * SEGMENT_LENGTH;
    const rng = mulberry32(hashString(track.id));
    for (let i = 8; i < segments.length - 8; i += coinEvery) {
      if (rng() > .15) {
        segments[i].coin = {
          x: clamp((rng() * 2 - 1) * .72, -.78, .78),
          value: rng() > .88 ? 35 : rng() > .55 ? 18 : 10,
          taken: false,
          pulse: rng() * TWO_PI
        };
      }
    }

    const trafficCount = Math.round(segments.length * .045 * track.trafficRate);
    for (let i = 0; i < trafficCount; i++) {
      const segIndex = Math.floor(lerp(20, segments.length - 20, rng()));
      const lane = [-.56, -.22, .22, .56][Math.floor(rng() * 4)] + (rng() * .08 - .04);
      segments[segIndex].traffic.push({
        x: lane,
        speed: lerp(80, 175, rng()),
        color: ['#ff3448', '#ffd33d', '#14d9ff', '#f4f7ff', '#9a4dff'][Math.floor(rng() * 5)],
        passed: false,
        hitCooldown: 0
      });
    }

    const map = buildMiniMap(segments);
    const result = { segments, totalLength, map };
    state.trackCache.set(track.id, result);
    return result;
  }

  function startRace() {
    const car = getCar();
    const track = getTrack();
    const diff = getDifficulty();
    const built = buildTrack(track);
    // reset collectible state per run
    for (const seg of built.segments) {
      if (seg.coin) seg.coin.taken = false;
      for (const traffic of seg.traffic) {
        traffic.passed = false;
        traffic.hitCooldown = 0;
      }
    }
    state.race = {
      car, track, diff,
      built,
      pos: 0,
      lap: 1,
      lapTarget: track.laps,
      speed: 0,
      playerX: 0,
      steeringInertia: 0,
      damage: 0,
      coins: 0,
      raceDistance: 0,
      lastDistanceSave: 0,
      elapsed: 0,
      lapTime: 0,
      finished: false,
      pausedAt: 0,
      gear: 1,
      rpm: 900,
      indicatorPhase: 0,
      boostHeat: 0,
      combo: 1,
      lastCoinTime: -99,
      totalRaceLength: built.totalLength * track.laps
    };
    setMode('race');
  }

  function endRace(type) {
    const race = state.race;
    if (!race || race.finished) return;
    race.finished = true;
    setMode('result');

    const trackKey = race.track.id;
    let title = 'Финиш!';
    let kicker = 'Гонка завершена';
    let text = '';
    const cleanBonus = Math.max(0, Math.round((100 - race.damage) * race.diff.reward));
    const finishBonus = type === 'win' ? Math.round(250 * race.diff.reward * race.track.laps) : 0;
    const totalReward = cleanBonus + finishBonus;
    state.progress.coins += totalReward;

    if (type === 'win') {
      if (!state.progress.best[trackKey] || race.elapsed < state.progress.best[trackKey]) {
        state.progress.best[trackKey] = race.elapsed;
        kicker = 'Новый рекорд трассы';
      }
      title = 'You won';
      text = `Время: ${formatTime(race.elapsed)}. Монеты с дороги: ${fmt.format(race.coins)}, бонус: ${fmt.format(totalReward)}.`;
    } else {
      title = 'Game over';
      kicker = 'Машина разбита';
      text = `Дистанция: ${Math.floor(race.raceDistance)} м. Монеты с дороги: ${fmt.format(race.coins)}, бонус за попытку: ${fmt.format(totalReward)}.`;
    }

    saveProgress();
    $('messageKicker').textContent = kicker;
    $('messageTitle').textContent = title;
    $('messageText').textContent = text;
    messagePanel.classList.add('active');
    renderMenu();
  }

  function updateRace(dt) {
    const race = state.race;
    if (!race || race.finished || state.mode !== 'race') return;
    const car = race.car;
    const track = race.track;
    const diff = race.diff;
    const built = race.built;
    const currentSegment = getSegmentAt(race.pos);
    const grip = car.grip * track.grip;
    const curveForce = currentSegment.curve * (race.speed / car.maxSpeed) * (1.45 / Math.max(.55, grip));

    const left = input('left');
    const right = input('right');
    const gas = input('gas');
    const brake = input('brake');
    const steer = (right ? 1 : 0) - (left ? 1 : 0);

    if (gas) race.speed += car.accel * dt;
    else race.speed -= (18 + race.speed * .018) * dt;
    if (brake) race.speed -= car.brake * dt;

    race.speed = clamp(race.speed, 0, car.maxSpeed);

    const offRoad = Math.abs(race.playerX) > .99;
    if (offRoad) {
      race.speed -= (28 + race.speed * .18) * dt * (1.2 - Math.min(.4, grip - .7));
      if (race.speed > 120) race.damage += dt * 1.2 * diff.damage;
    }

    race.steeringInertia = lerp(race.steeringInertia, steer, clamp(dt * (7.5 / car.mass), 0, 1));
    const steerPower = (race.speed / car.maxSpeed) * car.handling * (offRoad ? .48 : 1);
    race.playerX += race.steeringInertia * steerPower * dt * 1.55;
    race.playerX -= curveForce * dt;
    race.playerX = clamp(race.playerX, -1.65, 1.65);

    const meters = (race.speed / 3.6) * dt;
    race.pos += meters;
    race.raceDistance += meters;
    race.elapsed += dt;
    race.lapTime += dt;
    race.indicatorPhase += dt;

    // Update local odometer without waiting for finish.
    race.lastDistanceSave += meters;
    if (race.lastDistanceSave > 90) {
      state.progress.totalOdometer += race.lastDistanceSave;
      race.lastDistanceSave = 0;
      saveProgress();
    }

    if (race.pos >= built.totalLength) {
      race.pos -= built.totalLength;
      race.lap += 1;
      race.lapTime = 0;
      for (const seg of built.segments) if (seg.coin) seg.coin.taken = false;
      if (race.lap > race.lapTarget) {
        state.progress.totalOdometer += race.lastDistanceSave;
        race.lastDistanceSave = 0;
        endRace('win');
        return;
      }
    }

    updateTraffic(dt);
    checkCoins();
    checkCollisions(dt);
    updateGearAndRpm(dt);

    if (race.damage >= 100) {
      race.damage = 100;
      state.progress.totalOdometer += race.lastDistanceSave;
      race.lastDistanceSave = 0;
      endRace('lose');
    }
  }

  function input(kind) {
    if (kind === 'left') return state.keys.ArrowLeft || state.keys.KeyA || state.touch.left;
    if (kind === 'right') return state.keys.ArrowRight || state.keys.KeyD || state.touch.right;
    if (kind === 'gas') return state.keys.ArrowUp || state.keys.KeyW || state.touch.gas;
    if (kind === 'brake') return state.keys.ArrowDown || state.keys.KeyS || state.touch.brake;
    return false;
  }

  function getSegmentAt(pos) {
    const race = state.race;
    const built = race ? race.built : buildTrack(getTrack());
    const i = Math.floor(pos / SEGMENT_LENGTH) % built.segments.length;
    return built.segments[i];
  }

  function updateTraffic(dt) {
    const race = state.race;
    const built = race.built;
    const diff = race.diff;
    const moved = [];
    for (const seg of built.segments) {
      for (let i = seg.traffic.length - 1; i >= 0; i--) {
        const car = seg.traffic[i];
        car.hitCooldown = Math.max(0, car.hitCooldown - dt);
        if (race.speed < 15) continue;
        const relSpeed = Math.max(0, race.speed - car.speed * diff.aiSpeed);
        if (relSpeed < 8) continue;
        // Cars slowly move backward relative to the player by being transferred to previous segments.
        car._move = (car._move || 0) + (relSpeed / 3.6) * dt;
        while (car._move > SEGMENT_LENGTH) {
          car._move -= SEGMENT_LENGTH;
          seg.traffic.splice(i, 1);
          const nextIndex = (seg.index - 1 + built.segments.length) % built.segments.length;
          built.segments[nextIndex].traffic.push(car);
          moved.push(car);
          break;
        }
      }
    }
    void moved;
  }

  function checkCoins() {
    const race = state.race;
    const segIndex = Math.floor(race.pos / SEGMENT_LENGTH) % race.built.segments.length;
    const now = race.elapsed;
    for (let n = -1; n <= 2; n++) {
      const seg = race.built.segments[(segIndex + n + race.built.segments.length) % race.built.segments.length];
      const coin = seg.coin;
      if (!coin || coin.taken) continue;
      const coinPos = seg.index * SEGMENT_LENGTH + SEGMENT_LENGTH * .55;
      const distance = signedTrackDistance(coinPos, race.pos, race.built.totalLength);
      if (distance > -20 && distance < 35 && Math.abs(coin.x - race.playerX) < .24) {
        coin.taken = true;
        const combo = now - race.lastCoinTime < 1.8 ? Math.min(5, race.combo + .35) : 1;
        race.combo = combo;
        race.lastCoinTime = now;
        const value = Math.round(coin.value * race.diff.coin * combo);
        race.coins += value;
        state.progress.coins += value;
        saveProgress();
      }
    }
  }

  function checkCollisions(dt) {
    const race = state.race;
    const segIndex = Math.floor(race.pos / SEGMENT_LENGTH) % race.built.segments.length;
    for (let n = 0; n <= 3; n++) {
      const seg = race.built.segments[(segIndex + n) % race.built.segments.length];
      for (const traffic of seg.traffic) {
        if (traffic.hitCooldown > 0) continue;
        const carPos = seg.index * SEGMENT_LENGTH + SEGMENT_LENGTH * .55;
        const distance = signedTrackDistance(carPos, race.pos, race.built.totalLength);
        if (distance > -12 && distance < 34 && Math.abs(traffic.x - race.playerX) < .24) {
          const hit = clamp(race.speed / 45, 1, 5.8) * race.diff.damage;
          race.damage += hit * 6;
          race.speed *= .52;
          race.playerX += (race.playerX > traffic.x ? .18 : -.18);
          traffic.hitCooldown = 3.5;
        }
      }
    }
    if (Math.abs(race.playerX) > 1.35 && race.speed > 110) {
      race.damage += dt * 4.5 * race.diff.damage;
    }
  }

  function signedTrackDistance(target, current, total) {
    let d = target - current;
    if (d < -total / 2) d += total;
    if (d > total / 2) d -= total;
    return d;
  }

  function updateGearAndRpm(dt) {
    const race = state.race;
    const car = race.car;
    const ratio = clamp(race.speed / car.maxSpeed, 0, 1);
    race.gear = clamp(Math.floor(ratio * 6) + 1, 1, 6);
    const gearBase = (ratio * 6) % 1;
    const targetRpm = 1000 + gearBase * 6800 + (input('gas') ? 700 : 0) - (input('brake') ? 350 : 0);
    race.rpm = lerp(race.rpm, clamp(targetRpm, 900, 8300), clamp(dt * 8, 0, 1));
  }

  function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ) {
    const z = Math.max(1, worldZ - cameraZ);
    const scale = CAMERA_DEPTH / z;
    return {
      scale,
      x: Math.round((1 + scale * (worldX - cameraX)) * state.width / 2),
      y: Math.round((1 - scale * (worldY - cameraY)) * state.height / 2),
      w: Math.round(scale * ROAD_WIDTH * state.width / 2)
    };
  }

  function render() {
    if (state.mode === 'race' || state.mode === 'pause' || state.mode === 'result') renderRace();
    else renderIdle();
  }

  function renderIdle() {
    const track = getTrack();
    const W = state.width, H = state.height;
    drawBackground(track, Math.sin(performance.now() * .00015) * 80);
    const yHorizon = H * .46;
    drawRoadQuad(W * .14, H, W * .86, H, W * .47, yHorizon, W * .53, yHorizon, '#777', '#f2f2f2', '#c33122', 0);
    drawPixelCar(W * .5, H * .78, 1.25, getCar().color, getCar().secondary, 0);
    drawMenuHint();
  }

  function renderRace() {
    const race = state.race;
    if (!race) return;
    const W = state.width, H = state.height;
    const track = race.track;
    const built = race.built;
    const baseIndex = Math.floor(race.pos / SEGMENT_LENGTH);
    const basePercent = (race.pos % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const cameraX = race.playerX * ROAD_WIDTH;
    const cameraY = CAMERA_HEIGHT;
    const cameraZ = basePercent * SEGMENT_LENGTH;

    const startCurve = built.segments[baseIndex % built.segments.length].curve;
    let x = 0;
    let dx = -startCurve * basePercent * 160;
    let maxY = H;
    const sprites = [];

    drawBackground(track, x);

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const seg = built.segments[(baseIndex + n) % built.segments.length];
      const next = built.segments[(baseIndex + n + 1) % built.segments.length];
      const z1 = n * SEGMENT_LENGTH;
      const z2 = (n + 1) * SEGMENT_LENGTH;
      const p1 = project(x, seg.yHill, z1, cameraX, cameraY, cameraZ);
      x += dx;
      dx += seg.curve * 145;
      const p2 = project(x, next.yHill, z2, cameraX, cameraY, cameraZ);

      if (p2.y >= maxY || p2.y < 0) continue;
      maxY = p2.y;
      const fade = n / DRAW_DISTANCE;
      const roadColor = shade(track.road, seg.colorShift ? -8 : 8);
      const grass = shade(track.grass, seg.colorShift ? -12 : 6);
      const lane = seg.colorShift ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.45)';
      const roadWidthScale = seg.roadWidth / ROAD_WIDTH;

      drawSegment(p1, p2, roadWidthScale, roadColor, grass, track.rumbleA, track.rumbleB, lane, fade, seg.index);

      if (seg.coin && !seg.coin.taken) sprites.push({ type: 'coin', seg, obj: seg.coin, p: p1, z: z1 + SEGMENT_LENGTH * .5, roadScale: roadWidthScale });
      for (const traffic of seg.traffic) sprites.push({ type: 'traffic', seg, obj: traffic, p: p1, z: z1 + SEGMENT_LENGTH * .55, roadScale: roadWidthScale });
    }

    sprites.sort((a, b) => b.z - a.z);
    for (const sprite of sprites) drawSprite(sprite);

    drawPlayerCar(race);
    drawHud(race);
    if (state.mode === 'pause') drawPauseShade();
  }

  function drawBackground(track, offset) {
    const W = state.width, H = state.height;
    ctx.fillStyle = track.sky;
    ctx.fillRect(0, 0, W, H);

    // pixel clouds
    const cloudColor = track.scenery === 'desert' ? 'rgba(255,245,210,.85)' : 'rgba(255,255,255,.92)';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 260 + (offset * .12) + 100) % (W + 360)) - 180;
      const y = 46 + (i % 3) * 38;
      drawPixelCloud(x, y, 1 + (i % 2) * .45, cloudColor);
    }

    const horizon = H * .44;
    if (track.scenery === 'city') drawCity(horizon, offset);
    else if (track.scenery === 'mountain') drawMountains(horizon, offset, '#4c7e79', '#244b50');
    else if (track.scenery === 'desert') drawDesert(horizon, offset);
    else if (track.scenery === 'snow') drawSnow(horizon, offset);
    else drawHills(horizon, offset);

    ctx.fillStyle = track.grass;
    ctx.fillRect(0, horizon, W, H - horizon);
    // Fast parallax field stripes.
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)';
      const y = horizon + i * 22 + ((performance.now() * .03) % 22);
      ctx.fillRect(0, y, W, 8);
    }
  }

  function drawPixelCloud(x, y, scale, color) {
    ctx.fillStyle = color;
    const s = 6 * scale;
    const blocks = [[0,2,6,2], [1,1,5,1], [2,0,3,1], [6,2,3,1], [-2,3,4,1], [2,3,8,1]];
    for (const [bx, by, bw, bh] of blocks) ctx.fillRect(Math.round(x + bx * s), Math.round(y + by * s), Math.round(bw * s), Math.round(bh * s));
  }

  function drawCity(horizon, offset) {
    const W = state.width;
    for (let layer = 0; layer < 2; layer++) {
      const baseY = horizon - (layer ? 10 : 0);
      const speed = layer ? .1 : .18;
      const color = layer ? '#d8e5ec' : '#1a2330';
      for (let i = -1; i < 16; i++) {
        const w = 50 + ((i * 19 + layer * 37) % 70);
        const h = 70 + ((i * 31 + layer * 23) % 140);
        const x = ((i * 105 - offset * speed) % (W + 140)) - 70;
        ctx.fillStyle = color;
        ctx.fillRect(x, baseY - h, w, h);
        ctx.fillStyle = layer ? 'rgba(88,145,185,.45)' : 'rgba(255,255,255,.72)';
        for (let yy = baseY - h + 12; yy < baseY - 10; yy += 18) {
          for (let xx = x + 8; xx < x + w - 8; xx += 18) ctx.fillRect(xx, yy, 7, 5);
        }
      }
    }
  }

  function drawHills(horizon, offset) {
    const W = state.width;
    ctx.fillStyle = '#0b8d2f';
    for (let i = -2; i < 7; i++) {
      const x = i * 260 - (offset * .05 % 260);
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.quadraticCurveTo(x + 125, horizon - 145 - (i % 2) * 40, x + 280, horizon);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#0c641f';
    for (let i = 0; i < 34; i++) {
      const x = (i * 64 - offset * .16) % (W + 80) - 40;
      const y = horizon - 26 - (i % 3) * 12;
      drawTree(x, y, .65 + (i % 3) * .12);
    }
  }

  function drawMountains(horizon, offset, a, b) {
    const W = state.width;
    ctx.fillStyle = b;
    for (let i = -1; i < 7; i++) {
      const x = i * 260 - (offset * .04 % 260);
      ctx.beginPath();
      ctx.moveTo(x - 40, horizon);
      ctx.lineTo(x + 120, horizon - 210 - (i % 2) * 70);
      ctx.lineTo(x + 290, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(x + 45, horizon);
      ctx.lineTo(x + 120, horizon - 210 - (i % 2) * 70);
      ctx.lineTo(x + 160, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b;
    }
  }

  function drawDesert(horizon, offset) {
    const W = state.width;
    ctx.fillStyle = '#c77b2d';
    for (let i = -1; i < 8; i++) {
      const x = i * 230 - (offset * .07 % 230);
      ctx.beginPath();
      ctx.moveTo(x - 80, horizon);
      ctx.quadraticCurveTo(x + 70, horizon - 95, x + 260, horizon);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#8e511f';
    for (let i = 0; i < 12; i++) {
      const x = (i * 190 - offset * .14) % (W + 160) - 80;
      ctx.fillRect(x, horizon - 80, 10, 80);
      ctx.fillRect(x - 20, horizon - 54, 24, 8);
      ctx.fillRect(x + 8, horizon - 32, 24, 8);
    }
  }

  function drawSnow(horizon, offset) {
    drawMountains(horizon, offset, '#cfefff', '#7fa5ba');
    const W = state.width;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 28; i++) {
      const x = (i * 72 - offset * .11) % (W + 80) - 40;
      const y = horizon - 16 - (i % 4) * 8;
      ctx.fillRect(x, y, 36, 8);
      ctx.fillRect(x + 10, y - 14, 16, 14);
    }
  }

  function drawTree(x, y, scale) {
    const s = 18 * scale;
    ctx.fillStyle = '#57361f';
    ctx.fillRect(x - s * .12, y, s * .24, s * .8);
    ctx.fillStyle = '#075d22';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x - s * .7, y + s * .4);
    ctx.lineTo(x + s * .7, y + s * .4);
    ctx.closePath();
    ctx.fill();
  }

  function drawSegment(p1, p2, roadWidthScale, roadColor, grassColor, rumbleA, rumbleB, laneColor, fade, index) {
    const W = state.width;
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, p2.y, W, p1.y - p2.y);

    const w1 = p1.w * roadWidthScale;
    const w2 = p2.w * roadWidthScale;
    const r1 = w1 * .16;
    const r2 = w2 * .16;
    const l1 = w1 * .018;
    const l2 = w2 * .018;

    const rumbleColor = index % 2 ? rumbleA : rumbleB;
    drawPoly(p1.x - w1 - r1, p1.y, p1.x - w1, p1.y, p2.x - w2, p2.y, p2.x - w2 - r2, p2.y, rumbleColor);
    drawPoly(p1.x + w1 + r1, p1.y, p1.x + w1, p1.y, p2.x + w2, p2.y, p2.x + w2 + r2, p2.y, rumbleColor);
    drawPoly(p1.x - w1, p1.y, p1.x + w1, p1.y, p2.x + w2, p2.y, p2.x - w2, p2.y, roadColor);

    if (index % 3 === 0) {
      drawPoly(p1.x - l1, p1.y, p1.x + l1, p1.y, p2.x + l2, p2.y, p2.x - l2, p2.y, laneColor);
      drawPoly(p1.x - w1 * .5 - l1, p1.y, p1.x - w1 * .5 + l1, p1.y, p2.x - w2 * .5 + l2, p2.y, p2.x - w2 * .5 - l2, p2.y, laneColor);
      drawPoly(p1.x + w1 * .5 - l1, p1.y, p1.x + w1 * .5 + l1, p1.y, p2.x + w2 * .5 + l2, p2.y, p2.x + w2 * .5 - l2, p2.y, laneColor);
    }

    if (fade > .58) {
      ctx.fillStyle = `rgba(92,150,255,${(fade - .58) * 1.15})`;
      ctx.fillRect(0, p2.y, W, p1.y - p2.y + 1);
    }
  }

  function drawRoadQuad(x1, y1, x2, y2, x3, y3, x4, y4, road, white, red, index) {
    ctx.fillStyle = road;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x4, y4); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
    const r = 18;
    drawPoly(x1 - r, y1, x1, y1, x3, y3, x3 - 4, y3, index % 2 ? red : white);
    drawPoly(x2 + r, y2, x2, y2, x4, y4, x4 + 4, y4, index % 2 ? white : red);
  }

  function drawPoly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath();
    ctx.fill();
  }

  function drawSprite(sprite) {
    const p = sprite.p;
    const roadHalf = p.w * sprite.roadScale;
    const x = p.x + roadHalf * sprite.obj.x;
    const y = p.y;
    const scale = clamp(p.scale * 190, .05, 7);
    if (sprite.type === 'coin') drawCoin(x, y, scale, sprite.obj);
    else drawTrafficCar(x, y, scale, sprite.obj.color);
  }

  function drawCoin(x, y, scale, coin) {
    const size = clamp(18 * scale, 6, 46);
    const pulse = Math.sin(performance.now() * .006 + coin.pulse) * .18 + 1;
    ctx.save();
    ctx.translate(x, y - size * 1.6);
    ctx.scale(pulse, 1);
    ctx.fillStyle = '#3b2600';
    ctx.fillRect(-size * .55, size * .55, size * 1.1, size * .22);
    ctx.fillStyle = '#ffd33d';
    ctx.beginPath();
    ctx.arc(0, 0, size * .55, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(-size * .16, -size * .36, size * .3, size * .72);
    ctx.restore();
  }

  function drawTrafficCar(x, y, scale, color) {
    const size = clamp(20 * scale, 5, 80);
    drawPixelCar(x, y - size * .45, size / 42, color, '#111', 0);
  }

  function drawPlayerCar(race) {
    const steerTilt = race.steeringInertia * .08;
    const x = state.width * .5 + race.playerX * state.width * .12;
    const y = state.height * .82;
    const scale = clamp(state.width / 980, .72, 1.25);
    drawPixelCar(x, y, scale * 1.18, race.car.color, race.car.secondary, steerTilt);

    // shadow and speed lines
    if (race.speed > 120) {
      ctx.strokeStyle = `rgba(255,255,255,${clamp((race.speed - 120) / 220, .1, .45)})`;
      ctx.lineWidth = 3 * scale;
      for (let i = 0; i < 10; i++) {
        const lx = state.width * (.12 + i * .085) + Math.sin(i) * 10;
        ctx.beginPath();
        ctx.moveTo(lx, state.height * .78 + (i % 3) * 20);
        ctx.lineTo(lx - 70, state.height * .93 + (i % 3) * 20);
        ctx.stroke();
      }
    }
  }

  function drawPixelCar(x, y, scale, color, secondary, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(-46, 17, 92, 11);
    ctx.fillStyle = '#06070b';
    ctx.fillRect(-45, 5, 90, 18);
    ctx.fillStyle = color;
    ctx.fillRect(-35, -7, 70, 23);
    ctx.fillRect(-24, -20, 48, 18);
    ctx.fillStyle = '#111927';
    ctx.fillRect(-17, -16, 13, 10);
    ctx.fillRect(5, -16, 13, 10);
    ctx.fillStyle = secondary;
    ctx.fillRect(-32, 7, 15, 7);
    ctx.fillRect(17, 7, 15, 7);
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(-42, 9, 9, 6);
    ctx.fillStyle = '#ff5b3d';
    ctx.fillRect(33, 9, 9, 6);
    ctx.fillStyle = '#020202';
    ctx.fillRect(-37, 19, 20, 9);
    ctx.fillRect(17, 19, 20, 9);
    ctx.fillStyle = '#dfe7f2';
    ctx.fillRect(-12, 12, 24, 5);
    ctx.restore();
  }

  function drawHud(race) {
    const W = state.width, H = state.height;
    const hudH = Math.min(180, Math.max(136, H * .23));
    const y = H - hudH;
    ctx.fillStyle = 'rgba(0,0,0,.82)';
    ctx.fillRect(0, y, W, hudH);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(0, y, W, 2);

    drawHudText('SPEED', 28, y + 34, 24);
    drawHudText(String(Math.round(race.speed)).padStart(3, '0'), 28, y + 84, 58, '#ff3b2f');
    drawHudText('km/h', 145, y + 87, 22);
    drawHudText('GEAR', 28, y + 126, 24);
    drawHudText(String(race.gear), 112, y + 130, 42, '#ff3b2f');

    drawTachometer(W * .33, y + hudH * .52, Math.min(116, hudH * .55), race.rpm);
    drawSpeedometer(W * .52, y + hudH * .54, Math.min(118, hudH * .55), race.speed, race.car.maxSpeed);

    drawHudText('DISTANCE', W * .68, y + 34, 26);
    drawBar(W * .68, y + 46, W * .26, 18, race.raceDistance / race.totalRaceLength, '#ff5c31');
    drawHudText(`${Math.floor(race.raceDistance)} m`, W * .68, y + 88, 25, '#fff');
    drawHudText('ODOMETER', W * .68, y + 122, 20, '#b8c4d8');
    drawHudText(`${(state.progress.totalOdometer / 1000).toFixed(2)} km`, W * .79, y + 122, 24, '#ffd33d');

    drawHudText('LAP', W * .43, y + 30, 22);
    drawHudText(`${Math.min(race.lap, race.lapTarget)}/${race.lapTarget}`, W * .48, y + 31, 34, '#30f07e');
    drawHudText('TIME', W * .43, y + 78, 22);
    drawHudText(formatTime(race.elapsed), W * .49, y + 80, 32, '#ff3b2f');
    drawHudText('COINS', W * .43, y + 126, 22);
    drawHudText(fmt.format(race.coins), W * .51, y + 128, 30, '#ffd33d');

    drawHudText('DAMAGE', 28, y + 156, 20);
    drawBar(132, y + 141, W * .18, 18, race.damage / 100, race.damage > 70 ? '#ff3044' : '#b22018', true);

    drawIndicators(W * .63, y + 92, race);
    drawMiniMap(W - Math.min(230, W * .18) - 22, y + 46, Math.min(230, W * .18), hudH - 62, race);
  }

  function drawHudText(text, x, y, size, color = '#fff') {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.font = `900 ${size}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x + 3, y + 3);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawBar(x, y, w, h, value, color, segmented = false) {
    const v = clamp(value, 0, 1);
    ctx.fillStyle = '#12141b';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 3, (w - 6) * v, h - 6);
    if (segmented) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      for (let i = 1; i < 12; i++) ctx.fillRect(x + (w / 12) * i, y + 2, 3, h - 4);
    }
  }

  function drawTachometer(cx, cy, radius, rpm) {
    ctx.save();
    drawHudText('TACH', cx - radius, cy - radius - 18, 21);
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI * .82, Math.PI * 2.18); ctx.stroke();
    for (let i = 0; i <= 8; i++) {
      const a = lerp(Math.PI * .82, Math.PI * 2.18, i / 8);
      const len = i >= 6 ? 20 : 14;
      ctx.strokeStyle = i >= 7 ? '#ff2f3d' : '#fff';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius - len), Math.sin(a) * (radius - len));
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }
    const a = lerp(Math.PI * .82, Math.PI * 2.18, clamp(rpm / 8500, 0, 1));
    ctx.strokeStyle = '#ffd33d';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (radius - 24), Math.sin(a) * (radius - 24)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }

  function drawSpeedometer(cx, cy, radius, speed, maxSpeed) {
    ctx.save();
    drawHudText('MPH/KMH', cx - radius, cy - radius - 18, 21);
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI * .78, Math.PI * 2.22); ctx.stroke();
    ctx.strokeStyle = '#30f07e';
    ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI * .78, lerp(Math.PI * .78, Math.PI * 2.22, clamp(speed / maxSpeed, 0, 1))); ctx.stroke();
    const a = lerp(Math.PI * .78, Math.PI * 2.22, clamp(speed / maxSpeed, 0, 1));
    ctx.strokeStyle = '#ff3044';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (radius - 18), Math.sin(a) * (radius - 18)); ctx.stroke();
    ctx.restore();
  }

  function drawIndicators(x, y, race) {
    const steer = race.steeringInertia;
    const blink = Math.sin(race.indicatorPhase * 9) > 0;
    const leftOn = steer < -.18 && blink;
    const rightOn = steer > .18 && blink;
    ctx.save();
    ctx.translate(x, y);
    drawHudText('TURN', -14, -34, 18, '#b8c4d8');
    ctx.fillStyle = leftOn ? '#ffd33d' : 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-34, -20); ctx.lineTo(-34, 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rightOn ? '#ffd33d' : 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(34, -20); ctx.lineTo(34, 20); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawMiniMap(x, y, w, h, race) {
    const pts = race.built.map;
    ctx.save();
    ctx.fillStyle = '#06110a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = x + p.x * w;
      const py = y + p.y * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    const progress = ((race.lap - 1) * race.built.totalLength + race.pos) / race.totalRaceLength;
    const local = (race.pos / race.built.totalLength) % 1;
    const idx = Math.floor(local * (pts.length - 1));
    const p = pts[idx];
    ctx.fillStyle = '#ff3044';
    ctx.fillRect(x + p.x * w - 6, y + p.y * h - 6, 12, 12);
    ctx.fillStyle = '#ffd33d';
    ctx.fillRect(x + 8, y + h - 14, (w - 16) * progress, 6);
    ctx.restore();
  }

  function drawPauseShade() {
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(0, 0, state.width, state.height);
    drawHudText('PAUSE', state.width / 2 - 72, state.height / 2 - 36, 54, '#ffd33d');
    drawHudText('P — продолжить', state.width / 2 - 120, state.height / 2 + 28, 24, '#fff');
  }

  function drawMenuHint() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(24, state.height - 88, 420, 54);
    drawHudText('RETRO TURBO GP', 42, state.height - 78, 24, '#ffd33d');
    drawHudText('Выбери авто, трассу и сложность', 42, state.height - 48, 18, '#fff');
    ctx.restore();
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function buildMiniMap(segments) {
    let x = 0, y = 0, heading = 0;
    const points = [];
    const step = Math.max(1, Math.floor(segments.length / 220));
    for (let i = 0; i < segments.length; i += step) {
      const seg = segments[i];
      heading += seg.curve * .025;
      x += Math.sin(heading) * 8;
      y -= Math.cos(heading) * 8;
      points.push({ x, y });
    }
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const pad = .12;
    return points.map(p => ({
      x: pad + ((p.x - minX) / Math.max(1, maxX - minX)) * (1 - pad * 2),
      y: pad + ((p.y - minY) / Math.max(1, maxY - minY)) * (1 - pad * 2)
    }));
  }

  function shade(hex, amount) {
    const c = hex.replace('#', '');
    const n = parseInt(c, 16);
    const r = clamp((n >> 16) + amount, 0, 255);
    const g = clamp(((n >> 8) & 255) + amount, 0, 255);
    const b = clamp((n & 255) + amount, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(640, Math.floor(window.innerWidth * dpr));
    const h = Math.max(360, Math.floor(window.innerHeight * dpr));
    canvas.width = w;
    canvas.height = h;
    state.width = w;
    state.height = h;
    state.pixelRatio = dpr;
  }

  function loop(time) {
    state.now = time;
    const dt = clamp((time - state.last) / 1000 || 0, 0, 1 / 20);
    state.last = time;
    if (state.mode === 'race') updateRace(dt);
    render();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (state.mode === 'race') state.mode = 'pause';
    else if (state.mode === 'pause') state.mode = 'race';
  }

  function resetCurrentRace() {
    if (state.race) startRace();
  }

  function initEvents() {
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      state.keys[e.code] = true;
      if (e.code === 'KeyP') togglePause();
      if (e.code === 'KeyR' && (state.mode === 'race' || state.mode === 'pause')) resetCurrentRace();
      if (e.code === 'Enter' && state.mode === 'menu') startRace();
    }, { passive: false });
    window.addEventListener('keyup', (e) => { state.keys[e.code] = false; });

    $('startRace').addEventListener('click', startRace);
    $('pauseBtn').addEventListener('click', togglePause);
    $('menuBtn').addEventListener('click', () => {
      if (state.race && state.race.lastDistanceSave) {
        state.progress.totalOdometer += state.race.lastDistanceSave;
        state.race.lastDistanceSave = 0;
        saveProgress();
      }
      setMode('menu');
      renderMenu();
    });
    $('againBtn').addEventListener('click', startRace);
    $('toMenuBtn').addEventListener('click', () => { setMode('menu'); renderMenu(); });
    $('openGarage').addEventListener('click', () => garagePanel.classList.add('active'));
    $('closeGarage').addEventListener('click', () => garagePanel.classList.remove('active'));
    $('installInfo').addEventListener('click', () => iosInfo.classList.add('active'));
    $('closeIosInfo').addEventListener('click', () => iosInfo.classList.remove('active'));
    $('randomTrack').addEventListener('click', () => {
      const t = TRACKS[Math.floor(Math.random() * TRACKS.length)];
      selectTrack(t.id);
    });
    $('resetProgress').addEventListener('click', () => {
      const ok = confirm('Сбросить монеты, покупки, рекорды и одометр?');
      if (!ok) return;
      localStorage.removeItem(STORAGE_KEY);
      state.progress = loadProgress();
      state.selectedCar = state.progress.selectedCar;
      state.selectedTrack = state.progress.selectedTrack;
      state.selectedDifficulty = state.progress.selectedDifficulty;
      renderMenu();
    });

    document.querySelectorAll('[data-touch]').forEach(btn => {
      const key = btn.dataset.touch;
      const set = (v) => { state.touch[key] = v; };
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); set(true); });
      btn.addEventListener('pointerup', (e) => { e.preventDefault(); set(false); });
      btn.addEventListener('pointercancel', () => set(false));
      btn.addEventListener('pointerleave', () => set(false));
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.mode === 'race') state.mode = 'pause';
      if (state.race && state.race.lastDistanceSave) {
        state.progress.totalOdometer += state.race.lastDistanceSave;
        state.race.lastDistanceSave = 0;
        saveProgress();
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function init() {
    state.selectedCar = state.progress.selectedCar;
    state.selectedTrack = state.progress.selectedTrack;
    state.selectedDifficulty = state.progress.selectedDifficulty;
    resize();
    renderMenu();
    initEvents();
    registerServiceWorker();
    requestAnimationFrame(loop);
  }

  init();
})();
