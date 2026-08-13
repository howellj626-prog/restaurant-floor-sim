/**
 * params.js — Model parameters for the restaurant floor simulator.
 *
 * DESIGN RULE: every number in this file carries a `source` field.
 * Three source tiers:
 *   "LITERATURE"  — from a published academic study (citation included)
 *   "FIELD"       — from my own AP Research data log (to be filled in as
 *                   the 8-week collection completes)
 *   "PLACEHOLDER" — reasonable starting value, MUST be replaced before
 *                   any result is reported
 *
 * The six-stage service structure follows Kimes's meal-duration framework
 * (Cornell Nolan School of Hotel Administration), which decomposes the
 * dining experience into sequential phases: pre-process (greet/seat),
 * order, food production, service/consumption, check, and table reset.
 * Each stage below maps to one node of the tandem queue.
 *
 * Multi-station restaurant queueing networks (order -> kitchen -> delivery)
 * modeled as chained M/M/s stations follow the approach in the Bangladesh
 * restaurant network study (see README references). This sim generalizes
 * that to G-distributed service times, which is why we simulate instead of
 * only computing closed-form Erlang-C answers.
 */

export const DISTRIBUTIONS = {
  EXPONENTIAL: "exponential",
  LOGNORMAL: "lognormal",
  FIXED: "fixed",
};

export const DEFAULT_PARAMS = {
  // ---- Arrivals -----------------------------------------------------
  arrivals: {
    // Poisson arrivals are the standard assumption for restaurant
    // customer streams in the queueing literature (Erlang's foundational
    // work; applied restaurant studies consistently model arrivals as
    // Poisson with peaks at meal periods).
    process: "poisson",
    // Parties per minute during peak. The Sushi Tei case study measured
    // 2.22 customers/min at peak for casual dining; fine dining runs far
    // lower and party-based, so treat this as a shape reference only.
    peakRatePerMin: 0.15, // ~9 parties/hour to the host stand
    source: {
      tier: "PLACEHOLDER",
      note:
        "Replace with host-stand arrival counts from my field data log. " +
        "Literature anchor: M/M/1 casual-dining case measured 2.22 " +
        "customers/min peak (Dharmawirya & Adi 2013 style study, Jakarta).",
    },
    // Party size distribution — placeholder until field data arrives.
    partySizeWeights: { 1: 0.08, 2: 0.47, 3: 0.15, 4: 0.22, 5: 0.05, 6: 0.03 },
  },

  // ---- Capacity -----------------------------------------------------
  capacity: {
    tables: 20,
    serversOnFloor: 5, // the independent variable of the whole study
    tablesPerSection: 4,
    source: {
      tier: "FIELD",
      note: "Match to my restaurant's actual floor plan and section map.",
    },
  },

  // ---- Service stages (the tandem queue) ----------------------------
  // Stage means are in minutes. Lognormal is used for human-performed
  // stages because empirical service times are right-skewed (a table
  // that chats for 10 extra minutes is common; a negative-time table is
  // impossible). sigma is the lognormal shape parameter.
  stages: [
    {
      id: "greetSeat",
      resource: "host",
      dist: DISTRIBUTIONS.LOGNORMAL,
      meanMin: 2.0,
      sigma: 0.5,
      source: {
        tier: "PLACEHOLDER",
        note: "Kimes pre-process phase. Replace with greet-to-seat times from data log.",
      },
    },
    {
      id: "orderTaken",
      resource: "server",
      dist: DISTRIBUTIONS.LOGNORMAL,
      meanMin: 6.0,
      sigma: 0.6,
      source: {
        tier: "PLACEHOLDER",
        note: "Seat-to-order-placed. Kimes order phase.",
      },
    },
    {
      id: "kitchen",
      resource: "kitchen",
      dist: DISTRIBUTIONS.LOGNORMAL,
      meanMin: 18.0,
      sigma: 0.4,
      source: {
        tier: "PLACEHOLDER",
        note:
          "Ticket-to-pass time. Kitchen modeled as its own multi-server " +
          "station per the restaurant queueing-network literature.",
      },
    },
    {
      id: "dine",
      resource: null, // consumes only the table, not a staff member
      dist: DISTRIBUTIONS.LOGNORMAL,
      meanMin: 45.0,
      sigma: 0.35,
      source: {
        tier: "LITERATURE",
        note:
          "Kimes & Robson (Cornell Hospitality Quarterly 45(4), 2004) " +
          "measured full-service meal durations by table type in a " +
          "sit-down restaurant; Kimes's revenue-management work treats " +
          "consumption as the longest, least-compressible phase. Tune the " +
          "mean to fine dining with field data; keep the lognormal shape.",
      },
    },
    {
      id: "checkPay",
      resource: "server",
      dist: DISTRIBUTIONS.LOGNORMAL,
      meanMin: 7.0,
      sigma: 0.5,
      source: {
        tier: "LITERATURE",
        note:
          "Cornell tabletop-technology report (Susskind, Cornell " +
          "Hospitality Report 16(22), 2016) found payment is a major " +
          "compressible chunk of duration — useful for a what-if lever.",
      },
    },
    {
      id: "bus",
      resource: "busser",
      dist: DISTRIBUTIONS.LOGNORMAL,
      meanMin: 3.0,
      sigma: 0.5,
      source: {
        tier: "FIELD",
        note: "I bus tables — measure my own reset times.",
      },
    },
  ],

  // ---- Staff pools ---------------------------------------------------
  resources: {
    host: 1,
    server: 5, // kept in sync with capacity.serversOnFloor by the model
    kitchen: 4, // parallel line cooks ≈ parallel servers in an M/G/s sense
    busser: 2,
  },

  // ---- Run control ----------------------------------------------------
  run: {
    serviceMinutes: 240, // one 4-hour dinner service
    warmupMinutes: 30, // discard stats before steady state
    seed: 12345,
  },
};
