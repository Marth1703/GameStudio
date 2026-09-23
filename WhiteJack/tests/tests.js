import { CHARMS, ACTIVE_CHARMS, rulesFor } from '../js/charms.js';
import { newRun, value, natural, makeDeck, startHand, act, legalActions, twinsRate, twinsPayoutRate, jackpotRate, suggestedAction, maxHands, goalFor, descend, buyCharm, sellCharm, closeShop, refreshShop, refreshCost, initialStake, canUseShop, canRefreshShop, charmPrice, money } from '../js/engine.js';
import { estimateAdvantage } from '../js/advantage.js';
const output = document.querySelector('#results');
const results = [], failures = [];
const assert = (ok, message = 'Assertion failed') => { if (!ok) throw Error(message); };
const eq = (a, b) => assert(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
const c = (rank, suit = 'H') => ({ rank: String(rank), suit });
function fixture(cards = [c(10), c(9)], dealer = [c(10), c(7)], charms = []) {
  const s = newRun(123); s.charms = charms; startHand(s); s.phase = 'playing'; s.bank = 90; s.growth = { blackjack: 0, multiplier: 0 }; s.bjStreak = 0; s.winStreak = 0;
  Object.assign(s.round, { rules: rulesFor(s), hands: [{ cards, wager: 10, done: false, split: false, modified: false, doubled: false }], dealer, active: 0, splits: 0, rescues: 0, bust: null, deck: Array.from({ length: 40 }, () => c(10, 'S')), sideCards: structuredClone(cards), stake: 10, before: 100, events: [], ledger: [], twinsStake: 0, jackpotStake: 0 });
  return s;
}
async function test(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); results.push(`FAIL ${name}: ${error.stack}`); }
  output.textContent = results.join('\n');
}

