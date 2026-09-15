/* Skyrush: dependency-free, world-space arcade flight and Canvas 3D renderer. */
(() => {
  'use strict';
  const TEXT = globalThis.SKYRUSH_TEXT;
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  let ctx = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2, keys = new Set();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const ground = (x, z) => -35 + 17 * Math.sin(x / 240) * Math.cos(z / 260) + 9 * Math.sin(z / 125 + x / 180);
  const forward = (yaw, pitch = 0) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
  let width, height, focal, state = 'title', ship, enemies = [], relays = [], bolts = [], particles = [], pickups = [], rings = [], shockwaves = [];
  let wave=0, waveDelay=0, introTime=0, finalIntroTime=0, popups=[], pauseFrom='playing', gateDanger=false, gateAlarmReady=true, gateSafeTime=0, lowHealthWarned=false;
  const WAVE_COUNT=10;
  let boss, time = 0, elapsed = 0, kills = 0, score = 0, combo = 0, comboTime = 0, destroyed = 0, failureReason = '';
  let flash = 0, messageTime = 0, shotTime = 0, missileTime = 0, boostTime = 0;
  let camera, selected = null, best = 0, muted = false, audio, music, salvage = 0, freeUpgrades = 0, difficulty = 'normal', noMouseSteering = false;
  let effectsVolume = .85, musicVolume = .15;
  const RELAY_RESPAWN_SECONDS = 100/1.5;
  let pointer = { active: false, x: 0, y: 0 }, last = performance.now();
  try {
    best = Number(localStorage.getItem('skyrush-best')) || 0;
    muted = localStorage.getItem('skyrush-muted') === 'true';
    const storedEffects = localStorage.getItem('skyrush-effects-volume');
    const storedMusic = localStorage.getItem('skyrush-music-volume');
    if (storedEffects !== null) effectsVolume = clamp(Number(storedEffects), 0, 1);
    if (storedMusic !== null) musicVolume = clamp(Number(storedMusic), 0, .2);
  } catch {}
  function resize() {
    width = innerWidth; height = innerHeight; const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); focal = Math.min(width, height * 1.65) * .79;
  }
  addEventListener('resize', resize); resize();
  function sound(freq = 300, duration = .1, type = 'sine', volume = .04, end = freq / 2) {
    if (muted || !audio) return;
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    osc.type = type; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume * effectsVolume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(now + duration);
  }
  function jingle(notes, volume = .08) {
    if (muted || !audio) return;
    const start = audio.currentTime;
    notes.forEach(([frequency, offset, duration]) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(volume * effectsVolume, start + offset);
      gain.gain.exponentialRampToValueAtTime(.001, start + offset + duration);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(start + offset); osc.stop(start + offset + duration);
    });
  }
  const waveClearJingle = () => jingle([[523,.00,.12],[659,.12,.12],[784,.24,.22]], .06);
  const victoryJingle = () => jingle([[392,.00,.16],[523,.15,.16],[659,.30,.16],[784,.45,.40]], .09);
  const healthJingle = () => jingle([[784,.00,.10],[988,.09,.16]], .045);
  const upgradeJingle = () => jingle([[659,.00,.09],[784,.08,.10],[988,.17,.18]], .06);
  const lowHealthJingle = () => jingle([[330,.00,.08],[220,.11,.14]], .055);
  const gateAlarmJingle = () => jingle([[220,.00,.12],[220,.18,.12],[220,.36,.12]], .065);
  const defeatJingle = () => jingle([[247,.00,.16],[196,.15,.20],[147,.34,.42]], .075);
  function enableAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); } catch {} }
  function syncMusic() {
    if (!music) return;
    music.volume = muted ? 0 : musicVolume;
  }
  function startMusic() {
    music ||= new Audio('Star Fox - OST - Corneria.mp3');
    music.loop = true; syncMusic();
    music.play().catch(() => {});
  }
  function announce(text, duration = 5) {
    if (text.includes('WAVE CLEAR')) {
      text = TEXT.waveClear; duration = 4; waveClearJingle();
    } else if (text.includes('Incoming')) {
      text = `${TEXT.incoming} ${wave}`; duration = 3;
    }
    $('message').classList.toggle('boss-warning', text.includes('BOSS MISSILE'));
    $('message').textContent = text; sizeMessage(); messageTime = duration;
  }
  function sizeMessage(){
    const message=$('message');
    const warning=message.classList.contains('boss-warning');
    const measure=document.createElement('canvas').getContext('2d'),style=getComputedStyle(message);
    measure.font=style.font;
    const textWidth=measure.measureText(message.textContent).width+Math.max(0,message.textContent.length-1)*(parseFloat(style.letterSpacing)||0);
    message.style.width=`${Math.ceil(warning?textWidth+22:Math.max(textWidth*2,textWidth+36))}px`;
  }
  addEventListener('resize',sizeMessage);
  document.fonts?.ready.then(sizeMessage);
  function panel(html) { $('overlay').innerHTML = `<section class="panel">${html.replaceAll('repair hull','repair health').replaceAll('your hull failed','your health failed')}</section>`; $('overlay').querySelector('button')?.focus(); }
  const upgrades = {
    speed: {name:'Improve speed',cost:70,step:45,max:7},
    damage: {name:'More damage',cost:70,step:45,max:7},
    rate: {name:'Improve fire rate',cost:70,step:45,max:7},
    multishot: {name:'More shots',cost:260,step:190,max:3}
  };
  const MAX_LEVEL=7;
  function legacyUpgradeDetail(id,lv) {
    const n=Math.min(lv+1,MAX_LEVEL);
    if(id==='speed')return `${105+22*lv} → ${105+22*n} m/s`;
    if(id==='damage')return `Blaster ${18+8*lv} → ${18+8*n} damage<br>Rocket ${150+60*lv} → ${150+60*n} damage`;
    return `Blaster ${(1/.15*(1+.22*lv)).toFixed(1)} → ${(1/.15*(1+.22*n)).toFixed(1)} shots/s<br>Rocket ${(4/(1+.22*lv)).toFixed(1)} → ${(4/(1+.22*n)).toFixed(1)}s reload`;
  }
  // Use colour instead of a tiny arrow: this makes each upgrade card read as current value, then next value.
  function upgradeDetail(id, lv) {
    const n = Math.min(lv + 1, upgrades[id].max);
    const change = (before, after, unit) => `<span class="value-before">${before}</span><span class="value-label"> TO </span><span class="value-after">${after}</span> ${unit}`;
    if (id === 'speed') return change(105 + 22 * lv, 105 + 22 * n, 'm/s');
    if (id === 'damage') return `Blaster ${change(18 + 8 * lv, 18 + 8 * n, 'damage')}<br>Rocket ${change(150 + 60 * lv, 150 + 60 * n, 'damage')}`;
    if (id === 'multishot') return `Blaster ${change(2 + lv, 3 + lv, 'bolts per volley')}<br>Rocket ${change(1 + lv, 2 + lv, 'rockets per salvo')}`;
    return `Blaster ${change((1/.15*(1+.22*lv)).toFixed(1), (1/.15*(1+.22*n)).toFixed(1), 'shots/s')}<br>Rocket ${change((4/(1+.22*lv)).toFixed(1), (4/(1+.22*n)).toFixed(1), 's reload')}`;
  }
  const route = [{x:-1100,y:180,z:1050},{x:800,y:200,z:850},{x:850,y:160,z:-150},{x:-750,y:190,z:-450},{x:0,y:150,z:-1250}];
  const routeLengths = route.slice(1).map((p,i)=>distance(p,route[i]));
  const routeLength = routeLengths.reduce((a,b)=>a+b,0);
  const entryDx=route[1].x-route[0].x,entryDz=route[1].z-route[0].z,entryLength=Math.hypot(entryDx,entryDz);
  const startPortal={x:route[0].x-entryDx/entryLength*340,y:route[0].y,z:route[0].z-entryDz/entryLength*340};
  const boostCapacity = () => 3;
  const rechargeTime = () => 10;
  const upgradeCost = () => 70 + Object.values(ship.levels).reduce((sum, level) => sum + level, 0) * 45;
  const upgradesRemaining = () => Object.entries(upgrades).some(([id,u]) => ship.levels[id] < u.max);
  function upgradeLock(id){
    if(id!=='multishot')return '';
    if(wave<3)return 'UNLOCKS IN WAVE 3';
    if(ship.levels.multishot>0&&wave<=ship.multishotWave+1)return `AVAILABLE IN WAVE ${ship.multishotWave+2}`;
    return '';
  }
  const hasAvailableUpgrade = () => Object.entries(upgrades).some(([id,u]) => ship.levels[id]<u.max&&!upgradeLock(id));

  function randomWorldPoint(used, minimumDistance = 300) {
    for (let attempt=0;attempt<80;attempt++) {
      const point = {x:-1250+Math.random()*2500,z:-1250+Math.random()*2500};
      if (Math.hypot(point.x,point.z+1020)<minimumDistance) continue;
      if (used.every(other=>Math.hypot(point.x-other.x,point.z-other.z)>minimumDistance)) return point;
    }
    return {x:(Math.random()-.5)*2100,z:(Math.random()-.5)*2100};
  }
  // Main screen copy lives in text.js; this renderer keeps the launch UI separate from flight logic.
  function title() {
    state='title'; keys.clear(); pointer.active=false; selected=null; music?.pause(); $('hud').hidden=true;
    ship={x:0,y:110,z:-1020,yaw:.35,pitch:-.08,bank:0,levels:{speed:0,damage:0,rate:0,multishot:0}};
    relays=makeRelays(); enemies=[]; boss=null; rings=makeRings(); bolts=[]; particles=[]; pickups=[];shockwaves=[];boostTime=0;
    const firing=noMouseSteering?'CTRL':'LEFT CLICK', steering=noMouseSteering?'WASD':'WASD / RIGHT MOUSE';
    panel(`<h1>${TEXT.title.heading}</h1><p>${TEXT.title.description}</p><button class="primary" id="launch">${TEXT.title.start}</button><button class="secondary" id="mode">${difficulty==='normal'?TEXT.title.standard:TEXT.title.rookie}</button><button class="secondary" id="steeringMode">${noMouseSteering?TEXT.title.noMouseSteering:TEXT.title.mouseSteering}</button><div class="controls"><div><b>${steering}</b> ${TEXT.controls.steer}</div><div><b>${firing}</b> ${TEXT.controls.fire}</div><div><b>F</b> ${TEXT.controls.rocket}</div><div><b>SPACE</b> ${TEXT.controls.drive}</div><div><b>Q</b> ${TEXT.controls.boost}</div><div><b>SHIFT + DIRECTION</b> ${TEXT.controls.tightTurn}</div></div><div class="note">Fill the power bar to choose an upgrade. Green orbs restore health.<br><a href="../index.html">GAME STUDIO</a> · BEST ${best.toLocaleString()}</div>`);
    $('launch').onclick=start; $('mode').onclick=()=>{difficulty=difficulty==='normal'?'rookie':'normal';title();};
    $('steeringMode').onclick=()=>{noMouseSteering=!noMouseSteering;title();};
  }
  function makeRelays() {
    const used=[];
    return Array.from({length:6},(_,i)=>{
      const point=randomWorldPoint(used,340); used.push(point);
      const kind=i%3,hp=[150,330,220][kind],y=ground(point.x,point.z)+120+(i%2)*35;
      return {...point,y,hp,maxHp:hp,baseHp:hp,radius:32,type:'relay',kind,reward:[45,90,70][kind],respawn:0};
    });
  }
  function makeRings(){
    const used=[];
    return Array.from({length:5},()=>{const point=randomWorldPoint(used,360);used.push(point);return {...point,y:ground(point.x,point.z)+115+Math.random()*65,cooldown:0};});
  }
  function start(){
    enableAudio(); startMusic(); keys.clear();pointer.active=false;
    ship={x:0,y:110,z:-1020,yaw:0,pitch:0,bank:0,speed:0,driving:true,weapon:0,hp:100,maxHp:100,charges:3,recharge:0,damage:18,fireRate:.15,invulnerable:2,multishotWave:-99,multishotSeen:false,levels:{speed:0,damage:0,rate:0,multishot:0}};
    relays=makeRelays();rings=makeRings();bolts=[];particles=[];pickups=[];shockwaves=[];
    elapsed=kills=score=combo=comboTime=destroyed=flash=shotTime=missileTime=boostTime=salvage=freeUpgrades=0;failureReason='';
    wave=0;waveDelay=0;popups=[];selected=null;introTime=0;finalIntroTime=0;gateDanger=false;gateAlarmReady=true;gateSafeTime=0;lowHealthWarned=false;spawnWave();state='intro';$('overlay').innerHTML='';$('hud').hidden=true;
  }

  function pause(){
    if(state==='playing'||state==='intro'||state==='finalIntro'){
      pauseFrom=state; state='paused'; keys.clear(); pointer.active=false; music?.pause();
      const firing=noMouseSteering?'CTRL':'LEFT CLICK', steering=noMouseSteering?'WASD':'WASD / RIGHT MOUSE';
      panel(`<h1>${TEXT.pause}</h1><div class="controls"><div><b>${steering}</b> ${TEXT.controls.steer}</div><div><b>${firing}</b> ${TEXT.controls.fire}</div><div><b>F</b> ${TEXT.controls.rocket}</div><div><b>SPACE</b> ${TEXT.controls.drive}</div><div><b>Q / SHIFT</b> ${TEXT.controls.boost} / ${TEXT.controls.tightTurn}</div></div><div class="audio-settings"><label>SFX <input id="effectsVolume" type="range" min="0" max="100" value="${Math.round(effectsVolume*100)}"></label><label>MUSIC <input id="musicVolume" type="range" min="0" max=".2" step=".01" value="${musicVolume.toFixed(2)}"></label></div><button class="primary" id="resume">RESUME</button><button class="secondary" id="restart">RESTART</button><button class="secondary" id="quit">QUIT GAME</button>`);
      $('effectsVolume').oninput=e=>{effectsVolume=e.target.value/100;try{localStorage.setItem('skyrush-effects-volume',effectsVolume);}catch{}};
      $('musicVolume').oninput=e=>{musicVolume=Number(e.target.value);syncMusic();try{localStorage.setItem('skyrush-music-volume',musicVolume);}catch{}};
      $('resume').onclick=resume; $('restart').onclick=start; $('quit').onclick=title;
    } else if(state==='paused') resume();
  }
  function resume(){keys.clear();state=state==='paused'?pauseFrom:'playing';$('overlay').innerHTML='';if(state==='playing'||state==='intro'||state==='finalIntro')startMusic();last=performance.now();}
  function fireRocket(){if(state==='playing'&&missileTime<=0)fire(true);}
  function switchDrive(){if(state!=='playing')return;ship.driving=!ship.driving;if(!ship.driving){ship.speed=0;boostTime=0;}}
  $('pause').onclick=pause;$('weapon').onclick=fireRocket;$('drive').onclick=switchDrive;

  $('sound').textContent=muted?'SOUND OFF':'SOUND ON';
  $('sound').onclick=()=>{muted=!muted;enableAudio();syncMusic();$('sound').textContent=muted?'SOUND OFF':'SOUND ON';try{localStorage.setItem('skyrush-muted',muted);}catch{}};
  const controls=['Space','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','KeyF','ControlLeft','ControlRight'];
  addEventListener('keydown',event=>{
    if(controls.includes(event.code)&&state==='playing')event.preventDefault();
    if((event.code==='Escape'||event.code==='KeyP')&&!event.repeat){pause();return;}
    if(state==='intro'&&event.code==='Space'){introTime=6;event.preventDefault();return;}
    if(state==='finalIntro'&&event.code==='Space'){finalIntroTime=6;event.preventDefault();return;}
    if(!event.repeat&&event.code==='KeyF')fireRocket();
    if(!event.repeat&&event.code==='Space')switchDrive();
    if(state==='playing'&&event.code==='KeyQ'&&!event.repeat&&ship.charges>0&&boostTime<=0){if(!ship.driving)ship.driving=true;ship.charges--;boostTime=.9;sound(160,.25,'sine',.05,650);}
    if(state==='playing')keys.add(event.code);
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{keys.clear();if(state==='playing'||state==='intro'||state==='finalIntro')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='playing'||state==='intro'||state==='finalIntro'))pause();});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;enableAudio();if(!noMouseSteering&&e.button===0)keys.add('Mouse');if(!noMouseSteering&&e.button===2)pointer.active=true;});
  addEventListener('pointerup',e=>{if(e.button===0)keys.delete('Mouse');if(e.button===2)pointer.active=false;});
  addEventListener('pointermove',e=>{pointer.x=clamp((e.clientX/width-.5)*2.8,-1,1);pointer.y=clamp((.5-e.clientY/height)*2.8,-1,1);});
  const held=(...codes)=>codes.some(c=>keys.has(c));
  function burst(p,color,count=22,force=65){for(let i=0;i<count;i++)particles.push({x:p.x,y:p.y,z:p.z,vx:(Math.random()-.5)*force,vy:(Math.random()-.3)*force,vz:(Math.random()-.5)*force,life:.4+Math.random()*.8,color,size:2+Math.random()*3});}
  function hurt(amount){
    if(ship.invulnerable>0||state!=='playing')return;
    const previousHp=ship.hp;
    ship.hp-=amount*(difficulty==='rookie'?.55:1);ship.invulnerable=.55;flash=.6;sound(85,.2,'sawtooth',.07,30);
    if(previousHp>=30&&ship.hp<30&&!lowHealthWarned){lowHealthWarned=true;lowHealthJingle();}
    if(ship.hp<=0)finish(false,TEXT.failure.health);
  }
  function award(points){combo=Math.min(combo+1,8);comboTime=9;score+=points*(1+Math.floor(combo/3));}
  function damage(target,amount,rocket=false){
    if(target.hp<=0||state!=='playing')return;
    target.hp-=amount*(target.kind===1&&!rocket?.7:1);burst(target,'#9effed',4,22);sound(340,.05,'triangle',.025);
    if(target.hp>0)return;
    burst(target,'#ffb576',target.type==='boss'?100:35,140);sound(100,.5,'sawtooth',.07,22);
    award(target.type==='boss'?3000:target.reward*3);destroyed++;kills++;
    const upgradePower=target.type==='relay'?Math.round(target.reward*(1+(wave-1)*.20)):0;
    salvage+=upgradePower;
    if(target.type==='relay') target.respawn=RELAY_RESPAWN_SECONDS;
    if(upgradePower)popups.push({x:target.x,y:target.y,z:target.z,reward:upgradePower,life:1.6});
  }




  function upgrade(free = false){
    if(!hasAvailableUpgrade() || (!free && salvage<upgradeCost()))return;
    state='upgrade';keys.clear();pointer.active=false;
    const highlightMultishot=!ship.multishotSeen&&ship.levels.multishot===0&&!upgradeLock('multishot');
    panel(`<div class="upgrade-heading"><h1>UPGRADES</h1><span>${free?'WAVE CLEAR · ONE FREE UPGRADE':'CHOOSE ONE UPGRADE'}</span></div><div class="ship-preview"><canvas id="upgradePreview" width="640" height="220" aria-label="Three-dimensional ship upgrade preview"></canvas><span>SHIP PREVIEW</span></div><div class="choices">${Object.entries(upgrades).map(([id,u])=>{const lv=ship.levels[id],cost=upgradeCost(id),max=u.max,lock=upgradeLock(id),isNew=id==='multishot'&&highlightMultishot;return `<button class="choice${isNew?' new-upgrade':''}" data-upgrade="${id}" ${lv>=max||(!free&&salvage<cost)||lock?'disabled':''}><b>${u.name}</b><div class="choice-level">LV ${lv}/${max}</div><span>${lv>=max?'MAXED':upgradeDetail(id,lv)}</span><strong>${lv>=max?'MAX LEVEL':lock||(free?'FREE UPGRADE':'CHOOSE UPGRADE')}</strong></button>`;}).join('')}</div>`);
    if(highlightMultishot)ship.multishotSeen=true;
    startUpgradePreview();
    document.querySelectorAll('[data-upgrade]').forEach(button=>button.onclick=()=>{
      const id=button.dataset.upgrade,cost=upgradeCost(id),max=upgrades[id].max;
      if(ship.levels[id]>=max||(!free&&salvage<cost)||upgradeLock(id))return;
      if(free)freeUpgrades=Math.max(0,freeUpgrades-1);else salvage-=cost;
      ship.levels[id]++;
      if(id==='multishot')ship.multishotWave=wave;
      ship.damage=18+8*ship.levels.damage;ship.fireRate=.15/(1+.22*ship.levels.rate);
      upgradeJingle();
      if(!free && hasAvailableUpgrade() && salvage>=upgradeCost())upgrade();else resume();
    });
  }
  // A fixed three-quarter camera keeps intersecting modules in a stable depth order.
  function startUpgradePreview(){
    const preview=$('upgradePreview'); if(!preview)return;
    const previewContext=preview.getContext('2d');
    const spinStart=performance.now();
    const render=()=>{
      if(state!=='upgrade'||!preview.isConnected)return;
      const saved={ctx,width,height,focal,camera,faces};
      try {
        ctx=previewContext; width=preview.width; height=preview.height; focal=400; faces=[];
        camera={x:0,y:48,z:-135,yaw:0,pitch:-.30,cy:1,sy:0,cp:Math.cos(-.30),sp:Math.sin(-.30)};
        ctx.fillStyle='#071923';ctx.fillRect(0,0,width,height);
        fighter({...ship,x:0,y:0,z:0,yaw:.62+(performance.now()-spinStart)*.0005,pitch:0,bank:0},true);
        paintFaces();
      } finally { ({ctx,width,height,focal,camera,faces}=saved); }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }
  function finish(won, reason = '') {
    state=won?'victory':'defeat'; keys.clear(); pointer.active=false;
    music?.pause();
    if(won){score+=Math.max(0,Math.round(2400-elapsed*3))+Math.round(ship.hp*10);victoryJingle();}
    else defeatJingle();
    best=Math.max(best,score);try{localStorage.setItem('skyrush-best',best);}catch{}
    if(!won) failureReason=reason||failureReason||TEXT.failure.health;
    const copy=won?TEXT.victory:TEXT.defeat, rank=won?(score>14000?'S':score>9500?'A':'B'):'—';
    const resultHeading=won?copy.heading:failureReason, resultBody=won?`<p>${copy.body}</p>`:'';
    panel(`<div class="eyebrow">${copy.eyebrow}</div><h1>${resultHeading}</h1>${resultBody}<div class="results"><div><strong>${score.toLocaleString()}</strong><span>SCORE</span></div><div><strong>${rank}</strong><span>RANK</span></div><div><strong>${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}</strong><span>FLIGHT TIME</span></div><div><strong>${kills}</strong><span>DESTROYED</span></div></div><button class="primary" id="again">FLY AGAIN</button><button class="secondary" id="menu">MAIN MENU</button><div class="note">PERSONAL BEST ${best.toLocaleString()}</div>`);
    $('again').onclick=start; $('menu').onclick=title;
  }
  function waveTargets(){return [...enemies,...(boss?[boss]:[])].filter(e=>e.hp>0);}
  function placeEnemy(e){
    let d=e.travel,i=0;while(i<routeLengths.length-1 && d>routeLengths[i])d-=routeLengths[i++];
    const a=route[i],b=route[i+1],segmentLength=routeLengths[i],t=d/segmentLength,laneScale=e.type==='boss'?Math.max(.42,1-e.travel/routeLength):1-e.travel/routeLength,offset=e.lane*laneScale;
    e.x=lerp(a.x,b.x,t)+offset;e.y=lerp(a.y,b.y,t)+Math.sin(e.travel/220+e.lane)*18;e.z=lerp(a.z,b.z,t);e.yaw=Math.atan2(b.x-a.x,b.z-a.z);
    e.vx=(b.x-a.x)/segmentLength*e.speed-e.lane/routeLength*e.speed;
    e.vy=(b.y-a.y)/segmentLength*e.speed+Math.cos(e.travel/220+e.lane)*18/220*e.speed;
    e.vz=(b.z-a.z)/segmentLength*e.speed;
  }
  function spawnWave(){
    wave++;waveDelay=0;boss=null;bolts=[];shockwaves=[];selected=null;
    const enemyCount=4+wave+Math.max(0,Math.floor((wave-5)/2));
    enemies=Array.from({length:enemyCount},(_,i)=>{
      const kind=wave>=5&&i%3===0?3:i%3;
      const strength=1+(wave-1)*.42+Math.max(0,wave-5)*.12,hp=[135,390,240,175][kind]*strength;
      const e={hp,maxHp:hp,radius:kind===1?32:kind===3?17:23,type:'enemy',kind,speed:[88,38,59,132][kind]+wave*5+Math.max(0,wave-5)*2,travel:180+i*135,lane:(i%4-1.5)*145,reward:[55,105,80,115][kind],pitch:0};placeEnemy(e);return e;
    });
    const final=wave===10,hp=final?28000:1200+wave*1050;
    boss={hp,maxHp:hp,radius:final?155:90,type:'boss',final,speed:final?42:28+wave*3,travel:0,lane:wave===8?-240:0,reward:300+wave*50,missileCooldown:5+Math.random()*2,spawnCooldown:3,phaseTwo:false,shockwaveCooldown:0};placeEnemy(boss);
    if(wave===8){
      const twinHp=hp*.86,twin={hp:twinHp,maxHp:twinHp,radius:90,type:'boss',kind:1,twin:true,speed:50,travel:0,lane:240,reward:650,missileCooldown:6+Math.random()*2};
      placeEnemy(twin);enemies.push(twin);
    }
    if(final){finalIntroTime=0;state='finalIntro';$('hud').hidden=true;burst(boss,'#9b64d8',90,190);}
  }
  function spawnFinalEscorts(source){
    if(enemies.filter(e=>e.spawned&&e.hp>0).length>=10)return;
    for(let i=0;i<2;i++){
      const kind=(wave+i)%4,hp=[135,390,240,175][kind]*5.6;
      const escort={hp,maxHp:hp,radius:kind===1?32:kind===3?17:23,type:'enemy',kind,spawned:true,speed:[88,38,59,132][kind]+65,travel:Math.max(0,source.travel-80-i*70),lane:(i?1:-1)*(120+Math.random()*90),reward:0,pitch:0};
      placeEnemy(escort);enemies.push(escort);
    }
    burst(source,'#8a54bd',30,105);announce('FINAL BOSS / REINFORCEMENTS DEPLOYED',1.5);
  }
  function fireShockwave(source){
    shockwaves.push({x:source.x,y:source.y,z:source.z,radius:35,previousRadius:35,speed:310,height:86,life:8,hit:false});
    jingle([[110,.00,.18],[82,.08,.35]],.085);announce('SHOCKWAVE / FLY ABOVE OR BELOW',2);
  }
  function targets() { return [...relays, ...enemies, ...(boss ? [boss] : [])].filter(t => t.hp > 0); }
  function aimTarget() {
    const f = forward(ship.yaw, ship.pitch), lockDistance=840; let bestTarget = null, bestAim = .94;
    for (const t of targets()) {
      const d = distance(ship, t), dot = ((t.x - ship.x) * f.x + (t.y - ship.y) * f.y + (t.z - ship.z) * f.z) / d;
      if (d < lockDistance && dot > bestAim) { bestAim = dot; bestTarget = t; }
    }
    return bestTarget;
  }
  function fire(missile = false) {
    if (missile && !selected) { announce('NO LOCK / Center a target in your sights.',2); missileTime=.4; return; }
    const f = forward(ship.yaw, ship.pitch);
    const blasterShots=2+ship.levels.multishot, rocketShots=1+ship.levels.multishot;
    const shotCount=missile?rocketShots:blasterShots;
    for (const side of Array.from({length:shotCount},(_,i)=>i-(shotCount-1)/2)) {
      const p = transform([missile?side*13:side*18/(blasterShots-1),0,22+Math.floor(ship.levels.damage/2)*3],ship,ship.yaw,ship.pitch,ship.bank);
      let direction = f;
      if (selected) {
        const speed = missile ? 520 : 620;
        let travelTime = distance(p, selected) / speed;
        // Predict the position at impact. Fast scouts are otherwise beyond the bolt when it arrives.
        for (let step=0;step<3;step++) {
          const aim = {x:selected.x+(selected.vx||0)*travelTime,y:selected.y+(selected.vy||0)*travelTime,z:selected.z+(selected.vz||0)*travelTime};
          travelTime = distance(p, aim) / speed;
        }
        const aim = {x:selected.x+(selected.vx||0)*travelTime,y:selected.y+(selected.vy||0)*travelTime,z:selected.z+(selected.vz||0)*travelTime};
        const d = distance(p, aim); direction = {x:(aim.x-p.x)/d,y:(aim.y-p.y)/d,z:(aim.z-p.z)/d};
      }
      const curveDirection={x:Math.cos(ship.yaw),y:0,z:-Math.sin(ship.yaw)};
      bolts.push({ ...p, age:0, vx: direction.x * (missile?520:620), vy: direction.y * (missile?520:620), vz: direction.z * (missile?520:620), life: 2.3, hostile: false, missile, target: missile ? selected : null, curve: missile ? side*.18 : 0, curveDirection, damage: missile ? (150 + 60 * ship.levels.damage) : ship.damage / 2 });
    }
    if (missile) { missileTime = 4 / (1 + .22 * ship.levels.rate); sound(180, .3, 'sawtooth', .055, 650); }
    else { shotTime = ship.fireRate; sound(850, .065, 'triangle', .035, 180); }
  }
  function fireBossMissile(source) {
    const dx=ship.x-source.x,dy=ship.y-source.y,dz=ship.z-source.z,d=Math.hypot(dx,dy,dz)||1, speed=270;
    bolts.push({x:source.x,y:source.y,z:source.z,vx:dx/d*speed,vy:dy/d*speed,vz:dz/d*speed,life:8,hostile:true,missile:true,radius:28,damage:25});
    sound(95,.28,'sawtooth',.07,45); announce(TEXT.bossMissile,1.5);
  }

  // Closest point on a segment avoids tunnelling at high laser/boost velocities.
  function segmentHit(a, b, p, radius) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / (dx * dx + dy * dy + dz * dz || 1), 0, 1);
    return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y, a.z + t * dz - p.z) < radius;
  }
  function update(dt) {
    elapsed+=dt; shotTime-=dt; missileTime-=dt; ship.invulnerable-=dt; boostTime=Math.max(0,boostTime-dt); flash=Math.max(0,flash-dt*2);
    comboTime-=dt; if(comboTime<=0)combo=0;
    messageTime-=dt; if(messageTime<=0){$('message').textContent='';$('message').classList.toggle('boss-warning',false);}
    if(ship.charges<boostCapacity()) { ship.recharge+=dt; if(ship.recharge>=rechargeTime()){ship.recharge-=rechargeTime();ship.charges++;} } else ship.recharge=0;
    const turn=(held('KeyD','ArrowRight')?1:0)-(held('KeyA','ArrowLeft')?1:0)+(pointer.active?pointer.x:0);
    const pitch=(held('KeyS','ArrowDown')?1:0)-(held('KeyW','ArrowUp')?1:0)+(pointer.active?pointer.y:0);
    const tight=held('ShiftLeft','ShiftRight') && (turn || pitch), turnRate=tight?2.8:1.12;
    ship.yaw+=clamp(turn,-1,1)*dt*turnRate; ship.pitch=clamp(ship.pitch+clamp(pitch,-1,1)*dt*(tight?1.8:.8),-.85,.85);
    if(!pitch && ship.driving)ship.pitch*=Math.exp(-dt*.8);
    ship.bank=lerp(ship.bank,-clamp(turn,-1,1)*(tight?.85:.5),1-Math.exp(-dt*5));
    const cruise=105+ship.levels.speed*22;
    ship.speed=ship.driving?lerp(ship.speed,(cruise+(boostTime>0?170:0))*(tight?.65:1),1-Math.exp(-dt*4)):boostTime>0?cruise+170:0;
    const before={x:ship.x,y:ship.y,z:ship.z},f=forward(ship.yaw,ship.pitch);
    ship.x+=f.x*ship.speed*dt;ship.y+=f.y*ship.speed*dt;ship.z+=f.z*ship.speed*dt;
    if(ship.y<ground(ship.x,ship.z)+16){ship.y=ground(ship.x,ship.z)+17;ship.pitch=.25;hurt(18);announce('TERRAIN / Pull up!',2);}
    if(state!=='playing')return;
    if(ship.y>540){ship.y=540;ship.pitch=Math.min(ship.pitch,0);}
    const radius=Math.hypot(ship.x,ship.z);
    if(radius>1750){announce('SECTOR EDGE / Turn toward the route.',2);if(radius>1950){ship.yaw=Math.atan2(-ship.x,-ship.z);ship.x*=1940/radius;ship.z*=1940/radius;}}
    for(const t of relays)if(t.hp<=0){t.respawn-=dt;if(t.respawn<=0){t.maxHp=(t.baseHp || [100,240,160][t.kind])*(1+Math.min(elapsed/240,.8));t.hp=t.maxHp;}}
    const active=waveTargets();
    for(const e of active){e.travel+=dt*e.speed*(difficulty==='rookie'?.78:1);if(e.travel>=routeLength){finish(false,TEXT.failure.gate);return;}placeEnemy(e);}
    gateDanger=active.some(e=>routeLength-e.travel<=routeLength*.2);
    if(gateDanger){
      gateSafeTime=0;
      if(gateAlarmReady){gateAlarmReady=false;gateAlarmJingle();announce(TEXT.gateAlert,2.5);}
    } else if(!gateAlarmReady) {
      gateSafeTime+=dt;
      if(gateSafeTime>=30)gateAlarmReady=true;
    }
    for(const attackBoss of active.filter(e=>e.type==='boss')){
      attackBoss.missileCooldown-=dt;
      if(attackBoss.missileCooldown<=0){fireBossMissile(attackBoss);attackBoss.missileCooldown=Math.max(2.8,7.5-wave*.45)+Math.random()*2;}
      if(!attackBoss.final)continue;
      if(attackBoss.travel<routeLength*.5){
        attackBoss.spawnCooldown-=dt;
        if(attackBoss.spawnCooldown<=0){spawnFinalEscorts(attackBoss);attackBoss.spawnCooldown=6.5;}
      }else{
        if(!attackBoss.phaseTwo){
          attackBoss.phaseTwo=true;attackBoss.hp=Math.min(attackBoss.maxHp,attackBoss.hp+attackBoss.maxHp*.3);attackBoss.shockwaveCooldown=2;
          burst(attackBoss,'#bf70ff',100,210);announce('FINAL BOSS / 30% CORE REGENERATION',2.5);
        }
        attackBoss.shockwaveCooldown-=dt;
        if(attackBoss.shockwaveCooldown<=0){fireShockwave(attackBoss);attackBoss.shockwaveCooldown=7;}
      }
    }
    for(const shockwave of shockwaves){
      shockwave.previousRadius=shockwave.radius;shockwave.radius+=shockwave.speed*dt;shockwave.life-=dt;
      const radial=Math.hypot(ship.x-shockwave.x,ship.z-shockwave.z);
      if(!shockwave.hit&&radial>=shockwave.previousRadius-24&&radial<=shockwave.radius+24&&Math.abs(ship.y-shockwave.y)<=shockwave.height/2){
        shockwave.hit=true;hurt(28);burst(ship,'#b66cff',34,125);
      }
    }
    shockwaves=shockwaves.filter(s=>s.life>0&&s.radius<2500);
    if(state!=='playing')return;
    if(!active.length){
      if(wave===WAVE_COUNT){finish(true);return;}
      if(waveDelay===0){
        waveDelay=12;
        announce('WAVE CLEAR · Upgrade and repair',4);
        if(hasAvailableUpgrade()){freeUpgrades++;upgrade(true);return;}
      }
      waveDelay=Math.max(.001,waveDelay-dt);
      if(waveDelay<=.001){spawnWave();if(wave!==10)announce(`WAVE ${wave} · Incoming`,3);}
    }
    popups.forEach(p=>{p.life-=dt;p.y+=dt*28;});popups=popups.filter(p=>p.life>0);
    selected=aimTarget();
    const firing = noMouseSteering ? held('ControlLeft','ControlRight') : held('Mouse');
    if(firing && shotTime<=0)fire(false);
    for(const t of targets())if(segmentHit(before,ship,t,t.radius+10)){hurt(15);ship.y+=15;ship.pitch=.3;}
    if(state!=='playing')return;
    for(const b of bolts){
      b.age=(b.age||0)+dt;b.life-=dt;if(b.life<=0)continue;
      const old={x:b.x,y:b.y,z:b.z};
      if(b.missile && b.target?.hp>0){
        const d=distance(b,b.target)||1,direct={x:(b.target.x-b.x)/d,y:(b.target.y-b.y)/d,z:(b.target.z-b.z)/d};
        const curve=Math.sin(b.age*9)*b.curve*Math.max(0,1-b.age/1.15),c=b.curveDirection;
        const length=Math.hypot(direct.x+c.x*curve,direct.y+c.y*curve,direct.z+c.z*curve)||1;
        b.vx=(direct.x+c.x*curve)/length*520;b.vy=(direct.y+c.y*curve)/length*520;b.vz=(direct.z+c.z*curve)/length*520;
      }
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
      if(b.hostile){
        if(segmentHit(old,b,ship,b.radius||22)){hurt(b.damage/(difficulty==='rookie'?.55:1));burst(ship,'#ff806f',36,130);b.life=0;}
        continue;
      }
      for(const t of targets())if(segmentHit(old,b,t,t.radius)){
        damage(t,b.damage,b.missile);b.life=0;
        if(b.missile){burst(t,'#ffcb85',24,100);for(const other of targets())if(other!==t && distance(other,t)<150)damage(other,b.damage*.6,true);}
        break;
      }
      if(state!=='playing')return;
      if(b.missile)particles.push({x:b.x,y:b.y,z:b.z,vx:0,vy:0,vz:0,life:.35,color:'#ffdca0',size:3});
    }
    bolts=bolts.filter(b=>b.life>0);
    for(const r of rings){r.cooldown=Math.max(0,r.cooldown-dt);if(r.cooldown===0 && segmentHit(before,ship,r,28)){r.cooldown=35;ship.hp=Math.min(100,ship.hp+30);if(ship.hp>=30)lowHealthWarned=false;burst(r,'#c4ff9d');healthJingle();announce(ship.hp===100?TEXT.healthFull:TEXT.healthPickup,2);}}
    if(state==='playing' && hasAvailableUpgrade() && salvage>=upgradeCost())upgrade();
  }

  // Camera-space projection, near-plane clipping, then painter-sorted low-poly faces.
  let faces = [];
  function view(p) {
    const dx = p.x - camera.x, dy = p.y - camera.y, dz = p.z - camera.z;
    const x = dx * camera.cy - dz * camera.sy, z = dx * camera.sy + dz * camera.cy;
    return { x, y: dy * camera.cp - z * camera.sp, z: dy * camera.sp + z * camera.cp };
  }
  function project(p) { const v = view(p); return v.z > 5 ? { x: width / 2 + v.x / v.z * focal, y: height * .48 - v.y / v.z * focal, z: v.z, scale: focal / v.z } : null; }
  function polygon(points, color, edge = null) {
    let vs = points.map(view), clipped = [];
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i], b = vs[(i + 1) % vs.length], ai = a.z >= 7, bi = b.z >= 7;
      if (ai) clipped.push(a);
      if (ai !== bi) { const t = (7 - a.z) / (b.z - a.z); clipped.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: 7 }); }
    }
    if (clipped.length < 3) return;
    const ps = clipped.map(v => ({ x: width / 2 + v.x / v.z * focal, y: height * .48 - v.y / v.z * focal }));
    if (ps.every(p => p.x < -50) || ps.every(p => p.x > width + 50) || ps.every(p => p.y < -50) || ps.every(p => p.y > height + 50)) return;
    faces.push({ ps, color, edge, z: clipped.reduce((sum, p) => sum + p.z, 0) / clipped.length, order:faces.length });
  }
  function transform(p, position, yaw = 0, pitch = 0, bank = 0, scale = 1) {
    const bx = (p[0] * Math.cos(bank) - p[1] * Math.sin(bank)) * scale, by = (p[0] * Math.sin(bank) + p[1] * Math.cos(bank)) * scale, bz = p[2] * scale;
    const y = by * Math.cos(pitch) + bz * Math.sin(pitch), z = bz * Math.cos(pitch) - by * Math.sin(pitch);
    return { x: position.x + bx * Math.cos(yaw) + z * Math.sin(yaw), y: position.y + y, z: position.z + z * Math.cos(yaw) - bx * Math.sin(yaw) };
  }
  function mesh(vertices, indices, colors, position, yaw = 0, pitch = 0, bank = 0, scale = 1) {
    const vs = vertices.map(v => transform(v, position, yaw, pitch, bank, scale));
    indices.forEach((face, i) => polygon(face.map(j => vs[j]), colors[i % colors.length]));
  }
  const fighterVertices = [[0,0,20],[-4,0,-9],[4,0,-9],[0,5,-3],[0,-3,-5],[-23,-1,-12],[23,-1,-12],[-5,1,2],[5,1,2],[0,10,-12],[0,0,-14]];
  const fighterFaces = [[0,1,3],[0,3,2],[0,4,1],[0,2,4],[1,5,7],[2,8,6],[1,2,3],[3,9,10],[1,4,2]];
  function fighter(p, player = false) {
    if(!player){mesh(fighterVertices,fighterFaces,p.kind===1?['#b99adb','#705686','#e1b8fa']:p.kind===0?['#ffc578','#c06b42','#ffdf99']:p.kind===3?['#8eeaff','#2489b2','#b9f5ff']:['#ff8e97','#9d4966','#f6b7b4'],p,p.yaw,0,0,p.kind===1?1.35:p.kind===3?.65:.85);return;}
    // A compact industrial catamaran: blunt cabin, exposed drive pods, separate weapon rails.
    const lv=p.levels || {}, engineTier=Math.floor((lv.speed||0)/2), gunTier=Math.floor((lv.damage||0)/2), rocketTier=Math.floor((lv.damage||0)/2);
    const bank=p.bank||0, pose=v=>transform(v,p,p.yaw,p.pitch||0,bank);
    const module=(v,sx,sy,sz,colors)=>mesh([[-sx,0,-sz],[sx,0,-sz],[sx,0,sz],[-sx,0,sz],[-sx,sy,-sz],[sx,sy,-sz],[sx,sy,sz],[-sx,sy,sz]],[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]],colors,pose(v),p.yaw,p.pitch||0,bank);
    for(let i=0;i<2+(lv.multishot||0);i++){
      const x=(i-(1+(lv.multishot||0))/2)*18/(1+(lv.multishot||0));
      module([x,-1,18+gunTier*3],1,2,3,['#36545c','#92ffd5','#527d79']);
    }
    module([0,-3,0],8,6,12,['#345768','#86aeb7','#d4e8de']);
    module([0,3,5],5,4,6,['#235060','#79dfd3','#376878']);
    module([0,-1,-6],18,2,3,['#466271','#b2ccca']);
    for(const side of [-1,1]){
      module([side*15,-3,-9],4+engineTier,7,10+engineTier*2,['#3a697b','#6796a4','#a4c7c5']);
      module([side*9,-2,13],2+gunTier,3+gunTier,7+gunTier*3,['#36545c','#92ffd5','#527d79']);
      module([side*21,-2,2],3+rocketTier,5,7+rocketTier*2,['#796052','#ffc085','#a08062']);
      for(let j=0;j<=rocketTier;j++)module([side*21+j*1.5,3,6],.65,1,3,['#ffda9b']);
      for(let j=0;j<=Math.floor((lv.rate||0)/2);j++)module([side*9,2,10+j*3],3,1,1,['#a6ffe3']);
      for(let j=0;j<1+Math.floor((lv.boost||0)/2);j++)module([side*15,5,-5-j*4],2,1,1,['#78cfff']);
      if(state==='title' || ship.driving || boostTime>0)polygon([pose([side*15-3,0,-20-engineTier*2]),pose([side*15,0,-28-engineTier*3-(boostTime>0?25:0)-Math.random()*7]),pose([side*15+3,0,-20-engineTier*2])],'#86eeff');
    }
  }

  function box(p, sx, sy, sz, colors, yaw = 0) {
    mesh([[-sx,0,-sz],[sx,0,-sz],[sx,0,sz],[-sx,0,sz],[-sx,sy,-sz],[sx,sy,-sz],[sx,sy,sz],[-sx,sy,sz]], [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]], colors, p, yaw);
  }
  function ring(p, radius, color, yaw = 0, thickness = 2) {
    const points = [], count = 32;
    for (let i = 0; i < count; i++) { const a = i / count * TAU; points.push(transform([Math.cos(a) * radius, Math.sin(a) * radius, 0], p, yaw)); }
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU, b = (i + 1) / count * TAU;
      polygon([points[i], points[(i + 1) % count], transform([Math.cos(b) * (radius - thickness), Math.sin(b) * (radius - thickness), 0], p, yaw), transform([Math.cos(a) * (radius - thickness), Math.sin(a) * (radius - thickness), 0], p, yaw)], color);
    }
  }
  function bossFighter(p){
    const final=p.final,scale=final?1.65:1;
    const vertices=[[0,0,100],[-45,0,-75],[45,0,-75],[0,28,-20],[0,-22,-15],[-115,0,-50],[115,0,-50],[-20,5,20],[20,5,20],[0,55,-65],[0,0,-80]];
    const colors=final?['#15131e','#282136','#090812','#372840','#1d1828','#4b2751','#713c72']:['#917c98','#645d7b','#352e49','#4e4462','#a76878','#774e69','#e78585'];
    mesh(vertices,fighterFaces,colors,p,p.yaw,0,0,scale);
    box({x:p.x,y:p.y-12*scale,z:p.z},13*scale,24*scale,20*scale,final?['#2a1535','#9d4c9b']:['#ff907f','#ffbc9a'],p.yaw);
    if(final){
      for(const side of [-1,1]){
        const pod=transform([side*112,0,-48],p,p.yaw);
        box({x:pod.x,y:pod.y-18,z:pod.z},22,36,34,['#0b0911','#33203d','#71406f'],p.yaw);
      }
      const crown=[[0,92,-45],[-38,24,-58],[0,28,-5],[38,24,-58],[0,-70,-55]].map(v=>transform(v,p,p.yaw,0,0,scale));
      polygon([crown[0],crown[1],crown[2]],'#4d2757');polygon([crown[0],crown[2],crown[3]],'#211528');polygon([crown[4],crown[2],crown[1]],'#130e1a');polygon([crown[4],crown[3],crown[2]],'#321b3a');
    }
  }
  function dimensionGate(p,color,yaw){
    const center=transform([0,0,.7],p,yaw),count=24,phase=time*.8;
    for(let i=0;i<count;i++){
      const a=i/count*TAU+phase,b=(i+1)/count*TAU+phase;
      const innerA=38+(i%3)*8,innerB=38+((i+1)%3)*8;
      polygon([center,transform([Math.cos(a)*innerA,Math.sin(a)*innerA,0],p,yaw),transform([Math.cos(b)*innerB,Math.sin(b)*innerB,0],p,yaw)],i%2?color+'42':'#b6fff04a');
    }
    ring(p,105,color,yaw,7);ring(p,84,'#b7fff0',yaw,2);ring(p,58,color+'aa',yaw,3);
  }
  function shockwaveCylinder(s){
    const count=40,half=s.height/2;
    for(let i=0;i<count;i++){
      const a=i/count*TAU,b=(i+1)/count*TAU;
      const bottomA={x:s.x+Math.cos(a)*s.radius,y:s.y-half,z:s.z+Math.sin(a)*s.radius};
      const bottomB={x:s.x+Math.cos(b)*s.radius,y:s.y-half,z:s.z+Math.sin(b)*s.radius};
      const topA={x:bottomA.x,y:s.y+half,z:bottomA.z},topB={x:bottomB.x,y:s.y+half,z:bottomB.z};
      polygon([bottomA,bottomB,topB,topA],i%2?'#a64aff4c':'#e5a0ff60','#d98aff88');
    }
  }
  function legacyHealingRing(p, active) {
    const radius = 43, points = [], center = {x:p.x,y:p.y,z:p.z};
    for (let i=0;i<24;i++) {
      const a=i/24*TAU;
      points.push({x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius,z:p.z});
    }
    for (let i=0;i<24;i++) polygon([center,points[i],points[(i+1)%24]], active ? '#ffcf7180' : '#57727835');
    ring(p,43,active?'#ffcf71':'#57727855',0,3);
    ring(p,48,active?'#ffcf7166':'#57727833',0,1);
    if (!active) return;
    polygon([{x:p.x-13,y:p.y+4,z:p.z},{x:p.x+13,y:p.y+4,z:p.z},{x:p.x+13,y:p.y-4,z:p.z},{x:p.x-13,y:p.y-4,z:p.z}],'#fff4c4');
    polygon([{x:p.x-4,y:p.y+13,z:p.z},{x:p.x+4,y:p.y+13,z:p.z},{x:p.x+4,y:p.y-13,z:p.z},{x:p.x-4,y:p.y-13,z:p.z}],'#fff4c4');
  }
  function healthSphere(p, active) {
    const radius=22,segments=10,vertices=[[0,radius,0]],faces=[];
    for(const y of [9,-9])for(let i=0;i<segments;i++){const a=i/segments*TAU;vertices.push([Math.cos(a)*20,y,Math.sin(a)*20]);}
    const bottom=vertices.length;vertices.push([0,-radius,0]);
    for(let i=0;i<segments;i++){
      const next=(i+1)%segments,upper=1+i,upperNext=1+next,lower=1+segments+i,lowerNext=1+segments+next;
      faces.push([0,upper,upperNext],[upper,lower,lowerNext,upperNext],[bottom,lowerNext,lower]);
    }
    mesh(vertices,faces,active?['#c4ff9d','#83d987','#e9ffd0','#68b87b','#a1e989']:['#536c70','#38565b'],p,time*.7,0,0);
    if(!active)return;
    // Attach a raised cross to the middle of one green equatorial face.
    const angle=TAU/segments/2, normal=[Math.cos(angle),0,Math.sin(angle)], tangent=[-Math.sin(angle),0,Math.cos(angle)];
    const badge=v=>[normal[0]*(20*Math.cos(angle)+v[2])+tangent[0]*v[0],v[1],normal[2]*(20*Math.cos(angle)+v[2])+tangent[2]*v[0]];
    for(const [sx,sy] of [[5,1.5],[1.5,7]]){
      const verts=[[-sx,-sy,0],[sx,-sy,0],[sx,sy,0],[-sx,sy,0],[-sx,-sy,.7],[sx,-sy,.7],[sx,sy,.7],[-sx,sy,.7]].map(badge);
      mesh(verts,[[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],['#fffbd8'],p,time*.7);
    }
  }
  function drawWorld() {
    faces = [];
    const cinematic=state==='intro'||state==='finalIntro'||(state==='paused'&&(pauseFrom==='intro'||pauseFrom==='finalIntro'));
    const step = cinematic?200:150, cx = cinematic?0:Math.floor(camera.x / step), cz = cinematic?0:Math.floor(camera.z / step), extent=cinematic?30:13;
    if(cinematic){
      polygon([{x:-50000,y:-65,z:-50000},{x:50000,y:-65,z:-50000},{x:50000,y:-65,z:50000},{x:-50000,y:-65,z:50000}],'#1e3f4d');
      if(faces.length)faces[faces.length-1].z=Infinity;
    }
    for (let x = cx - extent; x <= cx + extent; x++) for (let z = cz - extent; z <= cz + extent; z++) {
      const wx = x * step, wz = z * step;
      const a = { x: wx, y: ground(wx, wz), z: wz }, b = { x: wx + step, y: ground(wx + step, wz), z: wz }, c = { x: wx + step, y: ground(wx + step, wz + step), z: wz + step }, d = { x: wx, y: ground(wx, wz + step), z: wz + step };
      const tone = Math.round(20 + (a.y + 60) * .15), fog = clamp(distance(camera, a) / 2400, 0, 1);
      const color = `rgb(${Math.round(lerp(tone, 30, fog))},${Math.round(lerp(tone + 30, 63, fog))},${Math.round(lerp(tone + 36, 77, fog))})`;
      polygon([a,b,c], color, '#639a9d0b'); polygon([a,c,d], `rgb(${tone - 2},${tone + 27},${tone + 34})`, '#639a9d09');
    }
    // A deterministic skyline of faceted basalt spires, outside the combat space.
    for (let i = 0; i < 65; i++) {
      const a = i * 2.39996, r = 2150 + Math.sin(i * 7) * 220, x = Math.sin(a) * r, z = Math.cos(a) * r, y = ground(x,z), h = 100 + (Math.sin(i * 13) + 1) * 170, s = 80 + (Math.cos(i * 4) + 1) * 60;
      mesh([[-s,0,-s],[s,0,-s],[s,0,s],[-s,0,s],[s*.12,h,0]], [[0,1,4],[1,2,4],[2,3,4],[3,0,4]], ['#294853','#365863','#213e4d','#1c3646'], {x,y,z});
    }
    for (const r of relays) {
      const base = { x: r.x, y: ground(r.x, r.z), z: r.z };
      box(base, 34, r.y - base.y - 16, 34, r.hp > 0 ? ['#304954','#3f5860','#263e4e','#2d434d','#496c72'] : ['#26353e']);
      if (r.hp > 0) {
        const v = [[0,36,0],[-25,0,0],[0,0,25],[25,0,0],[0,0,-25],[0,-22,0]];
        mesh(v, [[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]], r.kind===1?['#ae95d3','#76609d']:r.kind===2?['#ffd48b','#c99256']:['#ffbd9a','#f47e80','#aa4d6f','#d56a79'], r, time * .6);
      }
    }
    for (const r of rings) healthSphere(r, r.cooldown === 0);
    if (boss && boss.hp > 0) bossFighter(boss);
    for(const shockwave of shockwaves)shockwaveCylinder(shockwave);
    for(const b of bolts)if(b.hostile)box({x:b.x,y:b.y,z:b.z},26,26,26,['#ff3d58','#a81832','#ff9d84'],Math.atan2(b.vx,b.vz));
    for(let i=0;i<route.length-1;i++){
      const a=route[i],b=route[i+1],steps=Math.ceil(distance(a,b)/90);
      for(let j=0;j<steps;j++){const t=j/steps;box({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)-70,z:lerp(a.z,b.z,t)},4,3,12,['#bf9764','#ffca83'],Math.atan2(b.x-a.x,b.z-a.z));}
    }
    const startYaw=Math.atan2(route[1].x-route[0].x,route[1].z-route[0].z);
    const endYaw=Math.atan2(route.at(-1).x-route.at(-2).x,route.at(-1).z-route.at(-2).z);
    dimensionGate(startPortal,'#77e6ff',startYaw);
    dimensionGate(route.at(-1),'#c783ff',endYaw);
    for (const p of pickups) mesh([[0,7,0],[-5,0,0],[0,0,5],[5,0,0],[0,0,-5],[0,-7,0]], [[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2]], ['#8fffd5','#4ba4a4'], p, time * 2);
    if(!cinematic)for (const e of enemies)if(e.hp>0)(e.type==='boss'?bossFighter(e):fighter(e));
    if (state !== 'defeat'&&state!=='finalIntro') fighter(ship, true);
    paintFaces();
  }
  function paintFaces(){
    faces.sort((a,b) => (b.z-a.z)||(a.order-b.order));
    for (const face of faces) {
      ctx.beginPath(); face.ps.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle = face.color; ctx.fill();
      if (face.edge) { ctx.strokeStyle = face.edge; ctx.lineWidth = .5; ctx.stroke(); }
    }
  }
  function line(a, b, color, lineWidth = 2) {
    const p = project(a), q = project(b); if (!p || !q) return;
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
  }
  function drawSky() {
    const horizon = clamp(height * .48 + Math.tan(camera.pitch) * focal, -height, height * 2);
    const gradient = ctx.createLinearGradient(0,0,0,height); gradient.addColorStop(0,'#061322'); gradient.addColorStop(.55,'#214957'); gradient.addColorStop(1,'#678183'); ctx.fillStyle = gradient; ctx.fillRect(0,0,width,height);
    for (let i=0;i<110;i++) {
      const a = i * 2.3999, elevation = .1 + ((i * 37) % 90) / 100;
      const p = project({x:camera.x+Math.sin(a)*8000,y:camera.y+elevation*8000,z:camera.z+Math.cos(a)*8000});
      if (p && p.y < horizon) {ctx.fillStyle = i % 3 ? '#c3dfed60' : '#e7f8ffbb'; ctx.fillRect(p.x,p.y,i%3 ? 1:2,i%3 ? 1:2);}
    }
    const sun = project({x:camera.x-4500,y:camera.y+2000,z:camera.z+6500});
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x,sun.y,4,sun.x,sun.y,155); glow.addColorStop(0,'#ffd4ab70'); glow.addColorStop(1,'#ffd4ab00'); ctx.fillStyle=glow; ctx.fillRect(sun.x-155,sun.y-155,310,310);
      ctx.fillStyle='#f5d8b1'; ctx.beginPath();ctx.arc(sun.x,sun.y,32,0,TAU);ctx.fill();
    }
    const planet = project({x:camera.x+4500,y:camera.y+4200,z:camera.z+7500});
    if(planet){ctx.fillStyle='#86b5c922';ctx.beginPath();ctx.arc(planet.x,planet.y,80,0,TAU);ctx.fill();ctx.strokeStyle='#b2ddde44';ctx.lineWidth=2;ctx.stroke();}
  }
  function marker(p, label, color, objective = false) {
    const v = view(p), projected = project(p);
    let x, y, off = !projected || projected.x < 90 || projected.x > width-90 || projected.y < 90 || projected.y > height-100;
    if (!off) { x=projected.x; y=projected.y; }
    else {
      if (!objective) return;
      // A camera-space bearing remains meaningful for targets behind the ship.
      const dx = v.x || .001, dy = -v.y + (v.z < 0 ? 90 : 0), len = Math.hypot(dx,dy);
      const ux = dx / len, uy = dy / len, edge = Math.min((width*.5-65)/Math.max(Math.abs(ux),.001),(height*.5-100)/Math.max(Math.abs(uy),.001));
      x=width/2+ux*edge; y=height/2+uy*edge;
    }
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.2;
    const size=off?9: selected === p ? 25 : 15;
    ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size,y);ctx.lineTo(x,y+size);ctx.lineTo(x-size,y);ctx.closePath();ctx.stroke();
    if(selected===p){ctx.beginPath();ctx.moveTo(x-size,y);ctx.lineTo(x+size,y);ctx.moveTo(x,y-size);ctx.lineTo(x,y+size);ctx.stroke();}
    if (!off && p.hp > 0) {ctx.fillStyle='#172c3bcc';ctx.fillRect(x-24,y+size+8,48,3);ctx.fillStyle=color;ctx.fillRect(x-24,y+size+8,48*p.hp/p.maxHp,3);}
  }
  function radar() {
    const size = width < 700 ? 188 : 270, x=width-size/2-30, y=height-size/2-50, radius=size/2;
    const alarmPulse=gateDanger?(.45+.55*Math.sin(time*9)**2):0;
    ctx.fillStyle=gateDanger?`rgba(100,20,30,${.45+alarmPulse*.25})`:'#071823b0';ctx.strokeStyle=gateDanger?'#ff7185':'#709da055';ctx.lineWidth=gateDanger?3:1;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(x,y,radius/2,0,TAU);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-radius,y);ctx.lineTo(x+radius,y);ctx.moveTo(x,y-radius);ctx.lineTo(x,y+radius);ctx.stroke();
    const dot=(p,color,r=3)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+p.x/2150*radius,y-p.z/2150*radius,r,0,TAU);ctx.fill();};
    const shipIcon=(p,color,size=6)=>{const px=x+p.x/2150*radius,py=y-p.z/2150*radius;ctx.save();ctx.translate(px,py);ctx.rotate(p.yaw||0);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.68,size*.72);ctx.lineTo(0,size*.3);ctx.lineTo(-size*.68,size*.72);ctx.closePath();ctx.fill();ctx.restore();};
    rings.filter(r=>r.cooldown===0).forEach(r=>dot(r,'#d5ab62',2)); relays.filter(r=>r.hp>0).forEach(r=>dot(r,'#ff9989',4)); enemies.filter(e=>e.hp>0).forEach(e=>shipIcon(e,'#ff4660',6));
    ctx.beginPath();route.forEach((p,i)=>{const px=x+p.x/2150*radius,py=y-p.z/2150*radius;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.strokeStyle='#eab779';ctx.stroke();
    dot(route[route.length-1],gateDanger?'#ff2f53':'#ff887d',gateDanger?8:5);if(boss?.hp>0)shipIcon(boss,'#ff304f',8);
    if(gateDanger){ctx.strokeStyle='#ff5068';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius-6,0,TAU);ctx.stroke();}
    shipIcon(ship,'#b1ffea',6);
  }
  function hud() {
    const f=forward(ship.yaw,ship.pitch), aim=project({x:ship.x+f.x*700,y:ship.y+f.y*700,z:ship.z+f.z*700});
    if(aim){
      const {x,y}=aim;ctx.strokeStyle=selected?'#ffcd91':'#d1f8ef88';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x,y,19,0,TAU);ctx.moveTo(x-29,y);ctx.lineTo(x-12,y);ctx.moveTo(x+12,y);ctx.lineTo(x+29,y);ctx.moveTo(x,y-29);ctx.lineTo(x,y-12);ctx.moveTo(x,y+12);ctx.lineTo(x,y+29);ctx.stroke();ctx.fillStyle='#d7fff4';ctx.fillRect(x-1,y-1,2,2);
    }
    if(selected?.hp>0)marker(selected,'','#ffbc92');
    const threats=waveTargets().sort((a,b)=>(routeLength-a.travel)/a.speed-(routeLength-b.travel)/b.speed);
    $('healthBar').style.width=`${Math.max(0,ship.hp)}%`;
    $('healthText').textContent=`${Math.max(0,Math.ceil(ship.hp))}`;
    const bars=$('boosts').children;
    for(let i=0;i<3;i++){const fill=i<ship.charges?1:i===ship.charges?ship.recharge/rechargeTime():0;bars[i].firstElementChild.style.width=`${fill*100}%`;bars[i].classList.toggle('ready',i<ship.charges);}
    $('boosts').setAttribute('aria-label',`${ship.charges} of 3 boosts ready`);
    $('drive').innerHTML=`<span class="button-key">SPACE</span> · ${ship.driving?'DRIVING':'STATIONARY'}`;
    $('weapon').innerHTML='<span class="button-key">F</span> · ROCKET';
    $('weaponCooldown').style.width=`${clamp(1-missileTime/(4/(1+.22*ship.levels.rate)),0,1)*100}%`;
    $('mission').textContent=waveDelay>0?`NEXT WAVE ${Math.ceil(waveDelay)}s`:`WAVE ${wave}/${WAVE_COUNT} · ${threats.length} LEFT`;
    $('mission').textContent=waveDelay>0?`${TEXT.nextWave} ${Math.ceil(waveDelay)}s`:`WAVE ${wave}/${WAVE_COUNT} · ${threats.length} LEFT`;
    const remaining=upgradesRemaining(),cost=upgradeCost();
    $('upgradeFill').style.width=`${remaining?clamp(salvage/cost,0,1)*100:100}%`;
    $('upgradeLabel').textContent=remaining?`UPGRADE POWER · ${salvage} / ${cost}`:'ALL UPGRADES MAXED';
    $('upgradeButton').setAttribute('aria-valuenow',remaining?Math.min(salvage,cost):cost);
    $('upgradeButton').setAttribute('aria-valuemax',cost);
    radar();
    for(const p of popups){const v=project(p);if(v){ctx.globalAlpha=Math.min(1,p.life);ctx.font='20px SkyrushPixel, monospace';ctx.textAlign='center';ctx.fillStyle='#b8ffd4';ctx.fillText(`+${p.reward}`,v.x,v.y);ctx.globalAlpha=1;}}
    if(flash>0){ctx.fillStyle=`rgba(255,75,92,${flash*.3})`;ctx.fillRect(0,0,width,height);}
  }
  function frame(now) {
    const dt=Math.min((now-last)/1000,.04);last=now;
    if(state==='playing')update(dt);
    if(state==='intro'){introTime+=dt;time+=dt;if(introTime>=6){state='playing';$('hud').hidden=false;announce('Stop every enemy before the gate',3);}}
    if(state==='finalIntro'){finalIntroTime+=dt;time+=dt;if(finalIntroTime>=6){state='playing';$('hud').hidden=false;announce('FINAL WAVE / DESTROY THE DREADNOUGHT',3);}}
    if(state==='title'){time+=dt;ship.yaw+=dt*.025;ship.x=Math.sin(time*.025)*150;}
    else if(state==='playing')time+=dt;
    if(state==='playing'||state==='title'||state==='finalIntro'){
      for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;}
      particles=particles.filter(p=>p.life>0);
    }
    const f=forward(ship.yaw,ship.pitch);
    camera={x:ship.x-f.x*145,y:ship.y-f.y*145+36,z:ship.z-f.z*145,yaw:ship.yaw,pitch:ship.pitch-.045};
    if(state==='intro' || (state==='paused' && pauseFrom==='intro')){
      const t=clamp(introTime/3,0,1),focus=boss||enemies[0];
      const eye=introTime<3?{x:lerp(700,-500,t),y:lerp(650,420,t),z:lerp(-1500,-600,t)}:{x:focus.x+Math.cos(introTime*.4)*330,y:focus.y+95,z:focus.z-300};
      const look=introTime<3?{x:0,y:130,z:100}:focus;
      camera={...eye,yaw:Math.atan2(look.x-eye.x,look.z-eye.z),pitch:Math.atan2(look.y-eye.y,Math.hypot(look.x-eye.x,look.z-eye.z))};
    }
    if(state==='finalIntro'||(state==='paused'&&pauseFrom==='finalIntro')){
      const t=clamp(finalIntroTime/6,0,1),angle=-1.15+t*2.2,radius=lerp(620,285,t),shake=(1-t)*Math.sin(finalIntroTime*18)*12;
      const look={x:boss.x,y:boss.y+15,z:boss.z},eye={x:boss.x+Math.sin(angle)*radius+shake,y:boss.y+lerp(230,105,t),z:boss.z+Math.cos(angle)*radius-shake};
      camera={...eye,yaw:Math.atan2(look.x-eye.x,look.z-eye.z),pitch:Math.atan2(look.y-eye.y,Math.hypot(look.x-eye.x,look.z-eye.z))};
    }
    camera.cy=Math.cos(camera.yaw);camera.sy=Math.sin(camera.yaw);camera.cp=Math.cos(camera.pitch);camera.sp=Math.sin(camera.pitch);
    drawSky();drawWorld();
    for(const b of bolts)if(!b.hostile)line(b,{x:b.x-b.vx*Math.min(.035,b.age||0),y:b.y-b.vy*Math.min(.035,b.age||0),z:b.z-b.vz*Math.min(.035,b.age||0)},b.missile?'#ffdb9d':'#93ffde',b.missile?4:2);
    for(const p of particles){const v=project(p);if(!v)continue;ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;const s=clamp(p.size*v.scale,1,20);ctx.fillRect(v.x-s/2,v.y-s/2,s,s);}
    ctx.globalAlpha=1;
    if(state!=='title'&&state!=='intro'&&state!=='finalIntro'&&!(state==='paused'&&(pauseFrom==='intro'||pauseFrom==='finalIntro')))hud();
    if(state==='intro'){ctx.fillStyle='#06121c';ctx.fillRect(0,0,width,60);ctx.fillRect(0,height-60,width,60);ctx.fillStyle='#e5f5dc';ctx.textAlign='center';ctx.font='20px SkyrushPixel, monospace';ctx.fillText(introTime<3?'SECTOR 01':'WAVE 1 · INCOMING',width/2,38);ctx.font='14px monospace';ctx.fillText('SPACE TO SKIP',width/2,height-24);}
    if(state==='finalIntro'){ctx.fillStyle='#080710';ctx.fillRect(0,0,width,72);ctx.fillRect(0,height-72,width,72);ctx.fillStyle='#d8a7ff';ctx.textAlign='center';ctx.font='24px SkyrushPixel, monospace';ctx.fillText(finalIntroTime<3?'UNKNOWN SIGNATURE':'WAVE 10 · THE DREADNOUGHT',width/2,43);ctx.font='14px monospace';ctx.fillText('SPACE TO SKIP',width/2,height-28);}
    const vignette=ctx.createRadialGradient(width/2,height/2,height*.25,width/2,height/2,width*.7);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#02091690');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
    requestAnimationFrame(frame);
  }
  title();requestAnimationFrame(frame);
})();
