# Changelog

All notable changes to this repository are documented in this file.

## [0.8.3] - 2026-03-18

### Added
- Capacitor Android app shell scaffolding under `frontend/android`.
- Capacitor configuration file for Android packaging (`frontend/capacitor.config.ts`).
- Android shell workflow documentation (`frontend/CAPACITOR_ANDROID.md`).
- Frontend scripts for Android shell workflow:
  - `cap:sync`
  - `cap:open:android`
  - `cap:run:android`

### Changed
- Kept existing web/PWA frontend as source of truth while enabling Android wrapper packaging via Capacitor.

### Deployment
- Released and deployed to VPS for ongoing web regression testing.

## [0.8.2] - 2026-03-18

### Added
- Visible install progress experience on landing page (`0-100%` progress bar style) when PWA install is triggered.
- Post-install guidance text so users know to find FEMATA Ripoti on Home Screen/app drawer.
- Grouped chat FAQ selector with expandable/collapsible behavior to support more FAQs without overcrowding the chat UI.

### Changed
- Mobile chat modal layout now uses more usable viewport height and compact footer behavior for better Android/iOS UX.

### Deployment
- Released and deployed to VPS for HTTPS domain testing.

## [0.8.1] - 2026-03-18

### Fixed
- Disabled automatic landing-page agent popup so the chat modal no longer opens by itself and blocks users.
- Kept the floating FEMATA agent button available for user-initiated chat access.

### Deployment
- Released and deployed to VPS with the existing Nginx reverse proxy and HTTPS subdomain setup.

## [0.8.0] - 2026-03-18

### Added
- Minimal offline-first PWA foundation for the frontend.
- Install support with browser-aware behavior:
  - `beforeinstallprompt` flow on supported browsers.
  - iOS/Safari fallback instructions (`Open in Safari > Share > Add to Home Screen`).
- Service worker registration and app-shell caching.
- IndexedDB-backed offline report queue with statuses:
  - `draft`
  - `queued`
  - `syncing`
  - `sent`
  - `failed`
- Queue sync service with retry triggers on:
  - reconnect (`online`)
  - page focus
  - app visibility return
  - service-worker sync message bridge

### Changed
- Landing page now includes install awareness and install guidance UI.
- Report submission flow now supports offline queueing and deferred sync.
- Manifest and HTML metadata updated for installability and mobile support.
- Localized content coverage expanded for shared `common`/`report` strings.
- Floating FEMATA agent flow and disclaimer localization wiring improved.

### Tooling and Ops
- Added deployment/testing helper scripts under `scripts/`.
- Added smoke-test workflow for local verification.

### Release Metadata
- Release commit: `6309ee2`
- Frontend package version: `0.8.0`
