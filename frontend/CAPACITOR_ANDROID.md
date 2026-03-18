# FEMATA Ripoti Android Shell (Capacitor)

This project keeps the existing web app (`src/`, Vite build, routing, i18n, PWA behavior) as the source of truth.

The Android app is a Capacitor shell that loads the built web assets from `dist`.

## Prerequisites

- Node.js 18+
- Android Studio (latest stable)
- Android SDK + platform tools
- Java 17 (recommended for modern Android Gradle tooling)

## Project layout

- Web app source: `frontend/src`
- Capacitor config: `frontend/capacitor.config.ts`
- Android shell project: `frontend/android`

## Commands

Run from `frontend/`:

```bash
npm run cap:sync
```

Builds the web app and syncs assets/plugins to Android.

```bash
npm run cap:open:android
```

Opens the Android project in Android Studio.

```bash
npm run cap:run:android
```

Builds, syncs, and runs on a connected Android device/emulator.

## Release note

When frontend code changes, always run `npm run cap:sync` before creating an Android release build.

