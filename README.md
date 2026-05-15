# Svet

A 3D color space visualizer that plots colors in LAB (L\*a\*b\*) space using Three.js.

Live site: https://VadimEngine.github.io/svet

## Development

```bash
npm install
npm start
```

Opens the app at http://localhost:3000 with hot reload.

## Deploy to GitHub Pages

```bash
npm run deploy
```

This runs `npm run build` automatically first, then pushes the `build/` folder to the `gh-pages` branch. The live site updates within a minute.

The deployed URL is controlled by the `homepage` field in `package.json`:

```json
"homepage": "https://VadimEngine.github.io/svet"
```

## Build only

```bash
npm run build
```

Outputs a production build to the `build/` folder without deploying.
