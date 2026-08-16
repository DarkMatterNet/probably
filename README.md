<p align="center">
  <strong style="font-size: 2rem">Probably</strong><br>
  <em>Probability, made visible.</em>
</p>

# Probably

Probably is a zero-backend interactive probability playground. It places mathematical theory and reproducible simulation on the same screen so abstract ideas become something you can manipulate.

**Live demo:** https://darkmatternet.github.io/probably/

## Laboratories

| Laboratory | What it makes visible |
| --- | --- |
| **Coin convergence** | A running sample proportion settling toward its theoretical probability |
| **Dice sums** | Exact sum probabilities compared with simulated roll frequencies |
| **Bayes screening** | True positives, false positives, true negatives, false negatives, and posterior probability |
| **Risk pooling** | Aggregate volatility, relative stability, and the 95th percentile |

## Highlights

- Seeded simulations: the same URL recreates the same random experiment.
- Shareable state stored entirely in the URL hash.
- Theory and simulation have distinct visual roles.
- Keyboard-accessible tabs and exact numeric inputs.
- Responsive three-panel laboratory interface.
- No framework, chart library, account, backend, analytics, or tracking.
- A single self-contained `index.html` makes the project easy to audit and preserve.

## Run locally

```bash
git clone https://github.com/DarkMatterNet/probably.git
cd probably
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Architecture

The public release is intentionally compact:

```text
index.html                       semantic UI, visual system, math, SVG charts, and state
.github/workflows/deploy.yml     GitHub Pages deployment
README.md                        project documentation
LICENSE                          MIT license
```

The app uses native browser capabilities only: semantic HTML, modern CSS, JavaScript, SVG, the Clipboard API, and URL state.

## Privacy

Everything runs locally in the browser. Probably sends no experiment data anywhere.

## License

MIT © 2026 IsaacL / DarkMatterNet.
