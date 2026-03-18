# Changelog

All notable changes to this repository are documented in this file.

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
