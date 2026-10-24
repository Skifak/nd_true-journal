# AGENTS.md — nd_true-journal

Офлайн-журнал сделок. Принцип: **ноль рантайм-зависимостей**, безопасная среда в браузере и на Windows/Linux.

## Стек

- **UI:** SvelteKit 3 + Svelte 5 (runes **включены**, в отличие от trader-journal) + Vite 8
- **Оболочка:** Tauri 2 (Windows: msi/nsis, Linux: appimage/deb)
- **Зависимости:** только dev-инструменты. Никаких runtime-библиотек — нужное пишем сами
- **Транспорт к Tauri:** `withGlobalTauri: true` — глобальный `window.__TAURI__`, `@tauri-apps/api` в бандл не входит

## Связанные проекты

| Путь | Что это |
|------|---------|
| `/home/an/Projects/TradeJornalApp/journal-site/` | **Сайт-витрина этого проекта.** Иконки/логотип/фавикон берутся оттуда (`journal-site/favicon.svg` — источник всех иконок, см. ниже). Дизайн-язык сайта (`DESIGN.md`) — референс для визуального стиля приложения |
| `../` (trader-journal) | Старое приложение — только референс идей, код не переиспользуем (там тонна зависимостей) |

### Иконки

Источник — `journal-site/favicon.svg`. После изменения иконки на сайте:

```bash
rsvg-convert -w 1024 -h 1024 ../journal-site/favicon.svg -o /tmp/icon.png
npx tauri icon /tmp/icon.png -o src-tauri/icons
```

## Архитектура

- `src/lib/platform/index.js` — единая точка доступа к платформе: `detectPlatform()`, `isTauri()`, строгий `invoke()`. Вне Tauri `invoke` бросает, не эмулирует молча
- `src/lib/storage/local.js` — localStorage-обёртка с namespace-префиксами (задел под мультиаккаунт)
- `src/lib/storage/idb.js` — свой мини-слой IndexedDB для blob-вложений
- `src-tauri/src/lib.rs` — 4 IPC-команды (read/write/delete/list) с жёсткой песочницей путей: только относительные пути, канонизация, всё внутри AppData

## Правила безопасности (строгие)

- CSP в `src/app.html` и `tauri.conf.json`: `script-src 'self'`, `connect-src 'none'` (браузер), только `ipc:` в Tauri. Не ослаблять
- Никаких внешних сетевых запросов из UI. Всё, что нужно из системы — через Rust-команды с валидацией
- Никаких secrets в localStorage/консоли. Ошибки пользователю — без внутренних деталей
- Tauri IPC: путь только относительный, канонизация обязательна, никаких `..`

## Конфигурация (важные отличия)

- SvelteKit конфигурируется **только через `vite.config.js`** (svelte.config.js в Kit 3 не используется)
- Алиас `#lib/*` → `src/lib/*` (`$lib` удалён в Kit 3)
- SSR выключен (`src/routes/+layout.js`: `ssr = false`), сборка — статический SPA (`@sveltejs/adapter-static`, fallback `index.html`)

## Команды

```bash
npm run dev          # Vite dev :5173
npm run build        # статический SPA → build/
npm run check        # svelte-check
npm run tauri:dev    # нативное окно (нужен webkit2gtk-4.1 на Linux)
npm run tauri:build  # EXE/MSI/AppImage/deb
```

## Аудит

Strix-аудиты хранятся в `strix_runs/` (в gitignore). Запуск:

```bash
strix -t . -m quick -n --scope-mode full --instruction "..."
```

## Язык

Код, комментарии, коммиты, документация — на русском.
