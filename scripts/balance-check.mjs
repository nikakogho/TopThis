import fs from 'node:fs';
import {
  applyCommand,
  createMatch,
  getLegalCardInstanceIds,
} from '../packages/game-engine/dist/index.js';

const seedsArgument = process.argv.find((argument) => argument.startsWith('--seeds='));
const seedCount = Number(seedsArgument?.slice('--seeds='.length) ?? 40);
if (!Number.isInteger(seedCount) || seedCount < 1)
  throw new Error('Use a positive integer: --seeds=<count>');

const definitions = JSON.parse(
  fs.readFileSync(new URL('../content/cards.json', import.meta.url), 'utf8'),
);
const reportPlayerCounts = [2, 3, 4, 5, 6];
const gatedPlayerCounts = new Set([2, 3, 4]);
const playerIds = (count) => Array.from({ length: count }, (_, index) => `p${index + 1}`);
const percentile = (sorted, fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
const metrics = (piles) => {
  const sorted = [...piles].sort((left, right) => left - right);
  const mean = piles.reduce((total, value) => total + value, 0) / piles.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    rounds: piles.length,
    mean,
    median,
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    fiveCardRate: piles.filter((value) => value >= 5).length / piles.length,
    eightCardRate: piles.filter((value) => value >= 8).length / piles.length,
  };
};

function playMatch(count, seed) {
  let state = createMatch({
    matchId: `balance-${count}-${seed}`,
    playerIds: playerIds(count),
    definitions,
    seed,
    targetScore: 999,
  });
  const piles = [];
  let commandNumber = 0;
  while (state.phase !== 'completed') {
    const commandId = `balance-${count}-${seed}-${commandNumber++}`;
    let command;
    if (state.phase === 'round_result') {
      piles.push(state.roundResult.pileCount);
      command = {
        type: 'advanceRound',
        commandId,
        matchId: state.matchId,
        expectedStateVersion: state.stateVersion,
      };
    } else {
      const legal = getLegalCardInstanceIds(state, state.turnPlayerId);
      command = legal.length
        ? {
            type: 'play',
            commandId,
            matchId: state.matchId,
            expectedStateVersion: state.stateVersion,
            expectedTurnId: state.turnId,
            playerId: state.turnPlayerId,
            cardInstanceId: legal[0],
          }
        : {
            type: 'skip',
            commandId,
            matchId: state.matchId,
            expectedStateVersion: state.stateVersion,
            expectedTurnId: state.turnId,
            playerId: state.turnPlayerId,
          };
    }
    const result = applyCommand(state, command);
    if (!result.accepted) throw new Error(`Balance command rejected: ${result.error}`);
    state = result.state;
    if (commandNumber > 10000)
      throw new Error(`Balance simulation did not complete for ${count}/${seed}`);
  }
  return piles;
}

const byPlayerCount = new Map();
const allPiles = [];
const gatedPiles = [];
for (const count of reportPlayerCounts) {
  const piles = Array.from({ length: seedCount }, (_, seed) => playMatch(count, seed)).flat();
  allPiles.push(...piles);
  if (gatedPlayerCounts.has(count)) gatedPiles.push(...piles);
  byPlayerCount.set(count, metrics(piles));
}
// Preserve the established 2–4-player release thresholds while reporting the new 5/6 modes.
const overallMetrics = metrics(gatedPiles);
const allPlayerMetrics = metrics(allPiles);
const thresholds = [
  [overallMetrics.mean >= 5, `overall mean ${overallMetrics.mean.toFixed(2)} < 5.00`],
  [overallMetrics.median >= 4, `overall median ${overallMetrics.median} < 4`],
  [
    overallMetrics.fiveCardRate >= 0.4,
    `five-card rate ${(overallMetrics.fiveCardRate * 100).toFixed(1)}% < 40.0%`,
  ],
  [
    byPlayerCount.get(2).mean >= 3.4,
    `two-player mean ${byPlayerCount.get(2).mean.toFixed(2)} < 3.40`,
  ],
];
for (const [passed, message] of thresholds)
  if (!passed) throw new Error(`Balance threshold failed: ${message}`);

const print = (label, value) =>
  console.log(
    `${label}: rounds=${value.rounds}, mean=${value.mean.toFixed(2)}, median=${value.median.toFixed(2)}, p75=${value.p75}, p90=${value.p90}, >=5=${(value.fiveCardRate * 100).toFixed(1)}%, >=8=${(value.eightCardRate * 100).toFixed(1)}%`,
  );
console.log(
  `TopThis deterministic first-legal balance analysis (${seedCount} seeds per player count)`,
);
for (const [count, value] of byPlayerCount) print(`${count} players`, value);
print('gated 2–4 overall', overallMetrics);
print('all 2–6 overall', allPlayerMetrics);
