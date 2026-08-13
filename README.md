# Restaurant Floor Simulator

A discrete-event simulation of a full-service restaurant modeled as a tandem
queueing network, built to study how the server-to-table ratio affects
service pacing. Companion to my AP Research project; validated against a
SimPy reference model.

## Structure

```
engine.js   Generic DES core: seeded RNG, samplers, min-heap event queue,
            simulation clock, FIFO resource pools. No restaurant logic.
model.js    The restaurant: six service stages wired as event handlers,
            staff pools as constrained resources, metrics summarizer.
params.js   Every model constant, each tagged LITERATURE / FIELD /
            PLACEHOLDER with its citation or data-collection plan.
run.js      Experiment harness: sweeps server count, 30 replications per
            level, 95% confidence intervals.
```

Run: `node run.js` (sweep) or `node run.js --once` (single service with
renderer snapshots).

## Academic sources

Model structure and parameters are grounded in the following. Full-text
versions of the Cornell reports are available free from the School of
Hotel Administration's site (sha.cornell.edu / Center for Hospitality
Research archive); journal articles via school library databases or
ResearchGate.

**Meal-phase framework and duration management**
- Kimes, S. E., & Robson, S. K. A. (2004). The impact of restaurant table
  characteristics on meal duration and spending. *Cornell Hotel and
  Restaurant Administration Quarterly*, 45(4), 333-346.
  doi:10.1177/0010880404270063 — empirical meal-duration measurement in a
  full-service restaurant; basis for the `dine` stage being modeled as the
  longest, least-compressible phase.
- Kimes, S. E. — restaurant revenue management framework (Cornell Nolan
  School). Decomposes dining into six sequential phases; this maps
  one-to-one onto the tandem queue stages in `model.js`.
- Noone, B., & Kimes, S. E. (2005). Dining duration and customer
  satisfaction (Cornell Center for Hospitality Research). Guest
  satisfaction is tied to *perceived pace* — supports pacing, not just
  throughput, as the dependent variable.

**Payment-phase compressibility**
- Susskind, A. (2016). The influence of tabletop technology in
  full-service restaurants. *Cornell Hospitality Report*, 16(22).
  Payment tech significantly reduced dining time and server workload —
  used to justify the `checkPay` what-if lever.

**Queueing-network modeling of restaurants**
- Multi-station restaurant queueing network design (order → kitchen →
  delivery as chained M/M/s stations), e.g., the Bangladesh restaurant
  network study (2014, ResearchGate 284451408) — precedent for modeling
  the kitchen as its own multi-server station.
- Dharmawirya, M., & Adi, E. (2013-style case study). M/M/1 analysis of a
  Jakarta restaurant using Little's Law; measured peak arrival ~2.22
  customers/min — arrival-process shape reference.
- Erlang's foundational queueing work (1908 onward): Poisson arrivals +
  exponential/general service; the reason `run.js` results are compared
  against Erlang-C closed forms where the model reduces to M/M/s.

**Primary field data**
- My own 8-week observational data log (fine-dining restaurant,
  East Cobb GA area), collected under the AP Research methodology.
  Replaces every PLACEHOLDER in `params.js` before results are reported.

## Validation protocol

1. Configure this model and the SimPy model with identical parameters.
2. Run 30+ replications of each at every server-count level.
3. Compare mean wait and total-duration confidence intervals — they must
   overlap. Where the model reduces to M/M/s (exponential stages), also
   compare against Erlang-C analytical values.
4. Only after validation, swap in field-data parameters.

## Roadmap

- [ ] Replace PLACEHOLDER params with field data (through mid-December)
- [ ] Canvas floor-plan renderer consuming `snapshots`
- [ ] Live queue-length charts
- [ ] Config panel (servers, arrival rate, pacing levers)
- [ ] Web Worker wrapper for in-browser replication batches
