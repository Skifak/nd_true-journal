#!/usr/bin/env node
/**
 * Защита границ проекта: CI падает, если тихо ослабели инварианты безопасности.
 *
 * Проверяет три вещи:
 *   1. `dependencies` в package.json пусты — ноль рантайм-зависимостей, принцип проекта.
 *   2. CSP в src/app.html совпадает с зафиксированным baseline.
 *   3. CSP в src-tauri/tauri.conf.json совпадает с baseline (та же политика в Tauri).
 *
 * Baseline — это НЕ «можно менять только здесь»: осознанное изменение CSP
 * сопровождается обновлением baseline в том же PR (и это рискованная зона —
 * src/app.html и tauri.conf.json требуют одобрения CEO). Падение на этом шаге
 * означает только одно: CSP изменили, не осознав этого.
 *
 * Запуск: node scripts/check-boundaries.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

// --- 1. Ноль рантайм-зависимостей -------------------------------------------
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = pkg.dependencies ?? {};
if (Object.keys(deps).length > 0) {
	errors.push(
		`package.json: обнаружены рантайм-зависимости (${Object.keys(deps).join(', ')}). ` +
			'Принцип проекта — ноль рантайм-зависимостей, всё остальное только в devDependencies.'
	);
}

// --- 2–3. CSP baseline -------------------------------------------------------
// Текущий baseline: app.html разрешает blob/data-медиа и исходящие запросы
// к пользовательскому OpenAI-compatible API (AI-функция), 'unsafe-inline'
// в script-src нужен для инлайн-данных гидратации SvelteKit. Tauri строже:
// script-src 'self', инлайн запрещён (nonce добавляет сам Tauri).
const expectedAppHtmlCsp =
	"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws://localhost:5173 https: http://localhost:* http://127.0.0.1:*; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
const expectedTauriCsp =
	"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: ipc: http://ipc.localhost; media-src 'self' blob: data:; font-src 'self'; connect-src ipc: http://ipc.localhost https: http://localhost:* http://127.0.0.1:*; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

function extractCsp(filePath) {
	const text = readFileSync(join(root, filePath), 'utf8');
	const match = text.match(/content="([^"]*Content-Security-Policy[^"]*?)"/s)
		?? text.match(/<meta[^>]*Content-Security-Policy[^>]*content="([^"]*)"/is)
		?? text.match(/content="([^"]*default-src[^"]*)"/is);
	return match ? match[1] : null;
}

const appHtmlCsp = extractCsp('src/app.html');
if (appHtmlCsp === null) {
	errors.push('src/app.html: мета-тег CSP не найден. CSP обязателен, удалять его нельзя.');
} else if (appHtmlCsp !== expectedAppHtmlCsp) {
	errors.push(
		'src/app.html: CSP отличается от зафиксированного baseline.\n' +
			`  ожидалось:  ${expectedAppHtmlCsp}\n` +
			`  фактически: ${appHtmlCsp}`
	);
}

const tauriRaw = readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8');
const tauriConf = JSON.parse(tauriRaw);
const tauriCsp = tauriConf?.app?.security?.csp ?? null;
if (tauriCsp === null) {
	errors.push('src-tauri/tauri.conf.json: app.security.csp отсутствует. CSP обязателен.');
} else if (tauriCsp !== expectedTauriCsp) {
	errors.push(
		'src-tauri/tauri.conf.json: CSP отличается от зафиксированного baseline.\n' +
			`  ожидалось:  ${expectedTauriCsp}\n` +
			`  фактически: ${tauriCsp}`
	);
}

if (errors.length > 0) {
	console.error('Нарушены границы проекта:\n');
	for (const e of errors) console.error(`- ${e}\n`);
	console.error('Если изменение осознанное — обнови baseline в scripts/check-boundaries.mjs в том же PR (нужно одобрение CEO).');
	process.exit(1);
}
console.log('Границы проекта в порядке: dependencies пусты, CSP совпадает с baseline (app.html, tauri.conf.json).');
