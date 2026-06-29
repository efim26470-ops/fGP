(() => {
  'use strict';

  const STORAGE_KEY = 'retroTurboGP.v2';
  const SEGMENT_LENGTH = 80;
  const DRAW_DISTANCE = 185;
  const CAMERA_HEIGHT = 980;
  const CAMERA_DEPTH = 0.92;
  const ROAD_WIDTH = 2300;
  const WORLD_SPEED = 4.15;
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
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  const easeInOut = (t) => (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
  const fmt = new Intl.NumberFormat('ru-RU');

  const CARS = [
    { id:'starter', name:'Hatch 86', price:0, color:'#17d9ff', secondary:'#072e3b', desc:'Стартовая машина. Нормально рулится, но быстро упирается в максималку.', maxSpeed:210, accel:82, brake:150, handling:1.18, grip:.96, stability:.92, mass:.95 },
    { id:'compact', name:'Swift Kei', price:650, color:'#ffd33d', secondary:'#5b3c00', desc:'Лёгкая, цепкая, быстрая в связках. На высокой скорости нервная.', maxSpeed:230, accel:96, brake:160, handling:1.58, grip:1.12, stability:.78, mass:.72 },
    { id:'muscle', name:'V8 Brick', price:1450, color:'#ff3b4e', secondary:'#55121a', desc:'Мощная на прямых. Тяжёлая морда, ранний снос в поворотах.', maxSpeed:265, accel:114, brake:130, handling:.98, grip:.84, stability:1.15, mass:1.30 },
    { id:'rally', name:'Rally Fox', price:2300, color:'#f4f8ff', secondary:'#2449ff', desc:'Лучше всех едет по снегу и узким трассам, прощает ошибки.', maxSpeed:250, accel:102, brake:168, handling:1.44, grip:1.26, stability:1.03, mass:.96 },
    { id:'turbo', name:'Turbo XR', price:3800, color:'#9a4dff', secondary:'#21103a', desc:'Турбо-разгон и высокая скорость. Требует плавного руления.', maxSpeed:300, accel:136, brake:154, handling:1.22, grip:1.00, stability:.86, mass:1.02 },
    { id:'prototype', name:'Vector One', price:7200, color:'#30f07e', secondary:'#063820', desc:'Прототип: максимальная скорость, сцепление и тормоза.', maxSpeed:335, accel:152, brake:178, handling:1.62, grip:1.36, stability:1.18, mass:.88 }
  ];

  const TRACKS = [
    { id:'city', name:'Metro Straight', tag:'город', desc:'Широкая городская трасса: длинные прямые и пара резких шиканов.', laps:2, roadWidth:1.12, grip:1.00, coinRate:1.10, trafficRate:.95, sky:'#55a9ff', grass:'#43e833', road:'#858585', rumbleA:'#f4f4f4', rumbleB:'#bd2d1d', scenery:'city', pattern:[[28,0],[10,.18],[8,.48],[10,-.52],[32,0],[8,-.78],[8,.78],[22,0],[12,.30],[20,0],[10,-.32],[26,0]] },
    { id:'green', name:'Green Loop', tag:'классика', desc:'Сбалансированное кольцо в стиле старых гонок: прямые, дуги, много монет.', laps:2, roadWidth:1.00, grip:1.06, coinRate:1.35, trafficRate:.75, sky:'#5aa8ff', grass:'#19c51f', road:'#737373', rumbleA:'#f4f4f4', rumbleB:'#202020', scenery:'hills', pattern:[[14,0],[14,.22],[13,.46],[18,.10],[18,0],[14,-.40],[12,-.58],[18,0],[16,.42],[16,0],[18,-.25],[14,0]] },
    { id:'mountain', name:'Mountain Pass', tag:'серпантин', desc:'Узкая дорога и много поворотов. Машину легко вынести наружу.', laps:2, roadWidth:.82, grip:.95, coinRate:.95, trafficRate:.82, sky:'#6fb4ff', grass:'#1b9e47', road:'#686a70', rumbleA:'#e8e8e8', rumbleB:'#a22618', scenery:'mountain', pattern:[[10,0],[9,.64],[14,.96],[8,-.46],[10,-1.04],[9,-.82],[10,.58],[9,.96],[12,0],[10,-.72],[11,.72],[8,0]] },
    { id:'desert', name:'Sunset Run', tag:'скорость', desc:'Максимальная скорость: длинные прямые, редкие широкие дуги и быстрый трафик.', laps:2, roadWidth:1.04, grip:.92, coinRate:1.05, trafficRate:1.08, sky:'#ff9a46', grass:'#d5a14c', road:'#7b706a', rumbleA:'#fff2cf', rumbleB:'#c04e22', scenery:'desert', pattern:[[42,0],[18,.16],[34,0],[12,-.36],[18,-.18],[42,0],[18,.55],[14,0],[20,-.30],[30,0]] },
    { id:'snow', name:'Ice Ring', tag:'скользко', desc:'Скользкое покрытие, длинные заносы и меньше сцепления. Rally Fox здесь особенно хорош.', laps:2, roadWidth:.94, grip:.74, coinRate:1.22, trafficRate:.65, sky:'#a7d7ff', grass:'#d9f4ff', road:'#8a98a8', rumbleA:'#ffffff', rumbleB:'#3a93d8', scenery:'snow', pattern:[[16,0],[20,.52],[14,.35],[16,0],[18,-.64],[18,-.36],[14,0],[18,.74],[16,0],[20,-.44],[16,0]] }
  ];

  const DIFFICULTIES = [
    { id:'easy', name:'Лёгкая', desc:'Меньше трафика и урона. Хорошо для теста управления.', reward:1, traffic:.65, damage:.65, aiSpeed:.82, coin:1 },
    { id:'normal', name:'Нормальная', desc:'Базовый баланс скорости, монет и риска.', reward:1.35, traffic:1, damage:1, aiSpeed:1, coin:1.15 },
    { id:'hard', name:'Сложная', desc:'Больше машин, сильнее штрафы, выше награда.', reward:2, traffic:1.45, damage:1.45, aiSpeed:1.12, coin:1.35 }
  ];

  const state = {
    mode:'menu', width:1280, height:720, pixelRatio:1,
    keys:Object.create(null), touch:{left:false,right:false,gas:false,brake:false},
    selectedCar:'starter', selectedTrack:'green', selectedDifficulty:'normal',
    progress:loadProgress(), trackCache:new Map(), race:null,
    now:0, last:0, idleScroll:0
  };

  function defaultProgress() {
    return { coins:350, purchased:['starter'], selectedCar:'starter', selectedTrack:'green', selectedDifficulty:'normal', totalOdometer:0, best:{}, version:2 };
  }
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('retroTurboGP.v1');
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const base = defaultProgress();
      return { ...base, ...parsed, purchased:Array.from(new Set([...(parsed.purchased || []), 'starter'])), version:2 };
    } catch (err) { return defaultProgress(); }
  }
  function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
  function getCar(id=state.selectedCar) { return CARS.find(c => c.id === id) || CARS[0]; }
  function getTrack(id=state.selectedTrack) { return TRACKS.find(t => t.id === id) || TRACKS[1]; }
  function getDifficulty(id=state.selectedDifficulty) { return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1]; }
  function isPurchased(id) { return state.progress.purchased.includes(id); }

  function setMode(mode) {
    state.mode = mode;
    menu.classList.toggle('active', mode === 'menu');
    raceOverlay.classList.toggle('hidden', mode !== 'race' && mode !== 'pause');
    if (mode !== 'result') messagePanel.classList.remove('active');
  }

  function makePixelCarSVG(car, tiny=false) {
    const w = tiny ? 92 : 116, h = tiny ? 40 : 46;
    return `<svg class="car-pixel" viewBox="0 0 116 46" width="${w}" height="${h}" aria-hidden="true">
      <rect x="13" y="27" width="90" height="12" fill="#05070a"/>
      <rect x="20" y="16" width="76" height="18" fill="${car.color}"/>
      <rect x="34" y="8" width="48" height="14" fill="${car.color}"/>
      <rect x="40" y="11" width="13" height="8" fill="#101927"/><rect x="63" y="11" width="13" height="8" fill="#101927"/>
      <rect x="22" y="28" width="16" height="6" fill="${car.secondary}"/><rect x="78" y="28" width="16" height="6" fill="${car.secondary}"/>
      <rect x="14" y="30" width="8" height="5" fill="#fff2a0"/><rect x="94" y="30" width="8" height="5" fill="#ff5b3d"/>
      <rect x="24" y="36" width="18" height="7" fill="#000"/><rect x="74" y="36" width="18" height="7" fill="#000"/>
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
        ${makePixelCarSVG(car, true)}<h3>${car.name}</h3><p class="lead small">${car.desc}</p>
        <div class="card-meta"><span class="badge">${car.maxSpeed} км/ч</span><span class="badge ${locked ? 'locked' : 'good'}">${locked ? fmt.format(car.price)+' монет' : 'куплено'}</span></div>
        ${statBar('Разгон', car.accel, 155)}${statBar('Руль', car.handling, 1.7)}${statBar('Сцепление', car.grip, 1.4)}
      </article>`;
    }).join('');

    $('trackGrid').innerHTML = TRACKS.map(track => {
      const selected = state.selectedTrack === track.id;
      const best = state.progress.best[track.id] ? `<span class="badge good">рекорд ${formatTime(state.progress.best[track.id])}</span>` : '';
      return `<article class="track-card ${selected ? 'selected' : ''}" data-track="${track.id}">
        <h3>${track.name}</h3><p class="lead small">${track.desc}</p>
        <div class="card-meta"><span class="badge">${track.tag}</span><span class="badge">${track.laps} круга</span>${best}</div>
      </article>`;
    }).join('');

    $('difficultyGrid').innerHTML = DIFFICULTIES.map(d => `<button class="difficulty-item ${state.selectedDifficulty === d.id ? 'selected' : ''}" data-difficulty="${d.id}"><strong>${d.name}</strong><span>${d.desc}</span></button>`).join('');
    renderGarage();
  }

  function renderGarage() {
    if (!$('garageGrid')) return;
    $('garageGrid').innerHTML = CARS.map(car => {
      const owned = isPurchased(car.id);
      const canBuy = state.progress.coins >= car.price;
      return `<article class="garage-item ${state.selectedCar === car.id ? 'selected' : ''}">
        ${makePixelCarSVG(car)}<div><h3>${car.name}</h3><p class="lead small">${car.desc}</p>
        ${statBar('Макс.', car.maxSpeed, 335)}${statBar('Разгон', car.accel, 155)}${statBar('Тормоза', car.brake, 180)}${statBar('Сцепление', car.grip, 1.4)}
        <div class="card-meta"><span class="badge ${owned ? 'good' : 'locked'}">${owned ? 'куплено' : fmt.format(car.price)+' монет'}</span></div>
        <button class="${owned ? 'ghost-btn' : 'primary-btn'}" data-buy="${car.id}" ${!owned && !canBuy ? 'disabled' : ''}>${owned ? 'Выбрать' : 'Купить'}</button></div>
      </article>`;
    }).join('');
  }

  function selectCar(id) {
    const car = getCar(id);
    if (!isPurchased(id)) {
      garagePanel.classList.add('active');
      return;
    }
    state.selectedCar = id; state.progress.selectedCar = id; saveProgress(); renderMenu();
  }
  function buyOrSelectCar(id) {
    const car = getCar(id);
    if (!isPurchased(id)) {
      if (state.progress.coins < car.price) return;
      state.progress.coins -= car.price;
      state.progress.purchased.push(id);
    }
    selectCar(id);
    garagePanel.classList.remove('active');
  }
  function selectTrack(id) { state.selectedTrack = id; state.progress.selectedTrack = id; saveProgress(); renderMenu(); }
  function selectDifficulty(id) { state.selectedDifficulty = id; state.progress.selectedDifficulty = id; saveProgress(); renderMenu(); }

  function buildTrack(track) {
    if (state.trackCache.has(track.id)) return state.trackCache.get(track.id);
    const segments = [];
    let index = 0;
    function add(length, curve, roadWidth = track.roadWidth) {
      const ease = Math.max(4, Math.floor(length * .35));
      for (let i = 0; i < length; i++) {
        let k = 1;
        if (i < ease) k = easeInOut(i / ease);
        else if (i > length - ease) k = easeInOut((length - i) / ease);
        const c = curve * k;
        const hill = Math.sin((index + track.id.length * 13) * .044) * 18 + Math.sin(index * .013) * 28;
        segments.push({ index, curve:c, roadWidth:ROAD_WIDTH * roadWidth, colorShift:index % 2, yHill:hill, roadside:[] });
        index++;
      }
    }
    for (const p of track.pattern) add(p[0], p[1]);
    while (segments.length < 142) for (const p of track.pattern) add(p[0], p[1]);

    const totalLength = segments.length * SEGMENT_LENGTH;
    const rng = mulberry32(hashString(track.id));
    const coins = [];
    const traffic = [];
    const coinEvery = Math.max(5, Math.round(9 / track.coinRate));
    for (let i = 8; i < segments.length - 8; i += coinEvery) {
      if (rng() > .12) coins.push({ z:i * SEGMENT_LENGTH + SEGMENT_LENGTH * .55, x:clamp((rng() * 2 - 1) * .74, -.82, .82), value:rng() > .88 ? 35 : rng() > .55 ? 18 : 10, taken:false, pulse:rng()*TWO_PI });
    }
    const trafficCount = Math.max(10, Math.round(segments.length * .055 * track.trafficRate));
    for (let i = 0; i < trafficCount; i++) {
      traffic.push({ z:lerp(18 * SEGMENT_LENGTH, totalLength - 18 * SEGMENT_LENGTH, rng()), x:[-.58,-.25,.25,.58][Math.floor(rng()*4)] + (rng()*.06-.03), speed:lerp(75,180,rng()), color:['#ff3448','#ffd33d','#14d9ff','#f4f7ff','#9a4dff'][Math.floor(rng()*5)], hitCooldown:0 });
    }
    // Roadside objects give the road scale and speed references.
    for (let i = 0; i < segments.length; i += 3) {
      const side = rng() > .5 ? 1 : -1;
      if (rng() > .24) segments[i].roadside.push({ side, type: track.scenery === 'city' ? 'sign' : track.scenery === 'desert' ? 'cactus' : track.scenery === 'snow' ? 'snowman' : 'tree', offset: 1.35 + rng() * .5 });
    }
    const map = buildMiniMap(segments);
    const result = { segments, totalLength, map, coins, traffic };
    state.trackCache.set(track.id, result);
    return result;
  }

  function startRace() {
    const car = getCar();
    const track = getTrack();
    const diff = getDifficulty();
    const built = buildTrack(track);
    state.race = {
      car, track, diff, built,
      pos:0, lap:1, lapTarget:track.laps,
      speed:0, playerX:0, lateralVelocity:0, steerSmooth:0, drift:0,
      damage:0, coins:0, raceDistance:0, lastDistanceSave:0, elapsed:0, lapTime:0,
      gear:1, rpm:900, indicatorPhase:0, finished:false, cameraShake:0,
      coinsMap: built.coins.map(c => ({...c, taken:false})),
      traffic: built.traffic.map(t => ({...t, hitCooldown:0, z:(t.z + Math.random()*SEGMENT_LENGTH*4) % built.totalLength})),
      totalRaceLength: built.totalLength * track.laps
    };
    setMode('race');
  }

  function endRace(type) {
    const race = state.race;
    if (!race || race.finished) return;
    race.finished = true;
    setMode('result');
    const cleanBonus = Math.max(0, Math.round((100 - race.damage) * race.diff.reward));
    const finishBonus = type === 'win' ? Math.round(250 * race.diff.reward * race.track.laps) : 0;
    const totalReward = cleanBonus + finishBonus;
    state.progress.coins += totalReward;
    state.progress.totalOdometer += race.lastDistanceSave;
    race.lastDistanceSave = 0;
    let kicker = 'Гонка завершена';
    let title = type === 'win' ? 'You won' : 'Game over';
    let text;
    if (type === 'win') {
      if (!state.progress.best[race.track.id] || race.elapsed < state.progress.best[race.track.id]) { state.progress.best[race.track.id] = race.elapsed; kicker = 'Новый рекорд трассы'; }
      text = `Время: ${formatTime(race.elapsed)}. Монеты с дороги: ${fmt.format(race.coins)}, бонус: ${fmt.format(totalReward)}.`;
    } else {
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
    return built.segments[Math.floor(pos / SEGMENT_LENGTH) % built.segments.length];
  }
  function signedTrackDistance(target, current, total) {
    let d = target - current;
    if (d < -total / 2) d += total;
    if (d > total / 2) d -= total;
    return d;
  }

  function updateRace(dt) {
    const race = state.race;
    if (!race || race.finished || state.mode !== 'race') return;
    dt = Math.min(dt, 1/30);
    const { car, track, diff, built } = race;
    const seg = getSegmentAt(race.pos);
    const left = input('left'), right = input('right'), gas = input('gas'), brake = input('brake');
    const steerRaw = (right ? 1 : 0) - (left ? 1 : 0);
    const offRoad = Math.abs(race.playerX) > 1.0;
    const trackGrip = car.grip * track.grip * (offRoad ? .42 : 1);
    const speedRatio = clamp(race.speed / car.maxSpeed, 0, 1);

    if (gas) race.speed += car.accel * (1 - speedRatio * .38) * dt;
    else race.speed -= (12 + race.speed * .030) * dt;
    if (brake) race.speed -= car.brake * (1 + speedRatio * .15) * dt;
    if (offRoad) race.speed -= (34 + race.speed * .33) * dt;
    race.speed = clamp(race.speed, 0, car.maxSpeed);

    race.steerSmooth = lerp(race.steerSmooth, steerRaw, dt * (4.4 + car.handling * 2.4));
    const curvePull = seg.curve * (0.54 + speedRatio * 2.85) / Math.max(.55, trackGrip);
    const targetLat = race.steerSmooth * car.handling * (0.55 + speedRatio * 1.65) - curvePull;
    const gripDamp = 2.0 + trackGrip * 3.1 + car.stability * 1.4;
    race.lateralVelocity = lerp(race.lateralVelocity, targetLat, dt * gripDamp / car.mass);

    const slip = clamp(Math.abs(targetLat - race.lateralVelocity) * .38 + Math.max(0, speedRatio - trackGrip * .62), 0, 1);
    race.drift = lerp(race.drift, slip, dt * 5.5);
    if (race.drift > .55 && race.speed > 115) race.speed -= (race.drift * 18) * dt;
    race.playerX += race.lateralVelocity * dt;
    if (race.playerX < -1.72 || race.playerX > 1.72) {
      race.playerX = clamp(race.playerX, -1.72, 1.72);
      race.lateralVelocity *= -.25;
      race.damage += dt * 10 * diff.damage;
      race.cameraShake = Math.max(race.cameraShake, .8);
    }
    if (offRoad && race.speed > 95) race.damage += dt * (1.0 + race.speed / 170) * diff.damage;

    const meters = (race.speed / 3.6) * dt * WORLD_SPEED;
    race.pos += meters;
    race.raceDistance += meters;
    race.elapsed += dt;
    race.lapTime += dt;
    race.indicatorPhase += dt;
    race.cameraShake = Math.max(0, race.cameraShake - dt * 1.9);

    race.lastDistanceSave += meters;
    if (race.lastDistanceSave > 160) { state.progress.totalOdometer += race.lastDistanceSave; race.lastDistanceSave = 0; saveProgress(); }

    while (race.pos >= built.totalLength) {
      race.pos -= built.totalLength;
      race.lap++;
      race.lapTime = 0;
      for (const c of race.coinsMap) c.taken = false;
      if (race.lap > race.lapTarget) { endRace('win'); return; }
    }

    for (const ai of race.traffic) {
      ai.hitCooldown = Math.max(0, ai.hitCooldown - dt);
      ai.z = (ai.z + (ai.speed * diff.aiSpeed / 3.6) * dt * WORLD_SPEED * .48) % built.totalLength;
    }
    checkCoins();
    checkCollisions(dt);
    updateGearAndRpm(dt);
    if (race.damage >= 100) { race.damage = 100; endRace('lose'); }
  }

  function checkCoins() {
    const race = state.race;
    for (const coin of race.coinsMap) {
      if (coin.taken) continue;
      const d = signedTrackDistance(coin.z, race.pos, race.built.totalLength);
      if (d > -35 && d < 55 && Math.abs(coin.x - race.playerX) < .22) {
        coin.taken = true;
        const combo = race.elapsed - (race.lastCoinTime || -99) < 1.6 ? Math.min(5, (race.combo || 1) + .35) : 1;
        race.combo = combo; race.lastCoinTime = race.elapsed;
        const value = Math.round(coin.value * race.diff.coin * combo);
        race.coins += value; state.progress.coins += value; saveProgress();
      }
    }
  }
  function checkCollisions(dt) {
    const race = state.race;
    for (const ai of race.traffic) {
      if (ai.hitCooldown > 0) continue;
      const d = signedTrackDistance(ai.z, race.pos, race.built.totalLength);
      if (d > -40 && d < 70 && Math.abs(ai.x - race.playerX) < .22) {
        const hit = clamp((race.speed - ai.speed * .35) / 40, 1, 6.2) * race.diff.damage;
        race.damage += hit * 5.8;
        race.speed *= .48;
        race.playerX += race.playerX > ai.x ? .24 : -.24;
        race.lateralVelocity *= -.7;
        race.cameraShake = 1;
        ai.hitCooldown = 3.0;
      }
    }
  }
  function updateGearAndRpm(dt) {
    const race = state.race;
    const ratio = clamp(race.speed / race.car.maxSpeed, 0, 1);
    race.gear = clamp(Math.floor(ratio * 6) + 1, 1, 6);
    const gearBase = (ratio * 6) % 1;
    const target = 900 + gearBase * 6900 + (input('gas') ? 800 : 0) - (input('brake') ? 350 : 0);
    race.rpm = lerp(race.rpm, clamp(target, 850, 8500), dt * 9);
  }

  function project(worldX, worldY, z, cameraX, cameraY) {
    z = Math.max(6, z);
    const scale = CAMERA_DEPTH / z;
    return {
      scale,
      x: Math.round(state.width / 2 + scale * (worldX - cameraX) * state.width / 2),
      y: Math.round(state.height / 2 - scale * (worldY - cameraY) * state.height / 2),
      w: Math.round(scale * ROAD_WIDTH * state.width / 2)
    };
  }

  function render() {
    if (state.mode === 'race' || state.mode === 'pause' || state.mode === 'result') renderRace();
    else renderIdle();
  }
  function viewBottom() { return state.height - Math.min(176, Math.max(132, state.height * .22)); }

  function renderIdle() {
    const track = getTrack();
    drawBackground(track, state.idleScroll, viewBottom());
    const W = state.width, H = state.height, bottom = viewBottom();
    drawRoadQuad(W * .08, bottom, W * .92, bottom, W * .48, H * .43, W * .52, H * .43, track.road, track.rumbleA, track.rumbleB, 0);
    drawPixelCar(W * .5, bottom - 30, clamp(W / 1000, .75, 1.3), getCar().color, getCar().secondary, 0, 0);
    drawMenuHint();
  }

  function renderRace() {
    const race = state.race;
    if (!race) return;
    const W = state.width, H = state.height, bottom = viewBottom();
    const track = race.track, built = race.built;
    const baseIndex = Math.floor(race.pos / SEGMENT_LENGTH);
    const basePercent = (race.pos % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const baseSeg = built.segments[baseIndex % built.segments.length];
    const cameraX = race.playerX * ROAD_WIDTH + Math.sin(race.elapsed * 70) * race.cameraShake * 18;
    const cameraY = CAMERA_HEIGHT + Math.sin(race.elapsed * 42) * race.cameraShake * 22;
    const screenSegs = new Map();
    const sprites = [];

    drawBackground(track, race.pos * .035, bottom);

    let x = 0;
    let dx = -baseSeg.curve * SEGMENT_LENGTH * .36 * basePercent;
    let maxY = bottom;
    const curveVisual = ROAD_WIDTH * .011;

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const seg = built.segments[(baseIndex + n) % built.segments.length];
      const next = built.segments[(baseIndex + n + 1) % built.segments.length];
      const z1 = (n - basePercent) * SEGMENT_LENGTH + 42;
      const z2 = (n + 1 - basePercent) * SEGMENT_LENGTH + 42;
      const x1 = x;
      const p1 = project(x1, seg.yHill, z1, cameraX, cameraY);
      x += dx;
      dx += seg.curve * SEGMENT_LENGTH * curveVisual;
      const x2 = x;
      const p2 = project(x2, next.yHill, z2, cameraX, cameraY);
      if (p1.y > bottom) { p1.y = bottom; p1.w = Math.min(p1.w, W * 1.4); }
      if (p2.y >= maxY || p2.y < 0) continue;
      const fade = n / DRAW_DISTANCE;
      drawSegment(p1, p2, seg.roadWidth / ROAD_WIDTH, track, seg, fade, bottom);
      screenSegs.set(seg.index, { p1, p2, x1, x2, roadScale: seg.roadWidth / ROAD_WIDTH });
      maxY = p2.y;
    }

    // roadside objects, coins and traffic are drawn after the road: far to near.
    for (const [segIndex, data] of screenSegs) {
      const seg = built.segments[segIndex];
      for (const obj of seg.roadside) sprites.push({ kind:'roadside', data, obj, zRel: relativeZForSegment(segIndex, baseIndex, basePercent, built.segments.length) + SEGMENT_LENGTH * .4 });
    }
    for (const coin of race.coinsMap) if (!coin.taken) pushSpriteIfVisible(sprites, screenSegs, coin, 'coin', race);
    for (const ai of race.traffic) pushSpriteIfVisible(sprites, screenSegs, ai, 'traffic', race);

    sprites.sort((a,b) => b.zRel - a.zRel);
    for (const s of sprites) drawSprite(s);

    drawPlayerCar(race);
    drawHud(race);
    if (state.mode === 'pause') drawPauseShade();
  }

  function relativeZForSegment(segIndex, baseIndex, basePercent, len) {
    let n = segIndex - (baseIndex % len);
    if (n < 0) n += len;
    return (n - basePercent) * SEGMENT_LENGTH + 42;
  }
  function pushSpriteIfVisible(sprites, screenSegs, obj, kind, race) {
    const d = signedTrackDistance(obj.z, race.pos, race.built.totalLength);
    if (d < 18 || d > DRAW_DISTANCE * SEGMENT_LENGTH) return;
    const segIndex = Math.floor(obj.z / SEGMENT_LENGTH) % race.built.segments.length;
    const data = screenSegs.get(segIndex);
    if (!data) return;
    sprites.push({ kind, data, obj, t:(obj.z % SEGMENT_LENGTH) / SEGMENT_LENGTH, zRel:d });
  }

  function drawBackground(track, offset, bottom) {
    const W = state.width, H = state.height;
    const horizon = H * .405;
    ctx.fillStyle = track.sky; ctx.fillRect(0, 0, W, H);
    const cloudColor = track.scenery === 'desert' ? 'rgba(255,245,210,.88)' : 'rgba(255,255,255,.94)';
    for (let i = 0; i < 10; i++) {
      const x = ((i * 255 - offset * .055 + 80) % (W + 360)) - 180;
      const y = 36 + (i % 3) * 42;
      drawPixelCloud(x, y, 1 + (i % 2) * .42, cloudColor);
    }
    if (track.scenery === 'city') drawCity(horizon, offset);
    else if (track.scenery === 'mountain') drawMountains(horizon, offset, '#4c7e79', '#244b50');
    else if (track.scenery === 'desert') drawDesert(horizon, offset);
    else if (track.scenery === 'snow') drawSnow(horizon, offset);
    else drawHills(horizon, offset);
    ctx.fillStyle = track.grass; ctx.fillRect(0, horizon, W, bottom - horizon + 8);
    for (let i = 0; i < 14; i++) {
      const y = horizon + i * 18 + ((offset * .18) % 18);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)';
      ctx.fillRect(0, y, W, 7);
    }
  }
  function drawPixelCloud(x,y,scale,color) {
    ctx.fillStyle = color; const s = 6 * scale;
    const blocks = [[0,2,6,2],[1,1,5,1],[2,0,3,1],[6,2,3,1],[-2,3,4,1],[2,3,8,1]];
    for (const [bx,by,bw,bh] of blocks) ctx.fillRect(Math.round(x+bx*s), Math.round(y+by*s), Math.round(bw*s), Math.round(bh*s));
  }
  function drawCity(horizon, offset) {
    const W = state.width;
    for (let layer = 0; layer < 2; layer++) {
      const baseY = horizon - (layer ? 8 : 0); const speed = layer ? .05 : .10; const color = layer ? '#d8e5ec' : '#182331';
      for (let i = -1; i < 18; i++) {
        const w = 46 + ((i*19+layer*37)%70), h = 62 + ((i*31+layer*23)%132);
        const x = ((i*100 - offset*speed) % (W+150)) - 75;
        ctx.fillStyle = color; ctx.fillRect(x, baseY-h, w, h);
        ctx.fillStyle = layer ? 'rgba(88,145,185,.45)' : 'rgba(255,255,255,.72)';
        for (let yy = baseY-h+12; yy < baseY-10; yy+=18) for (let xx = x+8; xx < x+w-8; xx+=18) ctx.fillRect(xx, yy, 7, 5);
      }
    }
  }
  function drawHills(horizon, offset) {
    const W = state.width; ctx.fillStyle = '#0b8d2f';
    for (let i=-2; i<8; i++) { const x = i*260 - (offset*.04 % 260); ctx.beginPath(); ctx.moveTo(x,horizon); ctx.quadraticCurveTo(x+125,horizon-145-(i%2)*40,x+280,horizon); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#0c641f'; for (let i=0;i<36;i++){ const x=(i*64-offset*.10)%(W+80)-40; const y=horizon-26-(i%3)*12; drawTree(x,y,.65+(i%3)*.12); }
  }
  function drawMountains(horizon, offset, a, b) {
    const W = state.width; ctx.fillStyle = b;
    for (let i=-1;i<8;i++){ const x=i*260-(offset*.035%260); ctx.beginPath(); ctx.moveTo(x-40,horizon); ctx.lineTo(x+120,horizon-210-(i%2)*70); ctx.lineTo(x+290,horizon); ctx.closePath(); ctx.fill(); ctx.fillStyle=a; ctx.beginPath(); ctx.moveTo(x+45,horizon); ctx.lineTo(x+120,horizon-210-(i%2)*70); ctx.lineTo(x+160,horizon); ctx.closePath(); ctx.fill(); ctx.fillStyle=b; }
  }
  function drawDesert(horizon, offset) {
    const W = state.width; ctx.fillStyle='#c77b2d';
    for (let i=-1;i<8;i++){ const x=i*230-(offset*.05%230); ctx.beginPath(); ctx.moveTo(x-80,horizon); ctx.quadraticCurveTo(x+70,horizon-95,x+260,horizon); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle='#8e511f'; for (let i=0;i<12;i++){ const x=(i*190-offset*.10)%(W+160)-80; ctx.fillRect(x,horizon-80,10,80); ctx.fillRect(x-20,horizon-54,24,8); ctx.fillRect(x+8,horizon-32,24,8); }
  }
  function drawSnow(horizon, offset) { drawMountains(horizon, offset, '#cfefff', '#7fa5ba'); const W=state.width; ctx.fillStyle='#fff'; for(let i=0;i<28;i++){ const x=(i*72-offset*.08)%(W+80)-40, y=horizon-16-(i%4)*8; ctx.fillRect(x,y,36,8); ctx.fillRect(x+10,y-14,16,14); } }
  function drawTree(x, y, scale) { const s=18*scale; ctx.fillStyle='#57361f'; ctx.fillRect(x-s*.12,y,s*.24,s*.8); ctx.fillStyle='#075d22'; ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x-s*.7,y+s*.4); ctx.lineTo(x+s*.7,y+s*.4); ctx.closePath(); ctx.fill(); }

  function drawSegment(p1, p2, roadWidthScale, track, seg, fade) {
    const W = state.width;
    ctx.fillStyle = shade(track.grass, seg.colorShift ? -12 : 7);
    ctx.fillRect(0, p2.y, W, p1.y - p2.y + 1);
    const w1 = p1.w * roadWidthScale, w2 = p2.w * roadWidthScale;
    const r1 = w1 * .16, r2 = w2 * .16, l1 = Math.max(1, w1 * .014), l2 = Math.max(1, w2 * .014);
    const rumble = seg.index % 2 ? track.rumbleA : track.rumbleB;
    drawPoly(p1.x-w1-r1,p1.y,p1.x-w1,p1.y,p2.x-w2,p2.y,p2.x-w2-r2,p2.y,rumble);
    drawPoly(p1.x+w1+r1,p1.y,p1.x+w1,p1.y,p2.x+w2,p2.y,p2.x+w2+r2,p2.y,rumble);
    drawPoly(p1.x-w1,p1.y,p1.x+w1,p1.y,p2.x+w2,p2.y,p2.x-w2,p2.y,shade(track.road, seg.colorShift ? -9 : 7));
    if (seg.index % 3 === 0) {
      const lane = seg.colorShift ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.48)';
      drawPoly(p1.x-l1,p1.y,p1.x+l1,p1.y,p2.x+l2,p2.y,p2.x-l2,p2.y,lane);
      drawPoly(p1.x-w1*.50-l1,p1.y,p1.x-w1*.50+l1,p1.y,p2.x-w2*.50+l2,p2.y,p2.x-w2*.50-l2,p2.y,lane);
      drawPoly(p1.x+w1*.50-l1,p1.y,p1.x+w1*.50+l1,p1.y,p2.x+w2*.50+l2,p2.y,p2.x+w2*.50-l2,p2.y,lane);
    }
    if (fade > .64) { ctx.fillStyle = `rgba(95,155,255,${(fade-.64)*1.3})`; ctx.fillRect(0,p2.y,W,p1.y-p2.y+1); }
  }
  function drawRoadQuad(x1,y1,x2,y2,x3,y3,x4,y4,road,white,red,index){ ctx.fillStyle=road; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x4,y4); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); const r=18; drawPoly(x1-r,y1,x1,y1,x3,y3,x3-4,y3,index%2?red:white); drawPoly(x2+r,y2,x2,y2,x4,y4,x4+4,y4,index%2?white:red); }
  function drawPoly(x1,y1,x2,y2,x3,y3,x4,y4,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.lineTo(x4,y4); ctx.closePath(); ctx.fill(); }

  function spritePoint(data, t, roadX) {
    const x = lerp(data.p1.x, data.p2.x, t);
    const y = lerp(data.p1.y, data.p2.y, t);
    const w = lerp(data.p1.w, data.p2.w, t) * data.roadScale;
    const scale = lerp(data.p1.scale, data.p2.scale, t);
    return { x:x + w * roadX, y, w, scale };
  }
  function drawSprite(s) {
    if (s.kind === 'roadside') {
      const t = .42; const roadX = s.obj.side * s.obj.offset; const p = spritePoint(s.data, t, roadX); const scale = clamp(p.scale * 9000, .18, 2.4);
      if (s.obj.type === 'tree') drawTree(p.x, p.y - 18 * scale, scale);
      else if (s.obj.type === 'cactus') drawCactus(p.x, p.y, scale);
      else if (s.obj.type === 'snowman') drawSnowman(p.x, p.y, scale);
      else drawRoadSign(p.x, p.y, scale);
      return;
    }
    const p = spritePoint(s.data, s.t ?? .55, s.obj.x);
    const scale = clamp(p.scale * 7200, .12, 2.8);
    if (s.kind === 'coin') drawCoin(p.x, p.y, scale, s.obj);
    else drawTrafficCar(p.x, p.y, scale, s.obj.color);
  }
  function drawCoin(x,y,scale,coin){ const size=clamp(9*scale,6,42); const pulse=Math.sin(performance.now()*.006+coin.pulse)*.18+1; ctx.save(); ctx.translate(x,y-size*1.8); ctx.scale(pulse,1); ctx.fillStyle='#3b2600'; ctx.fillRect(-size*.6,size*.55,size*1.2,size*.22); ctx.fillStyle='#ffd33d'; ctx.beginPath(); ctx.arc(0,0,size*.62,0,TWO_PI); ctx.fill(); ctx.fillStyle='#fff2a0'; ctx.fillRect(-size*.15,-size*.42,size*.3,size*.84); ctx.restore(); }
  function drawTrafficCar(x,y,scale,color){ drawPixelCar(x, y - 11*scale, scale*.55, color, '#111', 0, 0); }
  function drawCactus(x,y,scale){ const s=18*scale; ctx.fillStyle='#0d7d36'; ctx.fillRect(x-s*.15,y-s*1.2,s*.3,s*1.2); ctx.fillRect(x-s*.55,y-s*.72,s*.25,s*.50); ctx.fillRect(x+s*.30,y-s*.95,s*.25,s*.52); ctx.fillRect(x-s*.55,y-s*.72,s*.55,s*.20); ctx.fillRect(x,y-s*.95,s*.55,s*.20); }
  function drawSnowman(x,y,scale){ const s=14*scale; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y-s*.55,s*.55,0,TWO_PI); ctx.arc(x,y-s*1.25,s*.42,0,TWO_PI); ctx.fill(); ctx.fillStyle='#222'; ctx.fillRect(x-s*.12,y-s*1.36,s*.08,s*.08); ctx.fillRect(x+s*.08,y-s*1.36,s*.08,s*.08); }
  function drawRoadSign(x,y,scale){ const s=18*scale; ctx.fillStyle='#222'; ctx.fillRect(x-s*.08,y-s*1.3,s*.16,s*1.3); ctx.fillStyle='#f7f7f7'; ctx.fillRect(x-s*.55,y-s*1.85,s*1.1,s*.45); ctx.fillStyle='#d63222'; ctx.fillRect(x-s*.48,y-s*1.78,s*.96,s*.09); }

  function drawPlayerCar(race) {
    const W = state.width, bottom = viewBottom();
    const x = W * .5 + race.playerX * W * .09 + race.lateralVelocity * 9;
    const y = bottom - 34;
    const scale = clamp(W / 950, .78, 1.28);
    if (race.speed > 115) {
      ctx.strokeStyle = `rgba(255,255,255,${clamp((race.speed-115)/250,.08,.42)})`;
      ctx.lineWidth = 3 * scale;
      for (let i=0;i<11;i++){ const lx=W*(.12+i*.08)+Math.sin(i+race.elapsed*8)*14; ctx.beginPath(); ctx.moveTo(lx,bottom-68+(i%3)*18); ctx.lineTo(lx-75,bottom-8+(i%3)*18); ctx.stroke(); }
    }
    if (race.drift > .35) {
      ctx.strokeStyle = `rgba(255,255,255,${race.drift*.28})`; ctx.lineWidth = 6*scale;
      ctx.beginPath(); ctx.moveTo(x-34*scale,y+18*scale); ctx.lineTo(x-92*scale,y+30*scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+34*scale,y+18*scale); ctx.lineTo(x+92*scale,y+30*scale); ctx.stroke();
    }
    drawPixelCar(x, y, scale*1.12, race.car.color, race.car.secondary, race.steerSmooth*.11 + race.lateralVelocity*.018, race.drift);
  }
  function drawPixelCar(x,y,scale,color,secondary,tilt=0,drift=0){ ctx.save(); ctx.translate(x,y); ctx.rotate(tilt); ctx.scale(scale,scale); ctx.fillStyle='rgba(0,0,0,.38)'; ctx.fillRect(-48,17,96,12); ctx.fillStyle='#050609'; ctx.fillRect(-46,5,92,18); ctx.fillStyle=color; ctx.fillRect(-36,-8,72,24); ctx.fillRect(-24,-22,48,18); ctx.fillStyle='#111927'; ctx.fillRect(-17,-17,13,10); ctx.fillRect(5,-17,13,10); ctx.fillStyle=secondary; ctx.fillRect(-33,7,16,7); ctx.fillRect(17,7,16,7); ctx.fillStyle='#fff2a0'; ctx.fillRect(-43,9,9,6); ctx.fillStyle='#ff5b3d'; ctx.fillRect(34,9,9,6); ctx.fillStyle='#020202'; ctx.fillRect(-38,19,21,9); ctx.fillRect(17,19,21,9); ctx.fillStyle='#dfe7f2'; ctx.fillRect(-12,12,24,5); if (drift > .4) { ctx.fillStyle='rgba(255,255,255,.45)'; ctx.fillRect(-43,28,18,4); ctx.fillRect(25,28,18,4); } ctx.restore(); }

  function drawHud(race) {
    const W = state.width, H = state.height; const hudH = Math.min(176, Math.max(132, H * .22)); const y = H - hudH;
    ctx.fillStyle = 'rgba(0,0,0,.86)'; ctx.fillRect(0,y,W,hudH);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0,y,W,2);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let i=0;i<5;i++){ ctx.save(); ctx.translate(i*W*.22 - (race.pos*.18 % (W*.22)), y+hudH); ctx.rotate(-.08); ctx.fillRect(0,-hudH*.55,W*.2,4); ctx.restore(); }

    drawHudText('SPEED', 12, y+28, 22); drawHudText(String(Math.round(race.speed)).padStart(3,'0'), 12, y+68, 52, '#ff3b2f'); drawHudText('km/h', 118, y+76, 20);
    drawHudText('GEAR', 12, y+118, 20); drawHudText(String(race.gear), 75, y+118, 38, '#ff3b2f');
    drawHudText('DAMAGE', 12, y+148, 17); drawBar(80, y+145, W*.20, 16, race.damage/100, race.damage>70 ? '#ff3044' : '#b22018', true);

    drawTachometer(W*.33, y+hudH*.52, Math.min(82, hudH*.44), race.rpm);
    drawSpeedometer(W*.52, y+hudH*.53, Math.min(84, hudH*.45), race.speed, race.car.maxSpeed);
    drawHudText('LAP', W*.43, y+25, 19); drawHudText(`${Math.min(race.lap,race.lapTarget)}/${race.lapTarget}`, W*.48, y+24, 29, '#30f07e');
    drawHudText('TIME', W*.43, y+70, 19); drawHudText(formatTime(race.elapsed), W*.49, y+70, 28, '#ff3b2f');
    drawHudText('COINS', W*.43, y+112, 19); drawHudText(fmt.format(race.coins), W*.51, y+112, 26, '#ffd33d');
    drawIndicators(W*.63, y+88, race);
    drawHudText('DISTANCE', W*.68, y+27, 22); drawBar(W*.68, y+40, W*.25, 16, race.raceDistance/race.totalRaceLength, '#ff5c31');
    drawHudText(`${Math.floor(race.raceDistance)} m`, W*.68, y+74, 22, '#fff'); drawHudText('ODOMETER', W*.68, y+108, 18, '#b8c4d8'); drawHudText(`${((state.progress.totalOdometer + race.lastDistanceSave)/1000).toFixed(2)} km`, W*.79, y+108, 22, '#ffd33d');
    drawMiniMap(W - Math.min(215, W*.17) - 18, y+42, Math.min(215, W*.17), hudH-52, race);
  }
  function drawHudText(text,x,y,size,color='#fff'){ ctx.save(); ctx.font=`900 ${size}px monospace`; ctx.textBaseline='top'; ctx.fillStyle='rgba(0,0,0,.68)'; ctx.fillText(text,x+3,y+3); ctx.fillStyle=color; ctx.fillText(text,x,y); ctx.restore(); }
  function drawBar(x,y,w,h,value,color,segmented=false){ const v=clamp(value,0,1); ctx.fillStyle='#11141a'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h); ctx.fillStyle=color; ctx.fillRect(x+3,y+3,(w-6)*v,h-6); if(segmented){ ctx.fillStyle='rgba(0,0,0,.58)'; for(let i=1;i<12;i++) ctx.fillRect(x+(w/12)*i,y+2,3,h-4); } }
  function drawTachometer(cx,cy,radius,rpm){ ctx.save(); drawHudText('TACH',cx-radius,cy-radius-18,17); ctx.translate(cx,cy); ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,radius,Math.PI*.82,Math.PI*2.18); ctx.stroke(); for(let i=0;i<=8;i++){ const a=lerp(Math.PI*.82,Math.PI*2.18,i/8), len=i>=6?16:11; ctx.strokeStyle=i>=7?'#ff2f3d':'#fff'; ctx.beginPath(); ctx.moveTo(Math.cos(a)*(radius-len),Math.sin(a)*(radius-len)); ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius); ctx.stroke(); } const a=lerp(Math.PI*.82,Math.PI*2.18,clamp(rpm/8500,0,1)); ctx.strokeStyle='#ffd33d'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*(radius-18),Math.sin(a)*(radius-18)); ctx.stroke(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,0,5,0,TWO_PI); ctx.fill(); ctx.restore(); }
  function drawSpeedometer(cx,cy,radius,speed,maxSpeed){ ctx.save(); drawHudText('MPH/KMH',cx-radius,cy-radius-18,17); ctx.translate(cx,cy); ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(0,0,radius,Math.PI*.78,Math.PI*2.22); ctx.stroke(); ctx.strokeStyle='#30f07e'; ctx.beginPath(); ctx.arc(0,0,radius,Math.PI*.78,lerp(Math.PI*.78,Math.PI*2.22,clamp(speed/maxSpeed,0,1))); ctx.stroke(); const a=lerp(Math.PI*.78,Math.PI*2.22,clamp(speed/maxSpeed,0,1)); ctx.strokeStyle='#ff3044'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*(radius-15),Math.sin(a)*(radius-15)); ctx.stroke(); ctx.restore(); }
  function drawIndicators(x,y,race){ const blink=Math.sin(race.indicatorPhase*9)>0; const leftOn=race.steerSmooth<-.20&&blink, rightOn=race.steerSmooth>.20&&blink; ctx.save(); ctx.translate(x,y); drawHudText('TURN',-14,-32,17,'#b8c4d8'); ctx.fillStyle=leftOn?'#ffd33d':'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(-58,0); ctx.lineTo(-30,-17); ctx.lineTo(-30,17); ctx.closePath(); ctx.fill(); ctx.fillStyle=rightOn?'#ffd33d':'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(58,0); ctx.lineTo(30,-17); ctx.lineTo(30,17); ctx.closePath(); ctx.fill(); ctx.restore(); }
  function drawMiniMap(x,y,w,h,race){ const pts=race.built.map; ctx.save(); ctx.fillStyle='#06110a'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='rgba(255,255,255,.82)'; ctx.lineWidth=4; ctx.beginPath(); pts.forEach((p,i)=>{ const px=x+p.x*w, py=y+p.y*h; if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py); }); ctx.closePath(); ctx.stroke(); const progress=((race.lap-1)*race.built.totalLength+race.pos)/race.totalRaceLength; const local=(race.pos/race.built.totalLength)%1; const idx=Math.floor(local*(pts.length-1)); const p=pts[idx]; ctx.fillStyle='#ff3044'; ctx.fillRect(x+p.x*w-5,y+p.y*h-5,10,10); ctx.fillStyle='#ffd33d'; ctx.fillRect(x+8,y+h-12,(w-16)*progress,5); ctx.restore(); }
  function drawPauseShade(){ ctx.fillStyle='rgba(0,0,0,.48)'; ctx.fillRect(0,0,state.width,state.height); drawHudText('PAUSE',state.width/2-72,state.height/2-36,54,'#ffd33d'); drawHudText('P — продолжить',state.width/2-120,state.height/2+28,24,'#fff'); }
  function drawMenuHint(){ if(state.mode!=='menu')return; const W=state.width,H=state.height; ctx.save(); ctx.globalAlpha=.28; drawHudText('RETRO TURBO GP', W*.5-190, H*.18, 36, '#fff'); ctx.restore(); }

  function buildMiniMap(segments) {
    let dir = -Math.PI/2, x = 0, y = 0; const pts=[];
    for (let i=0; i<segments.length; i+=2) { dir += segments[i].curve * .015; x += Math.cos(dir) * 8; y += Math.sin(dir) * 8; pts.push({x,y}); }
    const minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x)), minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
    return pts.map(p=>({ x:(p.x-minX)/Math.max(1,maxX-minX)*.82+.09, y:(p.y-minY)/Math.max(1,maxY-minY)*.82+.09 }));
  }
  function mulberry32(seed){ return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function hashString(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function formatTime(sec){ const m=Math.floor(sec/60); const s=Math.floor(sec%60); const cs=Math.floor((sec%1)*100); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`; }
  function shade(hex, amt){ let c=hex.replace('#',''); if(c.length===3)c=c.split('').map(ch=>ch+ch).join(''); const n=parseInt(c,16); let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt; r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255); return `rgb(${r},${g},${b})`; }

  function resize(){ const ratio=Math.min(window.devicePixelRatio||1,2); state.pixelRatio=ratio; state.width=Math.floor(window.innerWidth); state.height=Math.floor(window.innerHeight); canvas.width=Math.floor(state.width*ratio); canvas.height=Math.floor(state.height*ratio); canvas.style.width=state.width+'px'; canvas.style.height=state.height+'px'; ctx.setTransform(ratio,0,0,ratio,0,0); }
  function tick(time){ state.now=time; const dt=Math.min(.05, (time-state.last)/1000 || 0); state.last=time; state.idleScroll += dt*160; updateRace(dt); render(); requestAnimationFrame(tick); }

  function bindEvents(){
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e)=>{ state.keys[e.code]=true; if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault(); if(e.code==='KeyP') togglePause(); if(e.code==='KeyR' && state.race) startRace(); });
    window.addEventListener('keyup', (e)=>{ state.keys[e.code]=false; });
    document.addEventListener('click', (e)=>{
      const car=e.target.closest('[data-car]'); if(car) selectCar(car.dataset.car);
      const track=e.target.closest('[data-track]'); if(track) selectTrack(track.dataset.track);
      const diff=e.target.closest('[data-difficulty]'); if(diff) selectDifficulty(diff.dataset.difficulty);
      const buy=e.target.closest('[data-buy]'); if(buy) buyOrSelectCar(buy.dataset.buy);
    });
    $('openGarage').addEventListener('click', ()=>garagePanel.classList.add('active'));
    $('closeGarage').addEventListener('click', ()=>garagePanel.classList.remove('active'));
    $('randomTrack').addEventListener('click', ()=>selectTrack(TRACKS[Math.floor(Math.random()*TRACKS.length)].id));
    $('startRace').addEventListener('click', startRace);
    $('resetProgress').addEventListener('click', ()=>{ if(confirm('Сбросить монеты, покупки и рекорды?')) { state.progress=defaultProgress(); state.selectedCar='starter'; state.selectedTrack='green'; state.selectedDifficulty='normal'; saveProgress(); renderMenu(); } });
    $('installInfo').addEventListener('click', ()=>iosInfo.classList.add('active'));
    $('closeIosInfo').addEventListener('click', ()=>iosInfo.classList.remove('active'));
    $('pauseBtn').addEventListener('click', togglePause);
    $('menuBtn').addEventListener('click', ()=>{ setMode('menu'); renderMenu(); });
    $('againBtn').addEventListener('click', startRace);
    $('toMenuBtn').addEventListener('click', ()=>{ setMode('menu'); renderMenu(); });
    document.querySelectorAll('[data-touch]').forEach(btn=>{
      const name=btn.dataset.touch;
      const on=(ev)=>{ ev.preventDefault(); state.touch[name]=true; };
      const off=(ev)=>{ ev.preventDefault(); state.touch[name]=false; };
      btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  function togglePause(){ if(state.mode==='race') setMode('pause'); else if(state.mode==='pause') setMode('race'); }

  resize(); bindEvents(); renderMenu(); requestAnimationFrame(tick);
})();
