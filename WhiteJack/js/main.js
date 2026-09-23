import { ACTIVE_CHARMS, CHARM_BY_ID, rulesFor, RANKS, SUITS } from './charms.js';
import { newRun, value, startHand, act, legalActions, goalFor, maxHands, minBet, initialStake, sideStake, canUseShop, canRefreshShop, descend, buyCharm, sellCharm, closeShop, refreshShop, refreshCost, charmPrice, stockShop, money } from './engine.js';
import { icon, dealerArt } from './art.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'gamestudio.whitejack.v1';
const compact = n => n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const dollars = n => '$' + (n >= 1e6 ? compact(n) : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
const signed = n => (n >= 0 ? '+' : '−') + dollars(Math.abs(n));
const wagerText = n => n >= 512 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: n < 10000 ? 1 : 0 })}K` : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
function parseWager(value) {
  const match = String(value).trim().replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)\s*([kKmM])?$/);
  if (!match) return NaN;
  return Number(match[1]) * ({ k: 1e3, m: 1e6 }[(match[2] || '').toLowerCase()] || 1);
}
let run = loadRun(), modalType = '', selectingSeven = false, selectingDice = false, soundOn = true, audio, estimator, estimateTimer, lastEstimate, toastTimer;
let lastEstimateKey = '', lastCardKey = '', lastDealerKey = '', dealerReveal = null, splitReveal = null, presentationTimers = [], bankAnimation = null, presenting = false, displayedBank = null, pendingShop = false;
const idle = () => ['ready', 'result'].includes(run.phase);
function showBank(amount) {
  const [whole, cents] = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  $('bank').innerHTML = amount >= 1e6 ? dollars(amount) : `$${whole}<span>.${cents}</span>`;
}

function loadRun() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || s.version !== 4 || !['ready', 'playing', 'bust-choice', 'result'].includes(s.phase)) return newRun();
    const finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e100;
    if (!['bank', 'seed', 'depth', 'played', 'bet', 'twinsBet', 'jackpotBet', 'bjStreak', 'winStreak', 'refreshes', 'totalHands', 'bestWin'].every(k => finite(s[k])) || s.depth < 1 || s.depth > 100 || s.bet < minBet(s.depth) || s.twinsBet < 1 || s.jackpotBet < 1) return newRun();
    if (!['locked', 'open', 'closed'].includes(s.shopState) || typeof s.firstShop !== 'boolean' || typeof s.freeCharmAvailable !== 'boolean' || !s.growth || !finite(s.growth.blackjack) || !finite(s.growth.multiplier) || !Array.isArray(s.charms) || s.charms.length > 7 || new Set(s.charms).size !== s.charms.length || s.charms.some(id => !CHARM_BY_ID[id]) || !Array.isArray(s.shop) || s.shop.some(id => id !== null && !CHARM_BY_ID[id])) return newRun();
    if (s.shopState === 'open' && s.shop.some(id => id && CHARM_BY_ID[id].requires > s.depth)) stockShop(s);
    const validCard = c => c && RANKS.includes(c.rank) && SUITS.includes(c.suit);
    if (s.phase !== 'ready') {
      const r = s.round;
      if (!r || !Array.isArray(r.hands) || !r.hands.length || r.hands.length > 3 || r.hands.some(h => !Array.isArray(h.cards) || !h.cards.every(validCard) || !finite(h.wager)) || !Array.isArray(r.deck) || !r.deck.every(validCard) || !Array.isArray(r.dealer) || !r.dealer.every(validCard) || r.dealer.length < 2 || !Array.isArray(r.sideCards) || !r.sideCards.every(validCard) || !Array.isArray(r.events) || !Array.isArray(r.ledger) || !r.rules || !finite(r.active) || !finite(r.splits) || (['playing', 'bust-choice'].includes(s.phase) && r.active >= r.hands.length)) return newRun();
      if (s.phase === 'bust-choice' && (!r.bust || !finite(r.bust.handIndex) || !finite(r.bust.cardIndex) || !validCard(r.bust.card) || !r.hands[r.bust.handIndex]?.cards[r.bust.cardIndex])) return newRun();
      if (s.phase !== 'result') r.rules = rulesFor(s);
    }
    return s;
  } catch { return newRun(); }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); }
  catch { $('save-status').textContent = 'SAVING UNAVAILABLE · KEEP THIS TAB OPEN'; }
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2900);
}
function dealSound(delay = 0) {
  if (!soundOn) return;
  const play = () => {
    const sample = new Audio('./assets/Card_dealt.wav');
    sample.volume = .42;
    sample.play().catch(() => {});
  };
  if (delay) presentationTimers.push(setTimeout(play, delay)); else play();
}
function tone(kind = 'card', step = 0) {
  if (kind === 'card') { dealSound(); return; }
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = kind === 'profit-step' ? [Math.min(1175, 392 * 1.19 ** step)] : kind === 'profit-down' ? [392, 294, 220, 165] : kind === 'profit-neutral' ? [330] : kind === 'win' ? [659, 784, 988, 1175] : kind === 'buy' ? [523, 659, 880] : kind === 'sell' ? [440, 330] : [310];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + i * .08;
      oscillator.type = kind === 'jackpot' ? 'square' : 'triangle'; oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.045, time + .01); gain.gain.exponentialRampToValueAtTime(.0001, time + .19);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(time); oscillator.stop(time + .2);
    });
  } catch { /* Audio is optional. */ }
}
function celebrate(big = false) {
  $('table').classList.remove('celebrate'); void $('table').offsetWidth; $('table').classList.add('celebrate');
  document.querySelector('.bank-stat').classList.remove('pulse'); void $('bank').offsetWidth; document.querySelector('.bank-stat').classList.add('pulse');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < (big ? 35 : 13); i++) {
    const el = document.createElement('i'); el.className = 'particle';
    el.style.setProperty('--x', `${(Math.random() - .5) * 600}px`); el.style.setProperty('--y', `${Math.random() * 220 - 180}px`);
    el.style.background = i % 2 ? '#d9ee95' : '#d2b477'; $('particles').append(el); setTimeout(() => el.remove(), 1100);
  }
}
const suit = c => ({ H: '♥', D: '♦', C: '♣', S: '♠' })[c.suit];
function cardMarkup(c, hidden = false, ghost = false, index = -1, bust = false) {
  if (hidden) return `<div class="card back${ghost ? ' ghost' : ''}" aria-label="Face-down card"></div>`;
  const selectingCard = selectingSeven || selectingDice;
  return `<div class="card ${['H', 'D'].includes(c.suit) ? 'red' : ''}${selectingCard && index >= 0 ? ' selectable' : ''}${bust ? ' bust-card' : ''}" ${selectingCard && index >= 0 ? `role="button" tabindex="0" data-card="${index}"` : ''} aria-label="${c.rank} of ${{ H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' }[c.suit]}${bust ? ', card that caused a bust' : ''}"><span class="rank">${c.rank}</span><span class="small-suit">${suit(c)}</span><span class="big-suit">${suit(c)}</span><span class="bottom-rank">${c.rank}</span>${c.rank === '7' ? '<span class="seven-star">✦</span>' : ''}</div>`;
}
function celebrateSide(kind) {
  const target = $(`${kind}-side`);
  target.classList.remove('side-won'); void target.offsetWidth; target.classList.add('side-won');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bounds = target.getBoundingClientRect();
  for (let i = 0; i < (kind === 'jackpot' ? 44 : 24); i++) {
    const el = document.createElement('i'); el.className = 'particle side-particle';
    el.style.left = `${bounds.left + bounds.width / 2}px`; el.style.top = `${bounds.top + bounds.height / 2}px`;
    el.style.setProperty('--x', `${(Math.random() - .5) * (kind === 'jackpot' ? 420 : 270)}px`);
    el.style.setProperty('--y', `${Math.random() * -230 - 30}px`);
    el.style.background = kind === 'jackpot' ? (i % 3 ? '#f4d56e' : '#fff4bd') : '#d9ee95';
    $('particles').append(el); setTimeout(() => el.remove(), 1200);
  }
}
function clearPresentation() {
  presentationTimers.forEach(clearTimeout);
  presentationTimers = [];
  if (bankAnimation !== null) cancelAnimationFrame(bankAnimation);
  bankAnimation = null;
  document.querySelector('.bank-change')?.remove();
  $('payout-flashes').replaceChildren();
  dealerReveal = null;
  splitReveal = null;
  presenting = false;
  displayedBank = null;
}
function schedulePresentation(callback, delay) {
  presentationTimers.push(setTimeout(callback, delay));
}
function payoutFlash(text, kind = 'positive') {
  const flash = document.createElement('div');
  flash.className = `payout-flash ${kind}`;
  flash.textContent = text;
  $('payout-flashes').append(flash);
  schedulePresentation(() => flash.remove(), 2050);
}
function presentPayouts() {
  const r = run.round;
  const sources = r.ledger.filter(line => line.amount !== 0 || line.label === 'PUSH');
  const gap = 440;
  let toneStep = 0;
  sources.forEach((line, index) => {
    schedulePresentation(() => {
      const positive = line.amount >= 0;
      payoutFlash(line.label === 'PUSH' ? 'PUSH · STAKE RETURNED' : `${line.label} ${signed(line.amount)}`, positive ? 'positive' : 'negative');
      if (r.net > 0 && line.amount !== 0) tone('profit-step', toneStep++);
      if (line.amount > 0 && line.label === 'Twins') celebrateSide('twins');
      if (line.amount > 0 && line.label === 'Jackpot') celebrateSide('jackpot');
    }, gap * index);
  });
  const bankDelay = gap * sources.length + 80;
  schedulePresentation(() => {
    const change = document.createElement('span');
    change.className = `bank-change ${r.net < 0 ? 'negative' : 'positive'}`;
    change.textContent = signed(r.net);
    document.querySelector('.bank-stat').append(change);
    if (r.net > 0) celebrate(r.net >= run.bet * 3);
  }, bankDelay);
  schedulePresentation(() => {
    const started = performance.now(), duration = 680, from = r.before, difference = money(run.bank - from);
    const tick = now => {
      const progress = Math.min(1, (now - started) / duration);
      displayedBank = money(from + difference * (1 - (1 - progress) ** 3));
      showBank(displayedBank);
      bankAnimation = progress < 1 ? requestAnimationFrame(tick) : null;
    };
    bankAnimation = requestAnimationFrame(tick);
  }, bankDelay + 440);
  schedulePresentation(() => {
    document.querySelector('.bank-change')?.remove();
    displayedBank = null;
    presenting = false;
    render();
  }, bankDelay + 1400);
}
function presentSettlement() {
  clearPresentation();
  const r = run.round;
  presenting = true;
  displayedBank = r.before;
  dealerReveal = 1;
  render();
  const cardDelay = 520;
  for (let count = 2; count <= r.dealer.length; count++) {
    schedulePresentation(() => {
      dealerReveal = count;
      dealSound();
      render();
    }, cardDelay * (count - 1));
  }
  const revealEnd = cardDelay * Math.max(1, r.dealer.length - 1) + 100;
  schedulePresentation(() => {
    if (r.net < 0) tone('profit-down');
    else if (r.net === 0) tone('profit-neutral');
  }, revealEnd);
  schedulePresentation(presentPayouts, revealEnd + 280);
}
function presentSplit(first, second) {
  clearPresentation();
  presenting = true;
  splitReveal = { first, second, count: 0 };
  render();
  schedulePresentation(() => { splitReveal.count = 1; dealSound(); render(); }, 170);
  schedulePresentation(() => { splitReveal.count = 2; dealSound(); render(); }, 350);
  schedulePresentation(() => { splitReveal = null; presenting = false; render(); }, 580);
}
function render() {
  const r = run.round, playing = !idle(), goal = goalFor(run.depth), hands = maxHands(run), left = Math.max(0, hands - run.played), rules = rulesFor(run);
  $('depth').textContent = String(run.depth).padStart(2, '0');
  const bankShown = displayedBank ?? run.bank;
  showBank(bankShown);
  $('goal').textContent = dollars(goal); $('goal-caption').textContent = run.qualified ? 'GOAL SECURED ✓' : `${dollars(Math.max(0, money(goal - run.bank)))} to go`;
  $('goal-fill').style.width = `${run.qualified ? 100 : Math.min(100, run.bank / goal * 100)}%`;
  $('goal-progress').setAttribute('aria-valuemax', goal); $('goal-progress').setAttribute('aria-valuenow', Math.min(goal, run.bank));
  $('hands-count').textContent = `${left} / ${hands}`; $('hand-pips').innerHTML = Array.from({ length: hands }, (_, i) => `<i class="${i < run.played ? 'used' : ''}"></i>`).join('');
  if (!$('dealer-art').firstChild) $('dealer-art').innerHTML = dealerArt;
  const revealCount = run.phase === 'result' ? (dealerReveal ?? r?.dealer.length) : 1;
  const visibleDealer = r?.dealer.slice(0, run.phase === 'result' && dealerReveal !== null ? Math.max(2, revealCount) : 2);
  const dealerKey = JSON.stringify(visibleDealer?.map((card, i) => i >= revealCount ? null : card) ?? null);
  if (dealerKey !== lastDealerKey) {
    $('dealer-cards').innerHTML = r ? visibleDealer.map((c, i) => cardMarkup(c, i >= revealCount)).join('') : cardMarkup(null, true, true) + cardMarkup(null, true, true);
    lastDealerKey = dealerKey;
  }
  $('dealer-total').textContent = !r ? '?' : run.phase === 'result' && (dealerReveal ?? r.dealer.length) >= r.dealer.length ? value(r.dealer).total : cardValueLabel(r.dealer[0]);
  const active = r?.hands[r.active];
  const cardKey = JSON.stringify([r?.hands.map(h => [h.cards, h.wager]), r?.bust, selectingSeven, selectingDice, splitReveal, selectingSeven || selectingDice ? r?.active : null]);
  if (cardKey !== lastCardKey) {
    $('player-hands').innerHTML = r ? r.hands.map((h, j) => {
      const cards = h.cards.map((c, i) => {
        const pending = splitReveal && ((j === splitReveal.first && i === 1 && splitReveal.count < 1) || (j === splitReveal.second && i === 1 && splitReveal.count < 2));
        return cardMarkup(c, pending, false, j === r.active ? i : -1, r?.bust?.handIndex === j && r?.bust?.cardIndex === i);
      }).join('');
      const score = r.hands.length > 1 ? `<span class="hand-score"></span>` : '';
      return `<div class="hand-group ${playing && j === r.active ? 'active' : ''}"><div class="cards">${cards}</div>${score}</div>`;
    }).join('') : `<div class="cards">${cardMarkup(null, true, true)}${cardMarkup(null, true, true)}</div>`;
    lastCardKey = cardKey;
  }
  if (r) [...$('player-hands').querySelectorAll('.hand-group')].forEach((group, j) => {
    group.classList.toggle('active', playing && j === r.active);
    const score = group.querySelector('.hand-score'), h = r.hands[j];
    if (score) score.textContent = `${value(h.cards).total} · ${dollars(h.wager)}${h.outcome ? ' · ' + h.outcome.toUpperCase() : ''}`;
  });
  $('player-hands').classList.toggle('split-hands', !!r && r.hands.length > 1); $('table').classList.toggle('has-splits', !!r && r.hands.length > 1);
  const hand = active || r?.hands[0];
  $('player-total').textContent = hand ? `${value(hand.cards).total}${value(hand.cards).soft ? ' SOFT' : ''}` : '—';
  $('rescue-state').textContent = `✦ SECOND CHANCE ${playing ? Math.max(0, r.rules.rescues - r.rescues) : rules.rescues} / ${playing ? r.rules.rescues : rules.rescues}`;
  $('table-hint').textContent = run.phase === 'bust-choice' ? 'CHOOSE BEFORE THIS HAND ENDS.' : 'YOUR CALL AFTER A BUST.';
  for (const [id, depth] of [['twins', 2], ['jackpot', 3]]) {
    const wager = $(`${id}-bet`);
    $(`${id}-side`).hidden = run.depth < depth;
    $(id).disabled = playing || presenting || run.depth < depth;
    $(id).setAttribute('aria-pressed', String(run[id]));
    $(`${id}-info`).textContent = run.depth < depth ? `UNLOCKS DEPTH 0${depth}` : run[id] ? 'ON' : 'OFF';
    wager.value = wagerText(sideStake(run, id)); wager.disabled = playing || presenting || run.depth < depth;
    $(`${id}-bet-down`).disabled = playing || presenting || run.depth < depth || sideStake(run, id) <= 1;
    $(`${id}-bet-up`).disabled = playing || presenting || run.depth < depth;
  }
  $('bet').value = wagerText(run.bet); $('bet').disabled = playing || presenting;
  $('bet-down').disabled = playing || presenting || run.bet <= minBet(run.depth); $('bet-up').disabled = playing || presenting;
  renderActions(left);
  $('charm-count').textContent = `${run.charms.length} / 7`;
  $('charm-slots').innerHTML = Array.from({ length: 7 }, (_, i) => run.charms[i] ? `<button class="charm-slot owned" data-charm="${run.charms[i]}" aria-label="View ${CHARM_BY_ID[run.charms[i]].name}">${icon(CHARM_BY_ID[run.charms[i]].icon)}</button>` : '<div class="charm-slot empty" aria-label="Empty charm slot"></div>').join('');
  $('starter-icon').innerHTML = icon('wind');
  if (playing && lastEstimate && !lastEstimate.error && !lastEstimate.unavailable) $('edge-summary').textContent = `${signed(lastEstimate.expected)} expected per hand. ${left} hands after this deal.`;
  save(); requestEstimate();
}
function cardValueLabel(c) { return c.rank === 'A' ? 'A' : ['J', 'Q', 'K'].includes(c.rank) ? 10 : c.rank; }
function actionButton(action, label, cls = '', disabled = false) { return `<button data-action="${action}" class="action-button ${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`; }
function renderActions(left) {
  const legal = legalActions(run);
  if (presenting) { $('actions').innerHTML = actionButton('waiting', 'RESOLVING', 'primary', true); return; }
  if (run.phase === 'bust-choice') {
    const card = run.round.bust?.card;
    $('actions').innerHTML = actionButton('redraw', `REDRAW ${card?.rank || 'CARD'}`, 'primary') + actionButton('keep-bust', 'KEEP BUST', 'secondary') + (legal.includes('seven') ? actionButton('choose-seven', selectingSeven ? 'CANCEL 7' : 'MAKE 7', 'compact') : '') + (legal.includes('dice') ? actionButton('choose-dice', selectingDice ? 'CANCEL DICE' : 'DICE ROLL', 'compact') : '');
    return;
  }
  if (run.phase === 'playing') {
    $('actions').innerHTML = actionButton('hit', 'HIT <small>H</small>', 'primary') + actionButton('stand', 'STAND <small>S</small>', 'secondary') + actionButton('double', 'DOUBLE', 'compact', !legal.includes('double')) + actionButton('split', 'SPLIT', 'compact', !legal.includes('split')) + (legal.includes('seven') ? actionButton('choose-seven', selectingSeven ? 'CANCEL 7' : 'MAKE 7', 'compact') : '') + (legal.includes('dice') ? actionButton('choose-dice', selectingDice ? 'CANCEL DICE' : 'DICE ROLL', 'compact') : '');
    return;
  }
  if (run.qualified) { $('actions').innerHTML = actionButton('descend', `DEPTH ${String(run.depth + 1).padStart(2, '0')} ↘`, 'primary depth-button') + (left && run.bank >= initialStake(run) ? actionButton('deal', 'PLAY ON', 'compact') : ''); return; }
  if (!left) { $('actions').innerHTML = actionButton('end', 'RUN ENDED · VIEW RUN', 'primary'); return; }
  if (run.bank < minBet(run.depth)) { $('actions').innerHTML = actionButton('end', 'OUT OF FUNDS', 'primary'); return; }
  $('actions').innerHTML = actionButton('deal', `${run.phase === 'ready' ? 'DEAL ME IN' : 'NEXT HAND'} <small>↵</small>`, 'primary', run.bank < initialStake(run));
}
function requestEstimate() {
  // Reconstruct the pre-deal public state when resuming a saved active hand.
  const snapshot = { ...run, bank: idle() ? run.bank : run.round.before, played: idle() ? run.played : run.played - 1, round: null, shop: [] };
  const key = JSON.stringify([snapshot.charms, snapshot.growth, snapshot.bank, snapshot.bet, snapshot.twins, snapshot.jackpot, snapshot.twinsBet, snapshot.jackpotBet, snapshot.depth, snapshot.bjStreak, snapshot.winStreak, snapshot.played]);
  if (key === lastEstimateKey) return;
  lastEstimateKey = key; clearTimeout(estimateTimer); estimator?.terminate();
  $('edge-status').textContent = 'SIMULATING YOUR BUILD'; $('edge').style.opacity = '.5';
  estimateTimer = setTimeout(() => {
    try {
      estimator = new Worker(new URL('./advantage-worker.js', import.meta.url), { type: 'module' });
      estimator.onmessage = ({ data }) => {
        estimator.terminate(); estimator = null; lastEstimate = data; $('edge').style.opacity = '1';
        if (data.error || data.unavailable) { if (data.error) console.warn('Advantage simulation failed:', data.error); $('edge').textContent = '—'; $('edge-summary').textContent = data.unavailable ? 'Lower your wager to estimate this build.' : 'Estimate unavailable in this browser.'; $('edge-status').textContent = data.unavailable ? 'WAGER EXCEEDS BANKROLL' : 'SIMULATION UNAVAILABLE'; return; }
        $('edge').innerHTML = `${data.edge >= 0 ? '+' : '−'}${Math.abs(data.edge) >= 1000 ? compact(Math.abs(data.edge)) : Math.abs(data.edge).toFixed(1)}<small>%</small>`; $('edge').classList.toggle('negative', data.edge < 0);
        $('edge-marker').style.left = `${Math.max(2, Math.min(98, 50 + data.edge / 2))}%`;
        $('edge-summary').textContent = `${signed(data.expected)} expected per hand. ${Math.max(0, maxHands(run) - run.played)} ${idle() ? 'chances left this Depth' : 'hands after this deal'}.`;
        $('edge-status').textContent = `ESTIMATE · ±${data.margin.toFixed(1)} PTS · 18K HANDS`;
      };
      estimator.onerror = error => { console.warn('Advantage worker failed:', error.message, error.filename, error.lineno); estimator?.terminate(); estimator = null; $('edge').style.opacity = '1'; $('edge').textContent = '—'; $('edge-summary').textContent = 'Estimate unavailable. Serve the game over HTTP.'; $('edge-status').textContent = 'SIMULATION UNAVAILABLE'; };
      estimator.postMessage(snapshot);
    } catch { $('edge').textContent = '—'; $('edge-status').textContent = 'SIMULATION UNAVAILABLE'; }
  }, 200);
}
function openModal(type, content) {
  modalType = type; $('modal').className = type === 'charm' ? 'charm-modal' : ''; $('modal-content').innerHTML = content; if (!$('modal').open) $('modal').showModal();
}
function closeModal() {
  const closedType = modalType;
  $('modal').close();
  modalType = '';
  if (closedType === 'shop') { closeShop(run); render(); }
  if (closedType === 'unlock' && pendingShop) {
    pendingShop = false;
    setTimeout(openShop, 0);
  }
}
function modalHeader(title, subtitle = '', tag = 'WHITE JACK', close = true) { return `<div class="modal-heading"><div><span class="eyebrow">${tag}</span><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${close ? '<button class="close-modal" data-close aria-label="Close dialog">×</button>' : ''}</div>`; }
function openShop() {
  if (!canUseShop(run)) return;
  const cards = run.shop.map(id => {
    if (!id) return `<article class="shop-card sold">${icon('star')}<span class="eyebrow">SOLD OUT</span></article>`;
    const c = CHARM_BY_ID[id], price = charmPrice(run, id);
    return `<article class="shop-card ${c.rarity}"><span class="rarity">${c.rarity.toUpperCase()}</span><div class="shop-art">${icon(c.icon)}</div><h2>${c.name}</h2><p>${c.text}</p><button data-buy="${id}" ${run.bank < price || run.charms.length >= 7 ? 'disabled' : ''}>${run.charms.length >= 7 ? 'SLOTS FULL' : `BUY · ${dollars(price)}`}</button></article>`;
  }).join('');
  openModal('shop', `<div class="modal-inner">${modalHeader('THE BACK ROOM', 'Choose your edge before the first hand.', `DEPTH ${String(run.depth).padStart(2, '0')} · ${ACTIVE_CHARMS.length} CHARMS`)}<div class="shop-toolbar"><div><span class="eyebrow">YOUR BANKROLL</span><strong>${dollars(run.bank)}</strong></div><button class="action-button" data-refresh ${run.bank < refreshCost(run) ? 'disabled' : ''}>↻ REROLL · ${dollars(refreshCost(run))}</button></div><div class="shop-grid">${cards || '<p>You own every charm currently available.</p>'}</div><div class="panel-heading"><span class="eyebrow">YOUR CHARMS · HOVER TO REVIEW</span><span class="count">${run.charms.length} / 7</span></div><div class="shop-inventory">${run.charms.map(id => `<div class="inventory-item"><button class="inventory-charm" data-charm="${id}" aria-label="View ${CHARM_BY_ID[id].name}">${icon(CHARM_BY_ID[id].icon)}<span><strong>${CHARM_BY_ID[id].name}</strong><em>${CHARM_BY_ID[id].text}</em></span></button><button data-sell="${id}" aria-label="Sell ${CHARM_BY_ID[id].name}">SELL ${dollars(Math.floor(CHARM_BY_ID[id].price / 2))}</button></div>`).join('') || '<p class="shop-footnote">Empty pockets.</p>'}</div><div class="modal-bottom"><button class="action-button primary" data-close>BACK TO THE TABLE ↗</button></div></div>`);
  const reroll = $('modal-content').querySelector('[data-refresh]');
  reroll.disabled = !canRefreshShop(run) || run.bank < refreshCost(run);
  if (run.firstShop) $('modal-content').querySelector('.shop-toolbar').insertAdjacentHTML('afterend', '<p class="shop-footnote">Your first charm is free.</p>');
  if (run.freeCharmAvailable) $('modal-content').querySelectorAll('[data-buy]').forEach(button => { button.textContent = 'TAKE FREE'; });
}
function openUnlock(kind, reward) {
  const twins = kind === 'twins';
  const title = twins ? 'TWINS UNLOCKED' : 'JACKPOT UNLOCKED';
  const copy = twins
    ? 'Toggle Twins before the deal and set its own wager. Each adjacent same-rank pair pays, including pairs made after a split.'
    : 'Toggle Jackpot before the deal and set its own wager. Runs of two or more adjacent sevens can pay up to 5000:1.';
  const preview = twins ? '<div class="unlock-preview"><span>?</span><small>JACKPOT<br>DEPTH 03</small></div>' : '';
  openModal('unlock', `<div class="modal-inner unlock-modal">${modalHeader(title, `Depth bonus: ${dollars(reward)}.`, 'NEW SIDE BET', false)}<div class="unlock-stage ${twins ? '' : 'solo'}"><div class="unlock-symbol"><span>${twins ? 'Ⅱ' : '777'}</span><small>${twins ? 'TWINS' : 'JACKPOT'}<br>AVAILABLE NOW</small></div>${preview}</div><p>${copy}</p><div class="modal-bottom"><button class="action-button primary" data-unlock-continue>ENTER THE SHOP</button></div></div>`);
}
function openHelp() {
  openHelpV2();
}
function openHelpV2() {
  openModal('help', `<div class="modal-inner">${modalHeader('HOW TO PLAY', 'A few rules. A lot of luck.')}<div class="help-grid"><div class="help-tile"><span>01</span><h2>Beat the stranger.</h2><p>Get closer to 21 without going over. Aces count as 1 or 11.</p></div><div class="help-tile"><span>02</span><h2>Reach the goal.</h2><p>Start with $100 and reach the goal in 7 hands. Further Depths ask for more.</p></div><div class="help-tile"><span>03</span><h2>Turn the odds.</h2><p>Buy Charms in the shop to turn the odds in your favor.</p></div></div><details class="reference"><summary>TABLE RULES</summary><p>Each hand starts with a freshly shuffled six-deck shoe. The dealer stands on all 17s, including soft 17. A natural blackjack pays 3:2 profit. Other wins pay 1:1. Ties return your stake.</p><p>The dealer reveals their hand after you finish playing. If both hands reach 21, it is a tie. Double on any original two-card hand: match that hand’s wager, take one card, then stand. Split equal-value cards up to two times. Split aces receive one card each; other split hands play normally.</p><p>If a draw busts you, the bust card stays on the table. Choose whether to redraw it with Second Chance or keep the bust. H = hit · S = stand · D = double · Enter = deal.</p></details><details class="reference"><summary>TWINS & JACKPOT</summary><p>Twins unlocks at Depth 2, Jackpot at Depth 3. Toggle either before dealing and set any side-bet amount. Winning stakes are returned with the profit.</p><table class="payout-table"><tr><th>Twins · each adjacent pair</th><th>Profit</th></tr><tr><td>Same rank, mixed colors</td><td>6:1</td></tr><tr><td>Same rank, same color</td><td>12:1</td></tr><tr><td>Same rank and suit</td><td>25:1</td></tr><tr><th>Jackpot · consecutive sevens</th><th>Profit</th></tr><tr><td>Two 7s / suited 7s</td><td>50:1 / 100:1</td></tr><tr><td>Three 7s / suited 7s</td><td>500:1 / 5000:1</td></tr></table><p>Twins pays for every adjacent same-rank pair, even after a split. A pair formed before splitting keeps its payout, and new pairs pay again. Jackpot counts the best run of two or more consecutive sevens anywhere in your unsplit hand.</p></details><details class="reference"><summary>DEPTHS & SHOP</summary><p>The first goal is $120 and grows each Depth. Reach it once to secure the next door. Descending pays a bonus and opens that Depth?s shop.</p><p>Depth 1 has no shop. The first shop gives one free charm and has no rerolls. Later shops open once before the first hand; closing one ends that Depth?s visit. You have seven hands per Depth. Change your main wager and side-bet amounts before dealing.</p></details><div class="modal-bottom"><button class="action-button primary" data-close>CLOSE</button></div></div>`);
}
function openEdge() {
  openModal('edge', `<div class="modal-inner edge-explanation">${modalHeader('MAKE THE MATH YOURS.', 'A useful estimate. Never a promise.')}<div class="formula">Player’s Advantage =<br>expected net profit ÷ initial total wager</div><p>We simulate <strong>18,000 independent next hands</strong> with your actual build, wager and side bets. The simulation uses the same dealing and payout code as the game and makes only public-information decisions.</p><p>${lastEstimate && !lastEstimate.unavailable && !lastEstimate.error ? `Your current estimate is <strong>${lastEstimate.edge.toFixed(1)}% ± ${lastEstimate.margin.toFixed(1)} percentage points</strong> (approximate 95% sampling interval). At your wager, that is <strong>${signed(lastEstimate.expected)} per hand</strong>.` : 'Your estimate appears after the simulation completes.'} A positive number favors you under this policy. Your decisions can change the return.</p><p>Rare jackpots have high variance. Use the number to understand your build, not as a guarantee of reaching the goal.</p><div class="modal-bottom"><button class="action-button primary" data-close>CLOSE</button></div></div>`);
}
function openCharm(id) {
  const c = CHARM_BY_ID[id]; if (!c) return;
  openModal('charm', `<div class="modal-inner charm-detail">${modalHeader(c.name, '', c.rarity.toUpperCase() + ' CHARM', false)}<div class="shop-art">${icon(c.icon)}</div><p>${c.text}</p><div class="modal-bottom"><button class="action-button primary" data-close>CLOSE</button></div></div>`);
}
function openEnd(restart = false) {
  openModal('end', `<div class="modal-inner">${modalHeader(restart ? 'A FRESH DECK?' : 'THE HOUSE REMEMBERS.', restart ? 'Starting a new run replaces your current saved run.' : 'One more run. A different kind of luck.')}<div class="end-run"><span class="eyebrow">YOUR DESCENT</span><h1>DEPTH ${String(run.depth).padStart(2, '0')}</h1><div class="end-stats"><div><strong>${run.totalHands}</strong><span>HANDS PLAYED</span></div><div><strong>${dollars(run.bestWin)}</strong><span>BIGGEST WIN</span></div><div><strong>${run.charms.length}</strong><span>CHARMS FOUND</span></div></div><p>${run.played >= maxHands(run) && idle() ? 'The cards are cold. A new run is waiting.' : 'The stranger will save your seat.'}</p><div class="modal-bottom"><button class="action-button" data-close>KEEP THIS RUN</button><button class="action-button primary" data-new-run>NEW RUN ↗</button></div></div></div>`);
}
function perform(action, index) {
  if (presenting) return;
  if (action === 'choose-seven') { selectingSeven = !selectingSeven; selectingDice = false; render(); return; }
  if (action === 'choose-dice') { selectingDice = !selectingDice; selectingSeven = false; render(); return; }
  if (action === 'end') { openEnd(); return; }
  if (action === 'descend') {
    const reward = descend(run); if (!reward) return;
    tone('win'); celebrate(true); render();
    if (run.depth === 2) { pendingShop = true; openUnlock('twins', reward); }
    else if (run.depth === 3) { pendingShop = true; openUnlock('jackpot', reward); }
    else openShop();
    return;
  }
  const wasResult = run.phase === 'result';
  const splitAt = run.round?.active;
  const ok = action === 'deal' ? startHand(run) : act(run, action, index);
  if (!ok) return;
  selectingSeven = false; selectingDice = false;
  if (action === 'split') {
    presentSplit(splitAt, splitAt + 1);
    if (run.phase === 'result') schedulePresentation(presentSettlement, 610);
    return;
  }
  if (run.phase === 'result' && (!wasResult || action === 'deal')) {
    presentSettlement();
    return;
  }
  render();
  if (['deal', 'hit', 'double', 'redraw'].includes(action)) tone();
}
function setBet(amount) {
  if (!idle() || presenting) return;
  if (!Number.isFinite(amount)) amount = minBet(run.depth);
  run.bet = money(Math.min(1e15, Math.max(minBet(run.depth), amount))); render();
}
function setSideBet(kind, amount) {
  if (!idle() || presenting) return;
  if (!Number.isFinite(amount)) amount = 1;
  run[`${kind}Bet`] = money(Math.min(1e15, Math.max(1, amount))); render();
}
$('actions').addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b && !b.disabled) perform(b.dataset.action); });
$('player-hands').addEventListener('click', e => { const c = e.target.closest('[data-card]'); if (c && (selectingSeven || selectingDice)) perform(selectingSeven ? 'seven' : 'dice', Number(c.dataset.card)); });
$('player-hands').addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key) && e.target.dataset.card !== undefined && (selectingSeven || selectingDice)) { e.preventDefault(); perform(selectingSeven ? 'seven' : 'dice', Number(e.target.dataset.card)); } });
$('bet').addEventListener('change', e => setBet(parseWager(e.target.value)));
$('bet-down').addEventListener('click', () => setBet(Math.max(minBet(run.depth), Math.floor(run.bet / 2))));
$('bet-up').addEventListener('click', () => setBet(run.bet * 2));
for (const id of ['twins', 'jackpot']) $(id).addEventListener('click', () => { if (idle() && !presenting) { run[id] = !run[id]; render(); } });
$('twins-bet').addEventListener('change', e => setSideBet('twins', parseWager(e.target.value)));
$('jackpot-bet').addEventListener('change', e => setSideBet('jackpot', parseWager(e.target.value)));
$('twins-bet-down').addEventListener('click', () => setSideBet('twins', Math.max(1, Math.floor(run.twinsBet / 2))));
$('twins-bet-up').addEventListener('click', () => setSideBet('twins', run.twinsBet * 2));
$('jackpot-bet-down').addEventListener('click', () => setSideBet('jackpot', Math.max(1, Math.floor(run.jackpotBet / 2))));
$('jackpot-bet-up').addEventListener('click', () => setSideBet('jackpot', run.jackpotBet * 2));
$('help').addEventListener('click', openHelp); $('edge-info').addEventListener('click', openEdge); $('restart').addEventListener('click', () => openEnd(true));
$('sound').addEventListener('click', () => { soundOn = !soundOn; $('sound').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF'; $('sound').setAttribute('aria-label', soundOn ? 'Disable sound' : 'Enable sound'); tone('buy'); });
$('charm-slots').addEventListener('click', e => { const b = e.target.closest('[data-charm]'); if (b) openCharm(b.dataset.charm); });
$('modal').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.hasAttribute('data-close')) closeModal();
  if (b.hasAttribute('data-unlock-continue')) closeModal();
  if (b.dataset.charm) openCharm(b.dataset.charm);
  if (b.hasAttribute('data-refresh') && refreshShop(run)) { tone(); render(); openShop(); }
  if (b.dataset.buy && buyCharm(run, b.dataset.buy)) { tone('buy'); toast(`${CHARM_BY_ID[b.dataset.buy].name} is yours.`); render(); openShop(); }
  if (b.dataset.sell && sellCharm(run, b.dataset.sell)) { tone('sell'); render(); openShop(); }
  if (b.hasAttribute('data-new-run')) { clearPresentation(); run = newRun(); pendingShop = false; lastEstimateKey = ''; lastCardKey = ''; lastDealerKey = ''; selectingSeven = false; selectingDice = false; closeModal(); $('bet').value = '10'; render(); toast('Fresh deck. Fresh chances.'); }
});
$('modal').addEventListener('close', () => {
  const closedType = modalType;
  modalType = '';
  if (closedType === 'shop') { closeShop(run); render(); }
  if (closedType === 'unlock' && pendingShop) { pendingShop = false; setTimeout(openShop, 0); }
});
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || $('modal').open || ['INPUT', 'BUTTON', 'A', 'SUMMARY'].includes(document.activeElement?.tagName) || document.activeElement?.hasAttribute('data-card')) return;
  const key = e.key.toLowerCase(), action = { h: 'hit', s: 'stand', d: 'double' }[key];
  if (action && legalActions(run).includes(action)) { e.preventDefault(); perform(action); }
  if (e.key === 'Enter' && idle() && !run.qualified) { e.preventDefault(); perform('deal'); }
});
render();
if (canUseShop(run)) setTimeout(openShop, 0);
