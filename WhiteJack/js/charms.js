import common from '../data/charms/common.json' with { type: 'json' };
import rare from '../data/charms/rare.json' with { type: 'json' };
import epic from '../data/charms/epic.json' with { type: 'json' };
import legendary from '../data/charms/legendary.json' with { type: 'json' };
import scaling from '../data/charms/scaling.json' with { type: 'json' };

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['H', 'S', 'D', 'C'];

function configure(rules, effect) {
  switch (effect.type) {
    case 'add': rules[effect.key] += effect.amount; break;
    case 'multiply': rules[effect.key] *= effect.multiplier; break;
    case 'enable': rules[effect.key] = true; break;
    case 'weight-rank': rules.ranks[effect.rank] *= effect.multiplier; break;
    case 'weight-ranks': effect.ranks.forEach(rank => { rules.ranks[rank] *= effect.multiplier; }); break;
    case 'weight-suit': rules.suits[effect.suit] *= effect.multiplier; break;
  }
}

function winMultiplier(context, effect) {
  switch (effect.type) {
    case 'natural-streak': return context.natural && context.run.bjStreak >= effect.minimum ? effect.multiplier : 1;
    case 'win-streak': return effect.base ** Math.min(context.run.winStreak, effect.maximum);
    case 'same-suit': return context.cards.every(card => card.suit === context.cards[0].suit) ? effect.multiplier : 1;
    case 'per-depth': return 1 + effect.amount * context.run.depth;
    case 'scale': {
      const cards = context.cards, round = context.run.round;
      const metric = {
        sevens: () => cards.filter(card => card.rank === '7').length,
        faces: () => cards.filter(card => ['J', 'Q', 'K'].includes(card.rank)).length,
        aces: () => cards.filter(card => card.rank === 'A').length,
        suits: () => Math.max(0, new Set(cards.map(card => card.suit)).size - 1),
        extraCards: () => Math.max(0, cards.length - 2),
        rescues: () => round.rescues,
        splits: () => round.splits,
        charms: () => Math.max(0, context.run.charms.length - 1),
        pairs: () => cards.slice(1).filter((card, i) => card.rank === cards[i].rank).length,
        streak: () => context.run.winStreak,
      }[effect.metric];
      return 1 + effect.amount * Math.min(effect.maximum, metric ? metric() : 0);
    }
    default: return 1;
  }
}

function applyAfter(run, context, effect) {
  if (effect.type === 'natural-every' && context.natural && run.bjStreak % effect.count === 0) run.growth[effect.growth] += effect.amount;
  if (effect.type === 'on-win' && context.won) run.growth[effect.growth] += effect.amount;
  if (effect.type === 'on-natural' && context.natural) run.growth[effect.growth] += effect.amount;
}

// The catalogue stays as readable data in data/charms/<rarity>.json. This adapter
// turns declarative effects into the engine hooks used by the game.
const catalogue = [...common.charms, ...rare.charms, ...epic.charms, ...legendary.charms, ...scaling.charms];

export const CHARMS = catalogue.map(charm => ({
  ...charm,
  configure: charm.configure?.length ? rules => charm.configure.forEach(effect => configure(rules, effect)) : undefined,
  win: charm.win?.length ? context => charm.win.reduce((multiplier, effect) => multiplier * winMultiplier(context, effect), 1) : undefined,
  after: charm.after?.length ? (run, context) => charm.after.forEach(effect => applyAfter(run, context, effect)) : undefined,
}));

export const CHARM_BY_ID = Object.fromEntries(CHARMS.map(charm => [charm.id, charm]));
export const ACTIVE_CHARMS = CHARMS.filter(charm => charm.enabled !== false);

export function rulesFor(run) {
  const rules = {
    rescues: 1,
    seven: false,
    dice: false,
    extraHands: 0,
    blackjack: 1.5 + run.growth.blackjack,
    multiplier: 1 + run.growth.multiplier,
    twins: 1,
    jackpot: 1,
    refund: 0,
    fiveCard: false,
    bustBonus: 0,
    luckyPenny: false,
    winBonus: 0,
    ranks: Object.fromEntries(RANKS.map(rank => [rank, 1])),
    suits: Object.fromEntries(SUITS.map(suit => [suit, 1])),
  };
  for (const id of run.charms) {
    const charm = CHARM_BY_ID[id];
    if (charm?.enabled !== false) charm?.configure?.(rules);
  }
  return rules;
}
