/**
 * engine.js — Generic discrete-event simulation core.
 * No restaurant logic lives here; this file is reusable for any DES.
 */

// ---- Seeded RNG (mulberry32) — reproducibility is non-negotiable for
// research code: same seed + same params must give the same output, or
// results can't be validated against the SimPy model.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Distribution samplers ----------------------------------------
export function sampleExponential(rng, mean) {
  return -mean * Math.log(1 - rng());
}

// Box-Muller normal, then exponentiate. Parameterized so that the
// returned lognormal has the requested arithmetic mean (mu is solved
// from mean and sigma: mu = ln(mean) - sigma^2/2).
export function sampleLognormal(rng, mean, sigma) {
  const mu = Math.log(mean) - (sigma * sigma) / 2;
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

export function sampleStage(rng, stage) {
  switch (stage.dist) {
    case "exponential":
      return sampleExponential(rng, stage.meanMin);
    case "lognormal":
      return sampleLognormal(rng, stage.meanMin, stage.sigma);
    case "fixed":
      return stage.meanMin;
    default:
      throw new Error(`Unknown distribution: ${stage.dist}`);
  }
}

// ---- Binary min-heap keyed on event.time ---------------------------
export class EventQueue {
  constructor() {
    this.heap = [];
    this.seq = 0; // tie-breaker so simultaneous events stay FIFO
  }
  push(time, type, payload) {
    this.heap.push({ time, seq: this.seq++, type, payload });
    this._up(this.heap.length - 1);
  }
  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._down(0);
    }
    return top;
  }
  get size() {
    return this.heap.length;
  }
  _less(i, j) {
    const a = this.heap[i], b = this.heap[j];
    return a.time < b.time || (a.time === b.time && a.seq < b.seq);
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this._less(i, p)) break;
      [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]];
      i = p;
    }
  }
  _down(i) {
    const n = this.heap.length;
    for (;;) {
      const l = 2 * i + 1, r = 2 * i + 2;
      let m = i;
      if (l < n && this._less(l, m)) m = l;
      if (r < n && this._less(r, m)) m = r;
      if (m === i) break;
      [this.heap[i], this.heap[m]] = [this.heap[m], this.heap[i]];
      i = m;
    }
  }
}

// ---- Simulation shell ----------------------------------------------
// handlers: { [eventType]: (sim, payload) => void }
// Each handler may call sim.schedule(delayMin, type, payload).
export class Simulation {
  constructor({ seed, handlers, onSnapshot = null, snapshotEveryMin = 1 }) {
    this.rng = makeRng(seed);
    this.clock = 0;
    this.queue = new EventQueue();
    this.handlers = handlers;
    this.onSnapshot = onSnapshot;
    this.snapshotEveryMin = snapshotEveryMin;
    this._nextSnapshot = 0;
  }
  schedule(delayMin, type, payload) {
    this.queue.push(this.clock + delayMin, type, payload);
  }
  scheduleAt(timeMin, type, payload) {
    this.queue.push(timeMin, type, payload);
  }
  run(untilMin) {
    while (this.queue.size > 0) {
      const ev = this.queue.pop();
      if (ev.time > untilMin) break;
      // Emit renderer snapshots between the previous clock and this event.
      if (this.onSnapshot) {
        while (this._nextSnapshot <= ev.time) {
          this.onSnapshot(this._nextSnapshot);
          this._nextSnapshot += this.snapshotEveryMin;
        }
      }
      this.clock = ev.time;
      const handler = this.handlers[ev.type];
      if (!handler) throw new Error(`No handler for event: ${ev.type}`);
      handler(this, ev.payload);
    }
    this.clock = untilMin;
  }
}

// ---- Resource pool with FIFO queue ---------------------------------
// The atom of queueing behavior: request() either grants immediately or
// enqueues; release() hands the freed unit to the next waiter.
export class ResourcePool {
  constructor(name, capacity) {
    this.name = name;
    this.capacity = capacity;
    this.inUse = 0;
    this.waiting = []; // [{enqueuedAt, grant}]
    this.queueLengthLog = []; // [t, queueLen] pairs for metrics
  }
  request(sim, grant) {
    if (this.inUse < this.capacity) {
      this.inUse++;
      grant(0); // waited 0 minutes
    } else {
      this.waiting.push({ enqueuedAt: sim.clock, grant });
    }
    this.queueLengthLog.push([sim.clock, this.waiting.length]);
  }
  release(sim) {
    this.inUse--;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      this.inUse++;
      next.grant(sim.clock - next.enqueuedAt);
    }
    this.queueLengthLog.push([sim.clock, this.waiting.length]);
  }
}