await test('Charm catalogues provide 35 active effects and one disabled entry', () => {
  eq(CHARMS.length, 36); eq(ACTIVE_CHARMS.length, 35); eq(new Set(CHARMS.map(c => c.id)).size, 36);
  assert(CHARMS.every(c => c.text && c.price > 0 && (c.configure || c.win || c.after)));
  assert(!ACTIVE_CHARMS.some(c => c.id === 'sleight-of-seven'));
  assert(ACTIVE_CHARMS.some(c => c.id === 'dice-roll' && c.rarity === 'rare'));
  const disabled = newRun(); disabled.charms = ['sleight-of-seven']; assert(!rulesFor(disabled).seven);
});
await test('Six-deck shoe and soft ace arithmetic', () => {
  eq(makeDeck().length, 312); eq(makeDeck().filter(x => x.rank === 'A' && x.suit === 'H').length, 6);
  eq(value([c('A'), c('A'), c(9)]), { total: 21, soft: true }); eq(value([c('A'), c(6), c(10)]), { total: 17, soft: false });
});
await test('Natural pays 3:2 and beats dealer three-card 21', () => {
  const s = fixture([c('A'), c('K')], [c(7), c(7), c(7)]); act(s, 'stand'); eq(s.bank, 115); eq(s.round.hands[0].outcome, 'blackjack');
});
await test('Dealer does not peek; any player 21 ties a dealer natural', () => {
  const s = fixture([c('A'), c('K')], [c('A'), c('Q')]); act(s, 'stand'); eq(s.bank, 100);
  const t = fixture([c(7), c(7), c(7)], [c('A'), c('Q')]); act(t, 'stand'); eq(t.bank, 100);
});
await test('Dealer stands on soft 17', () => { const s = fixture([c(10), c(8)], [c('A'), c(6)]); act(s, 'stand'); eq(s.round.dealer.length, 2); eq(s.bank, 110); });
await test('Bust loses even if dealer would bust', () => { const s = fixture([c(10), c(10), c(4)], [c(10), c(6)]); act(s, 'stand'); eq(s.bank, 90); eq(s.round.dealer.length, 2); });
await test('Bust redraw is an active choice that keeps the bust card visible', () => {
  const s = fixture([c(10), c(6)]); s.round.deck = [c(10), c(2)];
  for (let seed = 0; seed < 100; seed++) {
    const t = structuredClone(s); t.seed = seed; act(t, 'hit');
    if (t.phase === 'bust-choice') { eq(t.round.bust.card.rank, '10'); eq(value(t.round.hands[0].cards).total, 26); eq(t.round.rescues, 0); act(t, 'redraw'); eq(value(t.round.hands[0].cards).total, 18); eq(t.round.rescues, 1); return; }
  }
  throw Error('No bust fixture found');
});
await test('Player can keep a bust and later redraws can use another available charge', () => {
  const s = fixture([c(10), c(6)], [c(10), c(7)], ['second-wind']); act(s, 'hit'); eq(s.phase, 'bust-choice'); act(s, 'keep-bust'); eq(s.phase, 'result'); eq(s.round.hands[0].outcome, 'bust'); eq(s.round.rescues, 0); eq(s.round.rules.rescues, 2);
});
await test('Double debits only the added wager and settles exactly once', () => { const s = fixture([c(5), c(6)]); act(s, 'double'); eq(s.bank, 120); eq(s.round.stake, 20); eq(s.round.hands[0].cards.length, 3); assert(!act(s, 'stand')); eq(s.bank, 120); });
await test('Insufficient funds block double, split and deal', () => { const s = fixture([c(8), c(8)]); s.bank = 9; assert(!legalActions(s).includes('double')); assert(!legalActions(s).includes('split')); const t = newRun(); t.bank = 9; assert(!startHand(t)); eq(t.played, 0); });
await test('Split hands play in sequence with separate stakes', () => { const s = fixture([c(8), c(8)]); act(s, 'split'); eq(s.bank, 80); eq(s.round.hands.length, 2); act(s, 'stand'); eq(s.phase, 'playing'); eq(s.round.active, 1); act(s, 'stand'); eq(s.bank, 120); eq(s.round.stake, 20); });
await test('Split aces get one card and pay ordinary 21, not natural', () => { const s = fixture([c('A'), c('A')]); act(s, 'split'); eq(s.phase, 'result'); eq(s.bank, 120); assert(s.round.hands.every(h => h.cards.length === 2 && !natural(h))); });
await test('At most two split actions create no more than three hands', () => { const s = fixture([c(8), c(8)]); s.round.deck = Array.from({ length: 40 }, () => c(8)); act(s, 'split'); act(s, 'split'); eq(s.round.hands.length, 3); assert(!legalActions(s).includes('split')); });
await test('Dealer blackjack still lets the player finish their hand', () => { const s = fixture([c(10), c(5)], [c('A'), c('K')]); assert(legalActions(s).includes('hit')); act(s, 'hit'); assert(['playing', 'bust-choice', 'result'].includes(s.phase)); });
await test('A hard or soft 21 waits for the player to stand', () => {
  const s = fixture([c(10), c(5)]); s.round.deck = Array.from({ length: 40 }, () => c(6)); act(s, 'hit'); eq(value(s.round.hands[0].cards).total, 21); eq(s.phase, 'playing'); assert(legalActions(s).includes('stand')); assert(legalActions(s).includes('hit'));
  act(s, 'stand'); eq(s.phase, 'result');
});
await test('Split hands reaching 21 also remain playable until stand', () => {
  const s = fixture([c(10), c(10)]); s.round.deck = Array.from({ length: 40 }, () => c('A')); act(s, 'split'); eq(s.phase, 'playing'); assert(s.round.hands.every(h => value(h.cards).total === 21 && !h.done)); assert(legalActions(s).includes('stand'));
});
await test('Pair and later consecutive-seven tiers pay the highest matching tier only', () => {
  eq(twinsRate([c(7), c(7, 'S')]), 6); eq(twinsRate([c(7), c(7, 'D')]), 12); eq(twinsRate([c(7), c(7)]), 25); eq(twinsRate([c('J'), c('K')]), 0);
  eq(jackpotRate([c(7), c(2)]), 0); eq(jackpotRate([c(2), c(7)]), 0); eq(jackpotRate([c(2), c(7), c(7, 'S')]), 50); eq(jackpotRate([c(2), c(7), c(7)]), 100); eq(jackpotRate([c('A'), c(7), c(7, 'S'), c(7, 'D')]), 500); eq(jackpotRate([c('A'), c(7), c(7), c(7)]), 5000);
});
await test('Twins counts later pairs, retains a split pair, and pays new split pairs', () => {
  const s = fixture([c(8), c(8)], [c(10), c(7)]); s.round.twinsStake = 2; s.round.stake += 2; s.bank -= 2;
  s.round.deck = Array.from({ length: 40 }, () => c(8));
  act(s, 'split'); eq(s.round.splitTwins.length, 1); eq(twinsPayoutRate(s.round), 75);
  act(s, 'stand'); act(s, 'stand'); eq(s.round.ledger.find(line => line.label === 'Twins').amount, 150);
  const later = fixture([c(2), c(7), c(7)]); eq(twinsPayoutRate(later.round), 25);
});
await test('Side bets unlock at Depths 2 and 3 with independent selected stakes', () => { const s = newRun(); s.twins = s.jackpot = true; s.twinsBet = 7; s.jackpotBet = 13; eq(initialStake(s), 10); s.depth = 2; eq(initialStake(s), 17); s.depth = 3; eq(initialStake(s), 30); });
await test('Jackpot pays for a later run of adjacent sevens', () => {
  const s = fixture([c('A'), c(7), c(7), c(7)]); s.round.jackpotStake = 2; s.round.stake += 2; s.bank -= 2; s.round.sideCards = structuredClone(s.round.hands[0].cards);
  act(s, 'stand'); eq(s.round.ledger.find(line => line.label === 'Jackpot').amount, 10000);
});
await test('Dice Roll replaces one chosen card with a random 2 to 7 once per hand', () => {
  const s = fixture([c(10), c(6)], [c(10), c(7)], ['dice-roll']); s.round.deck = [c(2), c(3), c(4), c(5), c(6), c(7)]; assert(legalActions(s).includes('dice'));
  assert(act(s, 'dice', 0)); assert(['2', '3', '4', '5', '6', '7'].includes(s.round.hands[0].cards[0].rank)); assert(s.round.diceUsed); assert(!legalActions(s).includes('dice'));
  const sameRank = fixture([c(2), c(6)], [c(10), c(7)], ['dice-roll']); sameRank.round.deck = [c(2)]; assert(act(sameRank, 'dice', 0)); assert(sameRank.round.hands[0].cards[0].rank !== '2');
});
await test('Dice Roll on another card keeps the pending bust card for a redraw', () => {
  const s = fixture([c(10), c(9), c(10)], [c(10), c(7)], ['dice-roll']);
  s.phase = 'bust-choice'; s.round.bust = { handIndex: 0, cardIndex: 2, card: c(10) };
  s.round.deck = [c(7)]; act(s, 'dice', 0);
  eq(s.round.hands[0].cards[0].rank, '7'); eq(s.phase, 'bust-choice'); eq(s.round.bust.cardIndex, 2);
});
await test('Dice Roll remains available during an active bust decision', () => {
  const s = fixture([c(5), c(9), c(10)], [c(10), c(7)], ['dice-roll']); s.phase = 'bust-choice'; s.round.bust = { handIndex: 0, cardIndex: 2, card: c(10) };
  assert(legalActions(s).includes('dice'));
});
await test('Rank and suit weights compose centrally', () => {
  const s = newRun(); s.charms = ['ace-up', 'royal-company', 'seven-signal', 'heart-locket', 'black-spade', 'blood-diamond', 'clover']; const r = rulesFor(s);
  eq(r.ranks.A, 3); eq(r.ranks.K, 1.8); eq(r.ranks['7'], 4); eq(r.suits, { H: 3, S: 3, D: 3, C: 3 });
});
await test('Consecutive blackjack profit ×4; third natural permanently grows payout', () => {
  const s = fixture([c('A'), c('K')], [c(10), c(7)], ['double-omen', 'white-flame']); s.bjStreak = 2; act(s, 'stand'); eq(s.bank, 160); eq(s.growth.blackjack, .25); eq(s.bjStreak, 3);
});
await test('Momentum, Blood Pact, Snowball growth and multiplier order', () => {
  const s = fixture([c('A'), c('K')], [c(10), c(7)], ['momentum', 'blood-pact', 'snowball']); s.winStreak = 2; act(s, 'stand'); eq(s.bank, money(100 + 15 * 1.35 ** 2)); eq(s.growth.multiplier, .35);
});
await test('Every payout charm changes the corresponding actual settlement', () => {
  for (const [id, expected] of [['velvet', 120], ['silk-suit', 130], ['payday', 117.5], ['midnight', 117.25]]) { const s = fixture([c('A'), c('K')], [c(10), c(7)], [id]); act(s, 'stand'); eq(s.bank, expected); }
  const refund = fixture([c(10), c(6)], [c(10), c(7)], ['safety-net']); act(refund, 'stand'); eq(refund.bank, 92.5);
  const tooth = fixture([c(10), c(8)], [c(10), c(6)], ['gold-tooth']); act(tooth, 'stand'); eq(tooth.bank, 115);
  const five = fixture([c(2), c(2), c(2), c(2), c(2)], [c(10), c(7)], ['five-fingers']); act(five, 'stand'); eq(five.bank, 130);
  const s = newRun(); s.charms = ['looking-glass', 'seventh-heaven']; eq(rulesFor(s).twins, 3); eq(rulesFor(s).jackpot, 3);
});
await test('Lucky Penny sometimes doubles positive net profit', () => {
  let doubled = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const s = fixture([c('A'), c('K')], [c(10), c(7)], ['lucky-penny']); s.seed = seed;
    act(s, 'stand');
    assert(s.bank === 115 || s.bank === 130);
    if (s.bank === 130) { doubled++; eq(s.round.ledger.at(-1), { label: 'Lucky Penny', amount: 15 }); }
  }
  assert(doubled > 150 && doubled < 250, `Unexpected Lucky Penny frequency: ${doubled}`);
});
await test('Seven hands enforced; Long Night immediately extends to nine', () => { const s = newRun(); s.played = 7; assert(!startHand(s)); s.charms.push('long-night'); eq(maxHands(s), 9); assert(startHand(s)); });
await test('The first shop opens after Depth 1 with one free charm and no rerolls', () => {
  const s = newRun(9); assert(!canUseShop(s)); assert(!s.shop.length); s.qualified = true; descend(s); eq(s.depth, 2); assert(canUseShop(s)); assert(s.firstShop); assert(s.freeCharmAvailable); assert(s.shop.length === 4);
  assert(s.shop.every(id => !CHARMS.find(charm => charm.id === id)?.requires || CHARMS.find(charm => charm.id === id).requires <= s.depth));
  const id = s.shop[0]; eq(charmPrice(s, id), 0); assert(!canRefreshShop(s)); assert(!refreshShop(s)); assert(buyCharm(s, id)); assert(!s.freeCharmAvailable); assert(charmPrice(s, s.shop.find(Boolean)) > 0); assert(closeShop(s)); assert(!canUseShop(s));
  s.bank = 1000; s.qualified = true; descend(s); eq(s.depth, 3); assert(canRefreshShop(s)); eq(refreshCost(s), 6); assert(refreshShop(s)); eq(refreshCost(s), 11);
});
await test('Seven-slot cap, sell, and no shop changes during a hand', () => {
  const s = newRun(); s.qualified = true; descend(s); s.charms = CHARMS.slice(0, 7).map(c => c.id); s.bank = 1000; s.shop = [CHARMS[8].id]; assert(!buyCharm(s, s.shop[0])); assert(sellCharm(s, s.charms[0])); assert(buyCharm(s, s.shop[0])); startHand(s); if (s.phase === 'result') s.phase = 'playing'; assert(!sellCharm(s, s.charms[0])); assert(!refreshShop(s));
});
await test('Goal secured on settlement, retained after purchases, exponential descent', () => {
  const s = fixture([c('A'), c('K')]); s.bank = 110; act(s, 'stand'); assert(s.qualified); assert(!canUseShop(s)); const before = s.bank; eq(descend(s), 30); eq(s.bank, before + 30); eq(s.depth, 2); eq(s.played, 0); eq(goalFor(2), 200); assert(!s.qualified); assert(canUseShop(s));
});
await test('A large carried bankroll secures the next goal immediately', () => { const s = newRun(); s.bank = 1000; s.qualified = true; descend(s); assert(s.qualified); eq(s.depth, 2); });
await test('Save/resume mid-hand preserves shoe and random outcome exactly', () => { const s = fixture([c(8), c(3)]); const t = JSON.parse(JSON.stringify(s)); act(s, 'hit'); act(t, 'hit'); eq(s, t); });
await test('1,000 seeded charm combinations: all rounds settle and money conserves', () => {
  for (let i = 0; i < 1000; i++) {
    const s = newRun(i); s.bank = 1000; s.depth = 3; s.bet = 20; s.twins = s.jackpot = true; s.charms = Array.from({ length: 7 }, (_, j) => ACTIVE_CHARMS[(i + j * 3) % ACTIVE_CHARMS.length].id);
    const before = s.bank; assert(startHand(s)); let steps = 0;
    while (['playing', 'bust-choice'].includes(s.phase) && steps++ < 100) { const a = suggestedAction(s); assert(act(s, a.action, a.index)); }
    eq(s.phase, 'result'); eq(s.bank, money(before + s.round.net)); eq(money(s.round.ledger.reduce((sum, l) => sum + l.amount, 0)), s.round.net); assert(s.bank >= 0 && Number.isFinite(s.bank));
  }
});
await test('Advantage is deterministic, independent, and responds to the actual rules', () => {
  const s = newRun(2), before = JSON.stringify(s); const base = estimateAdvantage(s, 4000); eq(JSON.stringify(s), before); eq(estimateAdvantage(s, 4000), base); assert(Number.isFinite(base.edge));
  s.charms = ['lucky-penny']; const penny = estimateAdvantage(s, 4000); assert(penny.edge > base.edge, 'Lucky Penny improves expected return');
  s.charms = ['long-night']; eq(estimateAdvantage(s, 4000), base);
  s.charms = ['ace-up', 'double-omen', 'velvet', 'snowball']; const upgraded = estimateAdvantage(s, 4000); assert(upgraded.edge > base.edge, 'Natural build improves estimated return');
  results.push(`INFO Starter edge ${base.edge.toFixed(2)}%; natural build ${upgraded.edge.toFixed(2)}% (4k samples)`);
});

