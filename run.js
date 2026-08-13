/**
 * run.js — Headless experiment runner.
 *
 * Sweeps the server count (the independent variable of the AP Research
 * study) and runs N replications per level with different seeds, then
 * reports means with 95% confidence intervals. This is the harness to
 * validate against the SimPy model: same parameter set, both models'
 * CIs for mean wait should overlap.
 *
 *   node run.js            -> sweep servers 3..7, 30 reps each
 *   node run.js --once     -> single verbose service, one seed
 */

import { DEFAULT_PARAMS } from "./params.js";
import { runService, summarize } from "./model.js";

function withServers(base, n, seed) {
  return {
    ...base,
    capacity: { ...base.capacity, serversOnFloor: n },
    run: { ...base.run, seed },
  };
}

function ci95(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  const half = 1.96 * Math.sqrt(v / xs.length);
  return { mean: m, half };
}

if (process.argv.includes("--once")) {
  const { parties, snapshots } = runService(
    { ...DEFAULT_PARAMS },
    { collectSnapshots: true }
  );
  const s = summarize(parties, DEFAULT_PARAMS.run.warmupMinutes);
  console.log("Single service:", s);
  console.log("First snapshots:", snapshots.slice(0, 5));
} else {
  const REPS = 30;
  console.log(
    "servers | parties | total min (95% CI) | table wait | server-stage wait"
  );
  console.log("-".repeat(78));
  for (let servers = 3; servers <= 7; servers++) {
    const totals = [], tWaits = [], sWaits = [], counts = [];
    for (let rep = 0; rep < REPS; rep++) {
      const params = withServers(DEFAULT_PARAMS, servers, 1000 + rep * 7919);
      const { parties } = runService(params);
      const s = summarize(parties, params.run.warmupMinutes);
      if (!s) continue;
      totals.push(s.meanTotalMin);
      tWaits.push(s.meanTableWaitMin);
      sWaits.push(s.meanServerWaitMin);
      counts.push(s.partiesServed);
    }
    const t = ci95(totals), tw = ci95(tWaits), sw = ci95(sWaits);
    const n = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
    console.log(
      `   ${servers}    |   ${String(n).padStart(3)}   | ` +
        `${t.mean.toFixed(1)} ± ${t.half.toFixed(1)}        | ` +
        `${tw.mean.toFixed(1)} ± ${tw.half.toFixed(1)}  | ` +
        `${sw.mean.toFixed(1)} ± ${sw.half.toFixed(1)}`
    );
  }
}
