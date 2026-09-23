# White Jack

A self-contained, pixel-art blackjack roguelike for the Game Studio launcher. No real money, server, package installation, build step, external fonts, or CDN dependencies.

## Play locally and deploy

From the repository root:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open **http://127.0.0.1:8080/WhiteJack/**. Serve over HTTP; `file://` blocks ES modules and module workers in browsers. A current Chrome, Edge, Firefox, or Safari is recommended.

GitHub Pages can serve the existing repository root unchanged. The launcher links to `WhiteJack/index.html`; every game asset uses relative paths, including the worker URL. No SPA rewrites, secret keys, backend, or deployment workflow are needed. Publishing still follows the repository’s existing Pages/branch setup.

## The prototype

- **Start:** $100 bankroll, $10 main wager, $120 first goal.
- **Depths:** seven hands each. Targets grow by 1.65×, rounded to $5. The initial minimum wager is $5 and grows by 1.45× per Depth, rounded down. Main and side wagers are adjustable before each hand.
- **Progress:** reaching the target once secures the next Depth. Spending in the shop does not revoke a secured target. Descending pays a bonus of $30 × 1.5^(completed Depth − 1), refreshes the shop, and restores the hand allowance. You can finish remaining hands before descending. If a large win already covers the next target, that Depth is secured immediately too.
- **Second Chance:** when a card busts a hand, it remains visibly marked. Choose to redraw that card or keep the bust. One use is available per dealt round across all split hands; the replacement can still bust.
- **Twins:** unlocks at Depth 2; every adjacent equal-rank pair pays 6:1 mixed color, 12:1 same color, or 25:1 identical suit. Pairs formed before a split keep their payout, and new pairs in split hands pay again.
- **Jackpot:** unlocks at Depth 3; the best run of two or more consecutive sevens anywhere in an unsplit hand pays 50:1 / 100:1 for two / suited two, or 500:1 / 5000:1 for three / suited three. Highest tier only.
- **Back Room:** Depth 1 has no shop. Entering Depth 2 automatically opens the first shop, where one charm is free and rerolls are unavailable. Later Depths automatically open one shop visit before the first hand; closing it ends that Depth's visit. Rerolls cost $6 × 1.8^reroll-count, rounded, and reset each Depth. Charm prices grow 22% per Depth. Seven slots, one of each charm; selling returns half the base catalogue price. Already-earned permanent growth remains after selling. Shop rolls draw Common / Rare / Epic / Legendary charms at 60% / 30% / 8% / 2%.
- **Charm unlocks:** seven and Jackpot focused charms enter the shop at Depth 3. Ten scaling charms reward card ranks, suits, long hands, redraws, splits, owned charms, matching pairs, and win streaks.
- **Run end:** no hands or no affordable main wager, without a secured goal. New Run asks before replacing a saved run.

The goal curve, charm prices, and explosive builds are prototype balance choices. They have not been tuned through broad playtesting. Strong combinations intentionally stack multiplicatively: natural-blackjack streaks, weighted suited sevens, or a growing general profit multiplier.

## Blackjack rules

Each hand starts with a freshly shuffled six-deck shoe; the dealer stands on soft 17. Natural blackjack pays 3:2 profit, ordinary wins 1:1, and ties push. Winnings return the stake in addition to profit. The dealer does not peek before player actions: a player who reaches 21 ties a dealer blackjack. Reaching 21 after a draw leaves the hand playable until the player stands. No surrender.

Double any unmodified two-card hand, including after a split: add the current hand’s wager, take one card, then stand. Split equal-value cards at most twice, for up to three hands. Split aces receive one card each and cannot be resplit; other split hands have no extra draw limit. A split or transformed 21 is not a natural. Streaks update once per original dealt round: natural pushes count for natural streaks; main-hand pushes do not continue a win streak.

## Architecture

Plain browser ES modules keep this small static game easy to host and edit. The DOM provides accessible native buttons, dialogs, and responsive layout. Original pixel artwork is SVG; the font is bundled. No game engine is necessary for a turn-based card table.

