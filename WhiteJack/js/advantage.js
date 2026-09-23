import { startHand, act, suggestedAction, initialStake } from './engine.js';

// Independent Monte Carlo samples of the NEXT hand. Uses the real engine, never the
// live shoe, dealer hole card or gameplay random stream. Persistent growth is held
// at its current value at the start of each sample, rather than invented bonuses.
export function estimateAdvantage(snapshot, samples = 18000) {
  const stake = initialStake(snapshot);
  if (snapshot.bank < stake) return { unavailable: true, samples: 0 };
  let mean = 0, m2 = 0;
  for (let i = 0; i < samples; i++) {
    const s = { ...snapshot, seed: (0x1234ABCD + Math.imul(i + 1, 2654435761)) >>> 0, charms: [...snapshot.charms], growth: { ...snapshot.growth }, phase: 'ready', played: 0, qualified: false, round: null };
    startHand(s);
    let steps = 0;
    while (['playing', 'bust-choice'].includes(s.phase) && steps++ < 100) {
      const choice = suggestedAction(s); act(s, choice.action, choice.index);
    }
    if (s.phase !== 'result') throw new Error('Simulation failed to settle');
    const result = s.round.net / stake, delta = result - mean;
    mean += delta / (i + 1); m2 += delta * (result - mean);
  }
  return { edge: mean * 100, margin: 1.96 * Math.sqrt(m2 / (samples - 1) / samples) * 100, expected: mean * stake, samples };
}
