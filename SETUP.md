# Floor Simulator — setup and usage

## What you have

Two versions of the same model. Use whichever fits where you are.

| File | Needs | Use it for |
|---|---|---|
| `floor-simulator.html` | Nothing. Any browser. | Watching service run, demoing, InVenture judging, screenshots for the paper |
| `restaurant-sim/` (5 JS files) | Node.js installed | Batch runs, exporting data, validating against SimPy |

The HTML file is fully self-contained. All the simulation code, the floor plan
renderer, and the batch runner are inside that one file. There is nothing to
install, no server to start, no build step, no internet required after the
first load (fonts come from Google Fonts; without a connection it falls back
to system fonts and still runs).

---

## Running it — the two-second version

1. Download `floor-simulator.html`
2. Double-click it

That's it. It opens in your default browser and dinner service starts running.

If double-clicking opens a text editor instead of a browser: right-click →
Open With → Chrome.

---

## Where to keep it

**Working copy:** anywhere. Desktop, Documents, doesn't matter.

**Real home: a GitHub repo.** Do this now rather than when it's "finished."
The commit history is timestamped proof you built this incrementally over
months, which matters for both journal submission and college credibility.

Suggested structure:

```
restaurant-floor-sim/
├── README.md              ← what it is, sources, findings
├── floor-simulator.html   ← the browser version
├── docs/
│   └── index.html         ← copy of the above, for GitHub Pages
├── src/                   ← the Node version
│   ├── engine.js
│   ├── model.js
│   ├── params.js
│   ├── run.js
│   └── package.json
└── data/
    ├── raw/               ← weekly POS pulls
    └── clean/             ← cleaned CSVs the model reads
```

### Getting it on GitHub (first time)

1. Make a free account at github.com
2. Click **New repository**, name it `restaurant-floor-sim`, make it **Public**
3. On the empty repo page click **uploading an existing file**
4. Drag your files in, write a commit message, click **Commit changes**

No Git install needed for that path. If you want the command-line version
later, that's `git init` → `git add .` → `git commit` → `git push`, but the
web uploader is completely fine and you already know where to find me for
the CLI setup.

### Getting a live link (GitHub Pages)

1. Copy `floor-simulator.html` into a `docs/` folder, renamed `index.html`
2. Repo → **Settings** → **Pages**
3. Source: **Deploy from a branch**, Branch: **main**, Folder: **/docs**
4. Save, wait ~60 seconds

You get `https://yourusername.github.io/restaurant-floor-sim/` — a live
simulation anyone can open. That link goes in your Common App Additional
Information section, on your InVenture poster as a QR code, and in the
journal submission as a code availability statement.

---

## Using the interface

### Controls (right panel)

**Servers** — the independent variable. How many servers are on the floor.
**Tables** — floor size. Section size updates automatically as the ratio.
**Section size** — read-only. Tables per server. This is your study variable.
**Line cooks** — kitchen capacity. Turn this down to move the bottleneck.
**Parties / hour** — demand. 9 is a slow Tuesday, 15 is busy, 25+ is slammed.
**Speed** — playback multiplier. 60× means one real second is one sim minute.
**Pause / Play** — freeze the floor to read a moment.
**Reset** — new random seed, fresh service. Changing any slider auto-resets.

### Reading the floor

Table colors: grey = open, blue-slate = seated or ordering, amber = waiting
on the kitchen, green = dining, **rust = waiting on a server**, tan = bussing.

Rust is the color your paper is about. When you starve the floor of servers,
rust spreads — and it spreads *unevenly*, clustered in the overloaded
sections while other sections stay clean. That visual is the sectioned-server
finding, and it's more persuasive to a judge than a table of numbers.

The **DOOR** column on the left is the waitlist. Each dot is a party standing
there. The **SERVERS** strip on the right shows each server's pending task
count — grey is idle, amber is one task queued, rust is backed up.

The chart under the floor is waitlist length over the whole service, so you
can see the rush build and drain.

### Batch comparison

The **Sweep server count** button runs the model 30 times at each staffing
level from 2 to 8 servers, using whatever tables / demand / cooks you have
set, and prints mean delays. This is the part that produces numbers for the
paper. It respects your current slider settings, so sweep once at each
demand level and you have your full results grid.

---

## Three experiments worth running

**1. Find the cliff.** Set 20 tables, 15 parties/hour. Sweep. Look at where
check wait stops being small and starts being ugly. Under placeholder
parameters that's between 3 and 2 servers — a 25% load increase roughly
triples check wait. Nonlinearity is the whole point.

**2. Watch the bottleneck migrate.** Set parties/hour to 28. Sweep. Order and
check waits collapse toward zero as you add servers, but **table wait
refuses to drop**. Past a certain staffing level, servers stop being the
constraint and table inventory takes over. Extra servers cannot turn a table
occupied by people still eating.

**3. The Laurel comparison.** 4 servers / 16 tables gives 1:4. Change tables
to 20 for 1:5. Same demand per table, one more table each. That difference
is the question in your intro paragraph, and now it has a number.

---

## Before you report any of this

Every service-time mean in the model is a placeholder. They are reasonable,
but they are not measured. Open the HTML file in any text editor, find the
`STAGES` block near the top of the `<script>` section, and replace the means
with your field data as it comes in:

```js
const STAGES={
  greetSeat:{mean:2.0,s:0.5},   // greet-to-seated
  order:{mean:6.0,s:0.6},       // seated-to-order-fired
  kitchen:{mean:18.0,s:0.4},    // ticket-to-pass
  dine:{mean:45.0,s:0.35},      // entree-to-plates-cleared
  check:{mean:7.0,s:0.5},       // check-drop-to-paid
  bus:{mean:3.0,s:0.5}          // cleared-to-reset
};
```

`mean` is minutes. `s` is the lognormal shape parameter — higher means a
longer right tail, more unpredictable. You can estimate it from your data:
`s = sqrt(ln(1 + (stdev/mean)^2))`.

Until those are real numbers, report the *shape* of the findings and say so
explicitly in your limitations section.

## Known limitations to name in the paper

- Service time distributions are assumed lognormal and stationary; late-night
  parties likely follow a different distribution, and your table-20 story
  suggests exactly that.
- The host balances seating across sections perfectly, which real hosts do
  not.
- Bussers are fixed at 2 and not exposed as a control.
- No server-side variation in skill or speed — every server is identical.
- Parties never renege (leave the waitlist). Real guests walk out.