| File | Responsibility |
| --- | --- |
| `index.html` | Static application shell and semantic controls |
| `style.css` | Responsive felt table, card presentation, shop, and motion |
| **`data/charms/*.json`** | **Readable charm catalogue, including ten scaling charms in `scaling.json`** |
| `js/charms.js` | Small adapter that turns JSON effects into engine hooks |
| `js/engine.js` | Seeded dealing, legal actions, settlement, streaks, side bets, progression, shop, and reference strategy; no DOM |
| `js/advantage.js` | Monte Carlo estimator using the same engine as live play |
| `js/advantage-worker.js` | Worker boundary; keeps simulations off the UI thread |
| `js/main.js` | UI rendering, input, audio, save/resume, worker lifecycle, and help |
| `js/art.js` | Original pixel icons and anonymous dealer art |
| `assets/white-jack-pixel.ttf` | Bundled original 5×7 pixel font |
| `assets/build_font.py` | Optional source generator for the font; requires FontTools only when regenerating |
| `tests/` | Browser-native engine, simulation, and UI verification |

### Adding a charm

Add an entry to a charm catalogue JSON file imported by `js/charms.js`. Each effect is readable data, while `js/charms.js` provides the generic engine hooks.

```json
{
  "id": "example",
  "name": "Example",
  "icon": "star",
  "rarity": "rare",
  "price": 35,
  "text": "Description visible in the shop.",
  "configure": [{ "type": "add", "key": "blackjack", "amount": 0.25 }]
}
```

Set `"enabled": false` to retain a charm definition without offering it in shops or applying its effects. Set `"requires": 3` to offer a charm from Depth 3 onward. `rulesFor(run)` composes owned enabled charms into rules at the start of each hand. `configure` adjusts rank/suit weights, redraws, payouts, refunds, available actions, or hand limits. `win` multiplies main-hand profit; the original stake is not multiplied. The `scale` win effect uses a named metric, an amount per stack, and a maximum stack count. `after` mutates permanent growth after the current hand settles, making that growth available to future hands. A genuinely new type of action needs an engine implementation; the estimator then uses it through the same action API and reference policy.

### Player’s Advantage

**100 × expected next-hand net profit / initial total wager**, including enabled side bets. All additional split/double costs and returns are part of net profit. This convention expresses return relative to the original committed wager, not every extra unit wagered later.

The worker simulates 18,000 independent next hands using the actual rule engine. Each sample begins with the current bankroll, charms, permanent growth, streaks, wager and enabled side bets. Seeds are deterministic and separate from live gameplay. Neither the current shoe nor the hidden dealer card is used. Live gameplay’s random stream is untouched.

The reference policy uses public-information basic strategy and is a consistent comparison policy, **not an optimal solver for every charm combination**. Displayed uncertainty is an approximate 95% Monte Carlo interval. Heavy-tailed jackpots may be missed by a finite sample, so even that interval is not a guarantee. This limitation is explained in-game.

Recalculates after purchases, sales, wager/side-bet changes, hand settlement and Depth changes. During play the display retains the pre-deal estimate. Already-earned permanent growth is included; future growth, shop purchases and Depth rewards are excluded. Additional playable hands affect the displayed remaining opportunities rather than inflating a per-wager return. Old workers are terminated when a newer build needs estimating.

### Persistence and presentation

Local storage key: `gamestudio.whitejack.v1`. The entire run, including the current shoe and PRNG state, saves after each action; reloading resumes the hand rather than rerolling it. Invalid/version-mismatched saves fall back to a new run. Storage failures are visible and do not prevent play. This is local convenience persistence, not anti-cheat or cloud sync.

Sound starts on: card deals use `assets/Card_dealt.wav`, while reward cues are synthesized locally. Motion honors `prefers-reduced-motion`. Cards, actionable charm slots, buttons and modal dialogs support keyboard input. Short hints introduce the basics; detailed rules stay inside expandable reference sections.

## Verification

Serve the repository, then open **http://127.0.0.1:8080/WhiteJack/tests/**. No test package installation is needed. The page reports pass/fail and restores the prior White Jack save when UI tests finish. Avoid playing another run in the same browser profile while these tests are running.

Coverage includes ace arithmetic, dealer soft 17, delayed dealer blackjack settlement, player 21 ties, active redraw choices, double and split stakes, split aces and limits, side-bet tiers/unlocks, all charm families, progression, inventory/rerolls, save/resume, simulation determinism and sensitivity, 1,000 seeded random charm builds with money-conservation checks, and real DOM interactions at five viewport widths.

Open `js/engine.js` for balance constants: `goalFor`, `minBet`, `maxHands`, `sideStake`, `refreshCost`, `charmPrice`, and `descend`. All cash settlement rounds to cents.