const key = 'gamestudio.whitejack.v1', priorSave = localStorage.getItem(key);
const frame = document.createElement('iframe'); document.body.append(frame);
async function load(s) {
  localStorage.setItem(key, JSON.stringify(s));
  await new Promise(resolve => { frame.onload = resolve; frame.src = `../index.html?test=${Math.random()}`; });
  return frame.contentDocument;
}
function saved() { return JSON.parse(localStorage.getItem(key)); }
async function waitFor(check, message = 'Timed out waiting for UI') {
  const until = Date.now() + 6000;
  while (!check() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 40));
  assert(check(), message);
}
try {
  await test('UI: actual module worker publishes a numeric Advantage estimate', async () => {
    const doc = await load(newRun(9));
    const timeout = Date.now() + 20000;
    while (doc.querySelector('#edge-status').textContent === 'SIMULATING YOUR BUILD' && Date.now() < timeout) await new Promise(resolve => setTimeout(resolve, 50));
    assert(doc.querySelector('#edge-status').textContent.startsWith('ESTIMATE'), doc.querySelector('#edge-status').textContent);
    assert(doc.querySelector('#edge').textContent.includes('%'));
    doc.querySelector('#edge-info').click(); assert(doc.querySelector('#modal').textContent.includes('18,000'));
  });
  await test('UI: deal, lock wagers, play, persist, and resume', async () => {
    const s = fixture([c(10), c(6)]); const doc = await load(s);
    assert(doc.querySelector('#bet').disabled);
    const timeout = Date.now() + 20000;
    while (doc.querySelector('#edge-status').textContent === 'SIMULATING YOUR BUILD' && Date.now() < timeout) await new Promise(resolve => setTimeout(resolve, 50));
    assert(doc.querySelector('#edge-status').textContent.startsWith('ESTIMATE'), 'Resumed hands also calculate a pre-deal estimate');
    const dealerCard = doc.querySelector('#dealer-cards .card'), playerCard = doc.querySelector('#player-hands .card');
    doc.querySelector('[data-action="stand"]').click(); eq(saved().phase, 'result');
    assert(doc.querySelector('#dealer-cards .card') === dealerCard, 'Standing should not remount the dealer cards before the reveal');
    assert(doc.querySelector('#player-hands .card') === playerCard, 'Standing should not remount player cards');
    assert(doc.querySelector('#dealer-cards .back'), 'Dealer cards should begin face down during the reveal');
    await waitFor(() => doc.querySelector('.payout-flash'), 'Payout sources should flash at the table center');
    await waitFor(() => doc.querySelector('[data-action="deal"]'), 'Settlement presentation should finish');
    doc.querySelector('[data-action="deal"]').click(); eq(saved().played, 2);
    const before = saved(); await load(before); eq(saved(), before);
  });
  await test('UI: marked bust card offers redraw or keep-bust', async () => {
    const s = fixture([c(10), c(6), c(10)]); s.phase = 'bust-choice'; s.round.bust = { handIndex: 0, cardIndex: 2, card: c(10) };
    const doc = await load(s); assert(doc.querySelector('.bust-card')); assert(doc.querySelector('[data-action="redraw"]')); assert(doc.querySelector('[data-action="keep-bust"]'));
    doc.querySelector('[data-action="keep-bust"]').click(); eq(saved().phase, 'result');
  });
  await test('UI: split replacement cards reveal one at a time', async () => {
    const s = fixture([c(8), c(8)]); const doc = await load(s);
    doc.querySelector('[data-action="split"]').click(); assert(doc.querySelector('#player-hands .back'));
    await waitFor(() => !doc.querySelector('#player-hands .back'), 'Split cards should finish their reveal');
  });
  await test('UI: Depth entry unlocks and opens the one-time first shop', async () => {
    const s = newRun(3); s.bank = 300; s.qualified = true; const doc = await load(s);
    assert(doc.querySelector('#twins-side').hidden); assert(doc.querySelector('#jackpot-side').hidden); eq(doc.querySelector('#goal').textContent, '$120');
    doc.querySelector('[data-action="descend"]').click(); assert(doc.querySelector('#modal').textContent.includes('TWINS UNLOCKED')); assert(doc.querySelector('#modal').textContent.includes('Each adjacent same-rank pair pays')); assert(doc.querySelector('.unlock-preview'));
    doc.querySelector('[data-unlock-continue]').click(); await waitFor(() => doc.querySelector('[data-buy]'), 'First shop should open after the unlock message');
    assert(doc.querySelector('#twins-side').hidden === false); assert(doc.querySelector('[data-refresh]').disabled);
    const free = doc.querySelector('[data-buy]'); const id = free.dataset.buy; eq(free.textContent, 'TAKE FREE'); const before = saved().bank; free.click(); assert(saved().charms.includes(id)); eq(saved().bank, before);
    doc.querySelector('[data-close]').click(); await waitFor(() => saved().shopState === 'closed'); assert(!doc.querySelector('#modal').open);
  });
await test('UI: unlocked adjustable side bets, compact wagers, and Dice Roll selection', async () => {
    const s = newRun(2); s.depth = 3; s.bank = 100; const doc = await load(s);
    doc.querySelector('#twins').click(); doc.querySelector('#jackpot').click(); assert(saved().twins && saved().jackpot); eq(initialStake(saved()), 14);
    const twinsBet = doc.querySelector('#twins-bet'); twinsBet.value = 9; twinsBet.dispatchEvent(new Event('change')); const jackpotBet = doc.querySelector('#jackpot-bet'); jackpotBet.value = 13; jackpotBet.dispatchEvent(new Event('change')); eq(initialStake(saved()), 32);
    doc.querySelector('#twins-bet-up').click(); eq(saved().twinsBet, 18); doc.querySelector('#bet-up').click(); eq(saved().bet, 20);
    const input = doc.querySelector('#bet'); input.value = 200; input.dispatchEvent(new Event('change')); assert(doc.querySelector('[data-action="deal"]').disabled);
    jackpotBet.value = '100K'; jackpotBet.dispatchEvent(new Event('change')); eq(saved().jackpotBet, 100000); eq(jackpotBet.value, '100K');
    const t = fixture([c(7), c(8)], [c(10), c(7)], ['dice-roll']); const next = await load(t);
    next.querySelector('[data-action="choose-dice"]').click(); next.querySelector('[data-card="1"]').click(); assert(saved().round.diceUsed); assert(!next.querySelector('[data-action="choose-dice"]'));
  });
  await test('UI: readable help, restart confirmation, and corrupt save recovery', async () => {
    let doc = await load(newRun(9)); doc.querySelector('#help').click(); assert(doc.querySelector('#modal').textContent.includes('TABLE RULES')); assert(!doc.querySelector('#modal').textContent.includes('Ins' + 'urance')); assert(!doc.querySelector('#modal').textContent.includes('Rule ' + 'references')); doc.querySelector('[data-close]').click();
    doc.querySelector('#bet').value = '45'; doc.querySelector('#bet').dispatchEvent(new Event('change'));
    doc.querySelector('#restart').click(); assert(doc.querySelector('[data-new-run]')); doc.querySelector('[data-new-run]').click(); eq(saved().bank, 100); eq(saved().bet, 10); eq(doc.querySelector('#bet').value, '10');
    doc = await load({ version: 1, bank: 'broken' }); eq(saved().bank, 100); assert(doc.querySelector('[data-action="deal"]'));
  });
  await test('UI: owned charm opens a compact Close-only detail window', async () => {
    const s = newRun(5); s.charms = ['ace-up']; const doc = await load(s); doc.querySelector('[data-charm="ace-up"]').click();
    assert(doc.querySelector('#modal').classList.contains('charm-modal')); assert(!doc.querySelector('.close-modal')); assert(doc.querySelector('[data-close]').textContent.includes('CLOSE')); assert(doc.querySelector('#modal').getBoundingClientRect().width < 500);
  });
  await test('UI: owned charm review floats without rearranging the shop', async () => {
    const s = newRun(5); s.depth = 3; s.shopState = 'open'; s.firstShop = false; s.freeCharmAvailable = false; s.charms = ['ace-up', 'dice-roll']; s.shop = ['long-night']; const doc = await load(s); await waitFor(() => doc.querySelector('.inventory-charm'));
    const charm = doc.querySelector('.inventory-charm'), row = charm.closest('.inventory-item'), before = row.getBoundingClientRect(); charm.focus(); await new Promise(resolve => setTimeout(resolve, 50));
    const after = row.getBoundingClientRect(), detail = charm.querySelector('em'); assert(Math.abs(before.y - after.y) < .1 && Math.abs(before.height - after.height) < .1); assert(getComputedStyle(detail).visibility === 'visible');
  });
  await test('UI: mobile widths do not overflow and dialogs stay within viewport', async () => {
    for (const width of [360, 390, 650, 820, 1100]) {
      frame.style.width = width + 'px'; const doc = await load(newRun(7)); assert(doc.documentElement.scrollWidth <= width, `Overflow at ${width}`);
      const s = newRun(7); s.qualified = true; const shopDoc = await load(s); shopDoc.querySelector('[data-action="descend"]').click(); shopDoc.querySelector('[data-unlock-continue]').click(); await waitFor(() => shopDoc.querySelector('[data-buy]')); const box = shopDoc.querySelector('#modal').getBoundingClientRect(); assert(box.x >= 0 && box.right <= width + 1, `Modal overflow at ${width}`);
    }
  });
} finally {
  frame.remove(); if (priorSave === null) localStorage.removeItem(key); else localStorage.setItem(key, priorSave);
}
output.textContent = `${results.join('\n')}\n\n${results.filter(r => r.startsWith('PASS')).length} passed, ${failures.length} failed.`;
document.body.dataset.testStatus = failures.length ? 'failed' : 'passed';
window.testResults = { passed: results.filter(r => r.startsWith('PASS')).length, failures, results };
