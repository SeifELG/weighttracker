# Weight Tracker

A small local-first PWA for logging weight measurements quickly from a phone or laptop.

## Features

- Quick weight entry, defaulting to kilograms
- Exact timestamp per entry, with optional timestamp editing
- Local IndexedDB storage
- Edit and delete saved entries
- Simple trend chart
- JSON backup export and import
- Installable PWA support via GitHub Pages

## Local Development

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:5173/
```

## Build

```bash
npm run build
```

The production files are written to `dist/`.

## Deployment

This repo is configured for GitHub Pages at:

```text
https://seifelg.github.io/weighttracker/
```

The Vite `base` path is set to `/weighttracker/`, and `.github/workflows/deploy.yml` builds and deploys `dist/` with GitHub Actions.

## Data

Weight entries are stored locally in the browser using IndexedDB. They are not uploaded to GitHub or synced between devices. Use the export/import buttons to make backups or move data between browsers/devices.
