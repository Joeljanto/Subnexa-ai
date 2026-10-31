# SubNexa AI frontend

This React and TypeScript single-page app is built with Vite. It calls the Flask API through the Vite development proxy configured in `vite.config.ts`.

## Run locally

Start the Flask backend from the repository root first. Then, from this directory:

```bash
npm install
npm run dev
```

Vite starts at `http://localhost:5173` by default. The backend should be available at `http://127.0.0.1:5000`.

## Available commands

- `npm run dev` starts the development server.
- `npm run build` type-checks the app and creates a production build in `dist/`.
- `npm run lint` runs Oxlint.
- `npm run preview` serves the latest production build locally.

For the full setup, environment configuration, backend startup, and team workflow, see the [root README](../README.md) and [contribution guide](../CONTRIBUTING.md).
