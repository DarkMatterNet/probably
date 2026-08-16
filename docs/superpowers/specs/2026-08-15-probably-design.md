# Probably — Interactive Probabilistic Data Structures Explorer

## Product intent

Probably is a polished, public GitHub Pages experience that makes probabilistic data structures visible and tactile. It is a portfolio artifact first: the page must feel like a finished open-source product rather than a classroom demo, dashboard, calculator, or advertising site.

The central question is: **How can a few kilobytes remember millions of things?**

The answer is explored through three real, browser-executed structures:

1. Bloom Filter — membership with false positives.
2. HyperLogLog — cardinality estimation.
3. Count-Min Sketch — frequency estimation.

A shared memory budget connects all three experiments and makes the certainty-versus-space trade-off visible.

## Audience and success criteria

Primary audience: developers, data scientists, students, hiring managers, and technically curious visitors.

A successful visitor experience has three layers:

- **Play:** the page is understandable within seconds and reacts immediately.
- **Understand:** interactions reveal why each structure behaves as it does.
- **Inspect:** formulas, parameters, implementation details, and source links are available without cluttering the default experience.

Success means a visitor can explain one trade-off after using the page, can share a stateful link, and perceives the project as a professional interactive artifact.

## Information architecture

### Global shell

- Compact sticky navigation with Probably wordmark, three experiment links, share, and GitHub.
- Full-screen hero with a live event stream and an exact-versus-probabilistic memory comparison.
- A persistent memory budget control that updates all labs.
- Three full-width interactive lab sections.
- Closing methodology and privacy section.

### Hero

Visible copy:

- Heading: “Remember more. Store less. Be probably right.”
- Supporting line: “Three data structures that trade certainty for extraordinary scale — running live in your browser.”
- Primary action: “Run the experiment”
- Secondary action: “View source”

The hero visual shows events flowing into exact storage and a compact probabilistic structure. Metrics update in real time: events observed, exact memory, probabilistic memory, memory saved, and modeled error.

### Bloom Filter lab

Question: “Have I seen this before?”

Capabilities:

- Insert custom values.
- Query custom values.
- Insert deterministic sample values.
- Visualize hash routes and the bit positions they touch.
- Distinguish “definitely not” from “probably yes.”
- Label known false positives when exact ground truth is available.
- Provide a one-click false-positive challenge.
- Expose bit count, hash count, inserted count, fill ratio, and modeled false-positive rate.

### HyperLogLog lab

Question: “How many unique things did we see?”

Capabilities:

- Step or stream deterministic events.
- Show the 64-bit hash, register index, and leading-zero rank for the latest observation.
- Visualize registers as a skyline.
- Compare exact cardinality with the HLL estimate and relative error.
- Demonstrate duplicate invariance.
- Expose precision, register count, and modeled standard error.

### Count-Min Sketch lab

Question: “What appears most often?”

Capabilities:

- Stream a deterministic Zipf-like event sequence.
- Visualize the counter matrix as a heatmap.
- Trace the cells updated by the latest event.
- Compare exact and estimated frequencies for selected terms.
- Demonstrate collision-driven overestimation.
- Expose matrix width, depth, total counters, and error guarantees.

## Shared behavior

- Memory budget ranges from 256 B to 64 KB on a logarithmic scale.
- Active lab and memory budget are stored in the URL.
- Seeded pseudo-random generation makes demos reproducible.
- Copy-link feedback is immediate and accessible.
- All processing is local. No uploads, accounts, analytics, cookies, or backend.
- Motion respects `prefers-reduced-motion`.
- Keyboard focus states and semantic controls are mandatory.
- Desktop and mobile layouts are deliberately designed, not simply scaled down.

## Visual system

### Direction

Technical editorial minimalism with a cinematic data-flow layer. The page uses open layouts rather than generic card grids.

### Palette

- Canvas: near-black charcoal.
- Primary text: warm white.
- Muted text and lines: cool gray.
- Memory/active state: acid lime.
- Approximation/hash state: electric violet.
- Error/collision state: coral red.
- Exact/reference state: pale cyan.

### Typography

- System sans stack for speed and native polish.
- System monospace stack for values, hashes, formulas, and controls.
- Large, tightly tracked display heading.
- Deliberate small control typography; no browser-default form styling.

### Motion

- Event particles move in restrained lanes.
- Hash routes draw quickly and fade.
- Bit/register/counter changes use short scale or intensity transitions.
- Metrics roll smoothly without excessive spring effects.
- Reduced-motion mode removes continuous movement and retains state clarity.

## Architecture

A zero-dependency static ES-module application is preferred for GitHub Pages reliability and inspectability.

- `index.html` provides semantic structure and code-native UI.
- `styles.css` contains the design system and responsive behavior.
- `js/core/` contains deterministic algorithms with no DOM dependencies.
- `js/ui/` contains focused visual controllers for each experience.
- Canvas is used for high-frequency stream animation; DOM/CSS is used where accessibility and inspection matter.
- Node’s built-in test runner validates the core algorithms without third-party dependencies.
- GitHub Actions runs tests and deploys the static site to Pages.

## Error handling

- Inputs are trimmed, length-limited, and never interpreted as HTML.
- Invalid or empty actions provide inline status without modal interruption.
- Canvas rendering degrades to static summaries when unavailable.
- Share failure falls back to selecting the URL or explaining that copying was blocked.
- Extreme budgets clamp to safe algorithm parameters.

## Testing and quality gates

- Unit tests cover deterministic hashing, no-false-negative Bloom behavior, HLL duplicate invariance and estimation tolerance, and Count-Min non-underestimation.
- A browser smoke script checks the page title, hero, each lab, share state, and console errors.
- Desktop and mobile screenshots are reviewed for overflow, hierarchy, contrast, and interaction clarity.
- Deployment is considered complete only after the Pages workflow succeeds and the public URL serves the experience.
