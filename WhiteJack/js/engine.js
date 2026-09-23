import { ACTIVE_CHARMS, CHARM_BY_ID, RANKS, SUITS, rulesFor } from './charms.js';

export const VERSION = 4;
export const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const goalFor = depth => Math.round(120 * 1.65 ** (depth - 1) / 5) * 5;
export const minBet = depth => Math.max(5, Math.floor(5 * 1.45 ** (depth - 1)));
export const maxHands = s => 7 + rulesFor(s).extraHands;
export const sideStake = (s, kind) => Math.max(1, money(Number(s[`${kind}Bet`]) || Math.max(1, money(s.bet * .2))));
export const initialStake = s => money(s.bet + (s.twins && s.depth >= 2 ? sideStake(s, 'twins') : 0) + (s.jackpot && s.depth >= 3 ? sideStake(s, 'jackpot') : 0));
export const canUseShop = s => s.phase === 'ready' && s.played === 0 && s.shopState === 'open';
export const canRefreshShop = s => canUseShop(s) && !s.firstShop;
export function random(s) {
  let t = s.seed += 0x6D2B79F5;
  s.seed >>>= 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
export function newRun(seed = Math.floor(Math.random() * 2 ** 32)) {
  return { version: VERSION, seed, bank: 100, depth: 1, played: 0, bet: 10, twins: false, jackpot: false, twinsBet: 2, jackpotBet: 2, charms: [], growth: { blackjack: 0, multiplier: 0 }, bjStreak: 0, winStreak: 0, phase: 'ready', round: null, qualified: false, shop: [], shopState: 'locked', firstShop: false, freeCharmAvailable: false, refreshes: 0, totalHands: 0, bestWin: 0 };
}
export function value(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { if (c.rank === 'A') { total += 11; aces++; } else total += Math.min(10, Number(c.rank) || 10); }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
export const natural = h => !h.split && !h.modified && h.cards.length === 2 && value(h.cards).total === 21;
export const cardValue = c => c.rank === 'A' ? 11 : Math.min(10, Number(c.rank) || 10);
export function makeDeck() {
  return Array.from({ length: 6 }, () => SUITS.flatMap(suit => RANKS.map(rank => ({ rank, suit })))).flat();
}
function draw(s, player = false) {
  const { deck, rules } = s.round;
  if (!deck.length) throw new Error('Shoe exhausted');
  const weightedIndex = () => {
    let sum = 0;
    for (const c of deck) sum += rules.ranks[c.rank] * rules.suits[c.suit];
    let point = random(s) * sum;
    let index = deck.length - 1;
    for (let i = 0; i < deck.length; i++) { point -= rules.ranks[deck[i].rank] * rules.suits[deck[i].suit]; if (point < 0) { index = i; break; } }
    return index;
  };
  let index = player ? weightedIndex() : Math.floor(random(s) * deck.length);
  if (player && s.depth === 1 && s.phase !== 'bust-choice' && random(s) < .3) {
    const other = weightedIndex(), cards = s.round.hands[s.round.active]?.cards || [];
    const score = card => {
      if (!cards.length) return cardValue(card) + (card.rank === 'A' ? 1 : 0);
      const total = value([...cards, card]).total;
      return total <= 21 ? total : -total;
    };
    if (score(deck[other]) > score(deck[index])) index = other;
  }
  return deck.splice(index, 1)[0];
}
function drawDiceCard(s, previous) {
  const deck = s.round.deck;
  const eligible = deck.map((card, index) => ({ card, index })).filter(({ card }) => ['2', '3', '4', '5', '6', '7'].includes(card.rank) && card.rank !== previous.rank);
  if (!eligible.length) {
    const ranks = ['2', '3', '4', '5', '6', '7'].filter(rank => rank !== previous.rank);
    return { rank: ranks[Math.floor(random(s) * ranks.length)], suit: SUITS[Math.floor(random(s) * SUITS.length)] };
  }
  return deck.splice(eligible[Math.floor(random(s) * eligible.length)].index, 1)[0];
}
export function startHand(s) {
  if (!['ready', 'result'].includes(s.phase) || s.played >= maxHands(s) || s.bank < initialStake(s) || s.bet < minBet(s.depth)) return false;
  if (s.shopState === 'open') s.shopState = 'closed';
  const stake = initialStake(s);
  s.round = { rules: rulesFor(s), deck: makeDeck(), hands: [{ cards: [], wager: s.bet, done: false, split: false, modified: false, doubled: false }], dealer: [], active: 0, splits: 0, splitTwins: [], rescues: 0, bust: null, sevenUsed: false, diceUsed: false, stake, before: s.bank, twinsStake: s.twins && s.depth >= 2 ? sideStake(s, 'twins') : 0, jackpotStake: s.jackpot && s.depth >= 3 ? sideStake(s, 'jackpot') : 0, events: [], ledger: [], sideCards: [], returned: 0 };
  s.bank = money(s.bank - stake); s.played++; s.totalHands++; s.phase = 'playing';
  const r = s.round;
  r.hands[0].cards.push(draw(s, true)); r.dealer.push(draw(s));
  r.hands[0].cards.push(draw(s, true)); r.dealer.push(draw(s));
  r.sideCards = r.hands[0].cards.map(c => ({ ...c }));
  // The stranger never peeks. A player natural ends immediately; otherwise every
  // player gets their full turn before the dealer card is revealed.
  if (natural(r.hands[0])) finish(s);
  return true;
}
export function legalActions(s) {
  if (s.phase === 'bust-choice') return ['redraw', 'keep-bust', ...(s.round.rules.seven && !s.round.sevenUsed ? ['seven'] : []), ...(s.round.rules.dice && !s.round.diceUsed ? ['dice'] : [])];
  if (s.phase !== 'playing') return [];
  const r = s.round, h = r.hands[r.active];
  const a = ['hit', 'stand'];
  if (h.cards.length === 2 && s.bank >= h.wager && !h.modified) a.push('double');
  if (h.cards.length === 2 && !h.modified && cardValue(h.cards[0]) === cardValue(h.cards[1]) && s.bank >= h.wager && r.splits < 2 && !(h.split && h.cards[0].rank === 'A')) a.push('split');
  if (r.rules.seven && !r.sevenUsed) a.push('seven');
  if (r.rules.dice && !r.diceUsed) a.push('dice');
  return a;
}
function playerDraw(s, h) {
  const r = s.round;
  h.cards.push(draw(s, true));
  if (!h.split) r.sideCards = h.cards.map(c => ({ ...c }));
  return rescue(s, h, h.cards.length - 1);
}
function rescue(s, h, cardIndex) {
  const r = s.round;
  if (value(h.cards).total > 21 && r.rescues < r.rules.rescues) {
    r.bust = { handIndex: r.active, cardIndex, card: { ...h.cards[cardIndex] } };
    s.phase = 'bust-choice';
    r.events.push(`Bust on ${h.cards[cardIndex].rank}. Use Second Chance?`);
    return 'choice';
  }
  if (value(h.cards).total > 21) { h.done = true; return 'bust'; }
  if (h.doubled) h.done = true;
  return 'safe';
}
function resolveTransformation(s, h, cardIndex, pending) {
  const r = s.round;
  r.bust = null; s.phase = 'playing';
  if (pending && value(h.cards).total > 21 && r.rescues < r.rules.rescues) {
    r.bust = { ...pending, card: { ...h.cards[pending.cardIndex] } };
    s.phase = 'bust-choice';
    return;
  }
  rescue(s, h, pending?.cardIndex ?? cardIndex);
}
function advance(s) {
  const r = s.round;
  while (r.active < r.hands.length && r.hands[r.active].done) r.active++;
  if (r.active >= r.hands.length) finish(s);
}
export function act(s, action, cardIndex = 0) {
  if (!legalActions(s).includes(action)) return false;
  const r = s.round;
  if (action === 'redraw' || action === 'keep-bust') {
    const pending = r.bust, h = r.hands[pending?.handIndex];
    if (!pending || !h) return false;
    if (action === 'keep-bust') {
      h.done = true;
      r.events.push(`Kept ${pending.card.rank}. Hand busts.`);
      r.bust = null; s.phase = 'playing'; advance(s); return true;
    }
    h.cards[pending.cardIndex] = draw(s, true); r.rescues++;
    r.events.push(`Second Chance: ${pending.card.rank} → ${h.cards[pending.cardIndex].rank}`);
    if (!h.split) r.sideCards = h.cards.map(c => ({ ...c }));
    r.bust = null; s.phase = 'playing';
    rescue(s, h, pending.cardIndex);
    if (s.phase !== 'bust-choice') advance(s);
    return true;
  }
  const h = r.hands[r.active];
  if (action === 'seven') {
    if (!Number.isInteger(cardIndex) || !h.cards[cardIndex]) return false;
    const pending = r.bust;
    h.cards[cardIndex] = { ...h.cards[cardIndex], rank: '7' }; h.modified = true; r.sevenUsed = true;
    r.events.push('Sleight of Seven: card transformed');
    if (!h.split) r.sideCards = h.cards.map(c => ({ ...c }));
    resolveTransformation(s, h, cardIndex, pending);
  }
  if (action === 'dice') {
    if (!Number.isInteger(cardIndex) || !h.cards[cardIndex]) return false;
    const pending = r.bust;
    r.diceUsed = true;
    const previous = h.cards[cardIndex];
    const replacement = drawDiceCard(s, previous);
    h.cards[cardIndex] = replacement;
    r.events.push(`Dice Roll: ${previous.rank} to ${replacement.rank}`);
    if (!h.split) r.sideCards = h.cards.map(c => ({ ...c }));
    resolveTransformation(s, h, cardIndex, pending);
  }
  if (action === 'stand') h.done = true;
  if (action === 'hit' || action === 'double') {
    if (action === 'double') { s.bank = money(s.bank - h.wager); r.stake += h.wager; h.wager *= 2; h.doubled = true; }
    playerDraw(s, h);
  }
  if (action === 'split') {
    if (twinsRate(h.cards) > 0) r.splitTwins.push(h.cards.map(c => ({ ...c })));
    s.bank = money(s.bank - h.wager); r.stake += h.wager;
    const other = { cards: [h.cards.pop()], wager: h.wager, done: false, split: true, modified: false, doubled: false };
    h.split = true;
    r.splits++;
    h.cards.push(draw(s, true)); other.cards.push(draw(s, true));
    r.hands.splice(r.active + 1, 0, other);
    // Split aces receive one card only; no resplitting aces. Split 21 is not a natural.
    if (h.cards[0].rank === 'A') { h.done = true; other.done = true; }
    else { h.done = false; other.done = false; }
  }
  if (s.phase !== 'bust-choice') advance(s); return true;
}
export function twinsRate(cards) {
  if (cards.length < 2 || cards[0].rank !== cards[1].rank) return 0;
  if (cards[0].suit === cards[1].suit) return 25;
  const red = c => c.suit === 'H' || c.suit === 'D';
  return red(cards[0]) === red(cards[1]) ? 12 : 6;
}
export function twinsPayoutRate(round) {
  const pairs = round.splitTwins || [];
  let rate = pairs.reduce((sum, cards) => sum + twinsRate(cards), 0);
  for (const hand of round.hands) {
    for (let i = 1; i < hand.cards.length; i++) rate += twinsRate(hand.cards.slice(i - 1, i + 1));
  }
  return rate;
}
export function jackpotRate(cards) {
  let best = 0, current = [];
  const consider = sequence => {
    if (sequence.length < 2) return;
    const trio = sequence.slice(0, 3);
    const suited = trio.every(card => card.suit === trio[0].suit);
    best = Math.max(best, sequence.length >= 3 ? (suited ? 5000 : 500) : (sequence[0].suit === sequence[1].suit ? 100 : 50));
  };
  for (const card of cards) {
    if (card.rank === '7') current.push(card);
    else { consider(current); current = []; }
  }
  consider(current);
  return best;
}
function finish(s) {
  const r = s.round, dealerBJ = r.dealer.length === 2 && value(r.dealer).total === 21;
  if (!dealerBJ && r.hands.some(h => value(h.cards).total <= 21 && !natural(h))) {
    while (value(r.dealer).total < 17) r.dealer.push(draw(s));
  }
  const dealerTotal = value(r.dealer).total;
  let returns = 0, won = false;
  const isNatural = r.hands.length === 1 && natural(r.hands[0]);
  for (const h of r.hands) {
    const total = value(h.cards).total, bj = natural(h), five = r.rules.fiveCard && h.cards.length >= 5 && total <= 21;
    let outcome = 'loss', rate = 0;
    if (total > 21) outcome = 'bust';
    else if (dealerBJ) outcome = total === 21 ? 'push' : 'loss';
    else if (bj || five || dealerTotal > 21 || total > dealerTotal) {
      outcome = bj ? 'blackjack' : five ? 'five cards' : 'win';
      rate = (bj ? r.rules.blackjack : five ? 3 : 1) + r.rules.winBonus + (dealerTotal > 21 ? r.rules.bustBonus : 0);
      rate *= r.rules.multiplier;
      const ctx = { run: s, cards: h.cards, natural: bj, dealerTotal };
      for (const id of s.charms) {
        const charm = CHARM_BY_ID[id];
        if (charm?.enabled !== false) rate *= charm?.win?.(ctx) ?? 1;
      }
      won = true;
    } else if (total === dealerTotal) outcome = 'push';
    const returned = money(rate > 0 ? h.wager * (1 + rate) : outcome === 'push' ? h.wager : h.wager * r.rules.refund);
    returns += returned; h.outcome = outcome; h.profit = money(returned - h.wager);
    r.ledger.push({ label: outcome.toUpperCase(), amount: h.profit });
  }
  for (const [label, stake, rate] of [['Twins', r.twinsStake, twinsPayoutRate(r) * r.rules.twins], ['Jackpot', r.jackpotStake, jackpotRate(r.sideCards) * r.rules.jackpot]]) {
    if (stake) { const returned = rate ? money(stake * (1 + rate)) : 0; returns += returned; r.ledger.push({ label, amount: money(returned - stake) }); }
  }
  const profitBeforePenny = money(returns - r.stake);
  if (r.rules.luckyPenny && profitBeforePenny > 0 && random(s) < .2) {
    returns += profitBeforePenny;
    r.ledger.push({ label: 'Lucky Penny', amount: profitBeforePenny });
  }
  r.returned = money(returns); r.net = money(returns - r.stake);
  s.bank = money(s.bank + returns); s.bestWin = Math.max(s.bestWin, r.net);
  s.bjStreak = isNatural ? s.bjStreak + 1 : 0; s.winStreak = won ? s.winStreak + 1 : 0;
  for (const id of s.charms) {
    const charm = CHARM_BY_ID[id];
    if (charm?.enabled !== false) charm?.after?.(s, { natural: isNatural, won });
  }
  s.qualified ||= s.bank >= goalFor(s.depth);
  s.phase = 'result';
}
export const refreshCost = s => Math.round(6 * 1.8 ** s.refreshes);
export const charmPrice = (s, id) => s.freeCharmAvailable ? 0 : Math.round(CHARM_BY_ID[id].price * 1.22 ** (s.depth - 1));
const RARITY_DISTRIBUTION = [['common', .6], ['rare', .3], ['epic', .08], ['legendary', .02]];
export function stockShop(s) {
  const pool = ACTIVE_CHARMS.filter(charm => !s.charms.includes(charm.id) && (!charm.requires || s.depth >= charm.requires));
  s.shop = [];
  while (s.shop.length < 4 && pool.length) {
    let roll = random(s), rarity = 'common';
    for (const [name, chance] of RARITY_DISTRIBUTION) { roll -= chance; if (roll <= 0) { rarity = name; break; } }
    const choices = pool.filter(charm => charm.rarity === rarity);
    const choice = (choices.length ? choices : pool)[Math.floor(random(s) * (choices.length ? choices.length : pool.length))];
    s.shop.push(choice.id);
    pool.splice(pool.indexOf(choice), 1);
  }
}
export function refreshShop(s, free = false) {
  if (!canRefreshShop(s)) return false;
  if (!free) { const cost = refreshCost(s); if (s.bank < cost) return false; s.bank = money(s.bank - cost); s.refreshes++; }
  stockShop(s);
  return true;
}
export function buyCharm(s, id) {
  if (!canUseShop(s) || !s.shop.includes(id) || s.charms.includes(id) || (CHARM_BY_ID[id].requires && s.depth < CHARM_BY_ID[id].requires) || s.charms.length >= 7 || s.bank < charmPrice(s, id)) return false;
  const price = charmPrice(s, id);
  s.bank = money(s.bank - price); s.charms.push(id); s.shop[s.shop.indexOf(id)] = null;
  if (s.freeCharmAvailable) s.freeCharmAvailable = false;
  return true;
}
export function sellCharm(s, id) {
  if (!canUseShop(s) || !s.charms.includes(id)) return false;
  s.charms.splice(s.charms.indexOf(id), 1); s.bank = money(s.bank + Math.floor(CHARM_BY_ID[id].price / 2));
  s.qualified ||= s.bank >= goalFor(s.depth); return true;
}
export function closeShop(s) {
  if (!canUseShop(s)) return false;
  s.shopState = 'closed';
  return true;
}
export function descend(s) {
  if (!s.qualified || !['ready', 'result'].includes(s.phase)) return false;
  const reward = Math.round(30 * 1.5 ** (s.depth - 1));
  s.bank = money(s.bank + reward); s.depth++; s.played = 0; s.qualified = s.bank >= goalFor(s.depth); s.round = null; s.phase = 'ready'; s.refreshes = 0;
  s.shopState = 'open'; s.firstShop = s.depth === 2; s.freeCharmAvailable = s.firstShop;
  s.bet = Math.max(s.bet, minBet(s.depth));
  stockShop(s);
  return reward;
}

// Public-information strategy used for the estimate and optional hints. No hole-card access.
export function suggestedAction(s) {
  const legal = legalActions(s);
  if (s.phase === 'bust-choice') return { action: 'redraw' };
  if (s.phase !== 'playing') return { action: 'stand' };
  const r = s.round, h = r.hands[r.active], { total, soft } = value(h.cards), up = cardValue(r.dealer[0]);
  if (legal.includes('seven')) {
    let best = -1, score = -Infinity;
    for (let i = 0; i < h.cards.length; i++) {
      if (h.cards[i].rank === '7') continue;
      const cards = h.cards.map((c, j) => j === i ? { ...c, rank: '7' } : c);
      const t = value(cards).total;
      const sideGain = r.jackpotStake && !h.split ? jackpotRate(cards) - jackpotRate(h.cards) : 0;
      const quality = t <= 21 ? (sideGain > 0 ? 100 + sideGain : t >= 18 && t > total ? t : -1) : -1;
      if (quality > score) { score = quality; best = i; }
    }
    if (score > 0) return { action: 'seven', index: best };
  }
  if (legal.includes('split')) {
    const rank = cardValue(h.cards[0]);
    if (rank === 11 || rank === 8 || (rank === 9 && [2, 3, 4, 5, 6, 8, 9].includes(up)) || (rank === 7 && up <= 7) || (rank === 6 && up <= 6) || (rank === 4 && [5, 6].includes(up)) || ([2, 3].includes(rank) && up <= 7)) return { action: 'split' };
  }
  if (soft) {
    if (legal.includes('double') && ((total <= 14 && up >= 5 && up <= 6) || (total >= 15 && total <= 16 && up >= 4 && up <= 6) || (total >= 17 && total <= 18 && up >= 3 && up <= 6))) return { action: 'double' };
    return { action: total >= 19 || total === 18 && up <= 8 ? 'stand' : 'hit' };
  }
  if (legal.includes('double') && (total === 11 && up !== 11 || total === 10 && up <= 9 || total === 9 && up >= 3 && up <= 6)) return { action: 'double' };
  return { action: total >= 17 || total >= 13 && up <= 6 || total === 12 && up >= 4 && up <= 6 ? 'stand' : 'hit' };
}
