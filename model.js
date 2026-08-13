/**
 * model.js — The restaurant as a tandem queueing network.
 *
 * A party flows through the six Kimes-style stages in sequence:
 *   arrive -> [table+host] greetSeat -> [server] orderTaken ->
 *   [kitchen] cook -> dine -> [server] checkPay -> [busser] bus -> table freed
 *
 * Each bracketed resource is a ResourcePool. Waiting for a resource at
 * any stage is where queueing delay is born, and the per-stage wait
 * breakdown is the headline output for the server-to-table-ratio study.
 */

import { Simulation, ResourcePool, sampleStage, sampleExponential } from "./engine.js";

export function runService(params, { collectSnapshots = false } = {}) {
  const pools = {
    table: new ResourcePool("table", params.capacity.tables),
    host: new ResourcePool("host", params.resources.host),
    server: new ResourcePool("server", params.capacity.serversOnFloor),
    kitchen: new ResourcePool("kitchen", params.resources.kitchen),
    busser: new ResourcePool("busser", params.resources.busser),
  };

  const stageById = Object.fromEntries(params.stages.map((s) => [s.id, s]));
  const parties = []; // completed party records
  const snapshots = [];
  let nextPartyId = 0;

  const state = {
    seatedCount: 0,
    hostQueue: () => pools.table.waiting.length,
  };

  // Run a resource-backed stage: wait for the pool, hold it for a
  // sampled duration, then release and continue.
  function doStage(sim, party, stageId, poolName, next) {
    const stage = stageById[stageId];
    const pool = pools[poolName];
    pool.request(sim, (waited) => {
      party.waits[stageId] = waited;
      const dur = sampleStage(sim.rng, stage);
      party.durations[stageId] = dur;
      sim.schedule(dur, "stageDone", { party, stageId, poolName, next });
    });
  }

  const handlers = {
    partyArrives(sim, {}) {
      const party = {
        id: nextPartyId++,
        arrivedAt: sim.clock,
        waits: {},
        durations: {},
      };
      // Waiting for a table is the front-door queue guests feel most.
      pools.table.request(sim, (waited) => {
        party.waits.table = waited;
        state.seatedCount++;
        doStage(sim, party, "greetSeat", "host", "afterSeat");
      });
      // Schedule the next arrival (Poisson process => exponential gaps).
      const gap = sampleExponential(sim.rng, 1 / params.arrivals.peakRatePerMin);
      sim.schedule(gap, "partyArrives", {});
    },

    stageDone(sim, { party, stageId, poolName, next }) {
      pools[poolName].release(sim);
      handlers[next](sim, { party });
    },

    afterSeat(sim, { party }) {
      doStage(sim, party, "orderTaken", "server", "afterOrder");
    },
    afterOrder(sim, { party }) {
      doStage(sim, party, "kitchen", "kitchen", "afterKitchen");
    },
    afterKitchen(sim, { party }) {
      // Dining holds only the table — no staff pool involved.
      const dur = sampleStage(sim.rng, stageById.dine);
      party.durations.dine = dur;
      sim.schedule(dur, "afterDine", { party });
    },
    afterDine(sim, { party }) {
      doStage(sim, party, "checkPay", "server", "afterCheck");
    },
    afterCheck(sim, { party }) {
      doStage(sim, party, "bus", "busser", "afterBus");
    },
    afterBus(sim, { party }) {
      state.seatedCount--;
      pools.table.release(sim); // frees the table for the next waiter
      party.departedAt = sim.clock;
      party.totalMin = party.departedAt - party.arrivedAt;
      parties.push(party);
    },
  };

  const sim = new Simulation({
    seed: params.run.seed,
    handlers,
    onSnapshot: collectSnapshots
      ? (t) =>
          snapshots.push({
            t,
            seated: state.seatedCount,
            hostQueue: pools.table.waiting.length,
            serverQueue: pools.server.waiting.length,
            kitchenQueue: pools.kitchen.waiting.length,
          })
      : null,
  });

  sim.scheduleAt(0, "partyArrives", {});
  sim.run(params.run.serviceMinutes);

  return { parties, snapshots, pools };
}

// ---- Metrics --------------------------------------------------------
export function summarize(parties, warmupMinutes) {
  const kept = parties.filter((p) => p.arrivedAt >= warmupMinutes);
  if (kept.length === 0) return null;

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const pct = (xs, q) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  };

  const totals = kept.map((p) => p.totalMin);
  const tableWaits = kept.map((p) => p.waits.table ?? 0);
  const serverWaits = kept.map(
    (p) => (p.waits.orderTaken ?? 0) + (p.waits.checkPay ?? 0)
  );

  return {
    partiesServed: kept.length,
    meanTotalMin: mean(totals),
    p90TotalMin: pct(totals, 0.9),
    meanTableWaitMin: mean(tableWaits),
    p90TableWaitMin: pct(tableWaits, 0.9),
    meanServerWaitMin: mean(serverWaits),
    p90ServerWaitMin: pct(serverWaits, 0.9),
  };
}
