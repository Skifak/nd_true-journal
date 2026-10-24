<script>
	/**
	 * График «Кривая капитала» в стиле nf-diagram/nf-chart (ink-orbit-saas-template).
	 *
	 * Данные из журнала: передай equity-значения точками и (опционально) даты.
	 *   <EquityChart values={[1000, 1050, 980, 1120]} dates={['2025-01-05', ...]} />
	 * values: числа (баланс после каждой закрытой сделки, по дням — как угодно).
	 * dates: строки YYYY-MM-DD; если не заданы — генерируются последние n дней (демо).
	 *
	 * Оси: слева — % изменения от первого значения, снизу — даты.
	 * Полная ширина (viewBox = реальные пиксели контейнера), высота ~17% ширины [200..320]px.
	 * @type {{values?: number[], dates?: string[], title?: string}}
	 */
	let { values = [22, 26, 24, 31, 29, 36, 34, 42], dates = [], title = 'Кривая капитала' } = $props();

	const padT = 14;
	const padB = 26;
	const padL = 42;
	const padR = 16;

	// Индекс, с которого начинается пунктир «FORECAST» (по умолчанию — 75% точек)
	const forecastFrom = $derived(Math.max(1, Math.round(values.length * 0.75)));

	// Замер реального размера контейнера (аналог useDimensions из оригинала):
	// ResizeObserver + debounce 250 мс после окончания ресайза.
	const DEBOUNCE_MS = 250;
	let wrapEl = $state(null);
	let measured = $state({ width: 0, height: 0 });
	let debounceId;

	$effect(() => {
		if (!wrapEl) return;

		const update = () => {
			if (!wrapEl) return;
			const r = wrapEl.getBoundingClientRect();
			measured = { width: r.width, height: r.height };
		};

		const debounced = () => {
			clearTimeout(debounceId);
			debounceId = setTimeout(update, DEBOUNCE_MS);
		};

		update(); // первичный замер — сразу, без задержки
		const ro = new ResizeObserver(debounced);
		ro.observe(wrapEl);
		window.addEventListener('resize', debounced);

		return () => {
			ro.disconnect();
			window.removeEventListener('resize', debounced);
			clearTimeout(debounceId);
		};
	});

	// Ширина/высота в пикселях → viewBox 1:1 (без леттербокса)
	const W = $derived(Math.max(340, Math.round(measured.width) || 720));
	const H = $derived(Math.round(Math.min(320, Math.max(200, W * 0.17))));

	// Даты: из журнала или демо-генерация (последние n дней)
	const dateLabels = $derived.by(() => {
		const n = values.length;
		if (dates.length === n) return dates;
		const out = [];
		const today = new Date();
		for (let i = n - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - (n - 1 - i));
			out.push(d.toISOString().slice(0, 10));
		}
		return out;
	});

	// Геометрия (формула zn() из оригинала: C-сглаживание)
	const geometry = $derived.by(() => {
		const vals = values.length > 1 ? values : [1, 2];
		const n = vals.length;
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const range = max - min || 1;
		const pts = vals.map((v, i) => [
			padL + (n < 2 ? 0 : (i / (n - 1)) * (W - padL - padR)),
			padT + (1 - (v - min) / range) * (H - padT - padB)
		]);
		let line = '';
		pts.forEach(([x, y], i) => {
			if (i === 0) {
				line = `M${x.toFixed(1)},${y.toFixed(1)}`;
				return;
			}
			const [px, py] = pts[i - 1];
			const mx = (px + x) / 2;
			line += ` C${mx.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
		});
		const area =
			n > 0
				? `${line} L${pts[n - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`
				: '';
		return { line, area, pts, min, max };
	});

	const uid = $props.id();
	const fcX = $derived(geometry.pts[Math.min(forecastFrom, geometry.pts.length - 1)][0]);

	// Ось Y: 5 уровней значений → подпись в % от первого значения журнала
	const yTicks = $derived.by(() => {
		const { min, max } = geometry;
		const ticks = [];
		for (let i = 0; i <= 4; i++) {
			const v = min + ((max - min) / 4) * i;
			const y = padT + (1 - i / 4) * (H - padT - padB);
			const base = values[0] || 1;
			const pct = ((v - base) / base) * 100;
			ticks.push({ y, label: (pct > 0 ? '+' : '') + pct.toFixed(0) + '%' });
		}
		return ticks;
	});

	// Ось X: до 6 дат, чтобы не толпились
	const xTicks = $derived.by(() => {
		const n = values.length;
		const maxLabels = Math.min(6, Math.max(2, Math.floor(W / 110)));
		const step = Math.max(1, Math.ceil(n / maxLabels));
		const ticks = [];
		for (let i = n - 1; i >= 0; i -= step) {
			ticks.push({ x: geometry.pts[i][0], label: (dateLabels[i] ?? '').slice(5).split('-').reverse().join('.') });
		}
		return ticks.reverse();
	});

	// --- Интерактивность (как в оригинале: pointermove → ближайшая точка) ---
	let hoverIdx = $state(-1);
	const active = $derived(
		hoverIdx >= 0 ? geometry.pts[hoverIdx] : geometry.pts[geometry.pts.length - 1]
	);

	function nearestX(x) {
		let best = 0;
		for (let i = 1; i < geometry.pts.length; i++) {
			if (Math.abs(geometry.pts[i][0] - x) < Math.abs(geometry.pts[best][0] - x)) best = i;
		}
		return best;
	}

	function onMove(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		hoverIdx = nearestX(((e.clientX - rect.left) / rect.width) * W);
	}

	// Подпись тултипа: значение + дата точки
	const delta = $derived.by(() => {
		if (hoverIdx < 0) return '';
		const v0 = values[0] || 1;
		const d = Math.round(((values[hoverIdx] - v0) / v0) * 100);
		const dl = (dateLabels[hoverIdx] ?? '').slice(5).split('-').reverse().join('.');
		return (d >= 0 ? '+' : '') + d + '%' + (dl ? ' · ' + dl : '');
	});

	// Тултип не вылезает за края
	const tipX = $derived(Math.min(W - 70, Math.max(70, active[0])));
	const tipY = $derived(active[1] < 34 ? active[1] + 26 : active[1] - 16);
</script>

<div class="wrap" bind:this={wrapEl}>
	{#if measured.width > 0}
		<svg
			class="diagram chart"
			width={W}
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-label={title}
			onpointermove={onMove}
			onpointerleave={() => (hoverIdx = -1)}
		>
			<defs>
				<linearGradient id="{uid}-area" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color="var(--ink)" stop-opacity=".12" />
					<stop offset="1" stop-color="var(--ink)" stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- Сетка + шкала % слева -->
			{#each yTicks as t, i}
				<line
					x1={padL}
					x2={W - padR}
					y1={t.y}
					y2={t.y}
					stroke="var(--line)"
					opacity={i === 0 ? 0.5 : 1}
				/>
				<text x="6" y={t.y + 3} font-size="9" fill="var(--ink-muted)" font-family="var(--font-mono)"
					>{t.label}</text
				>
			{/each}

			<path d={geometry.area} fill="url(#{uid}-area)" />
			<path
				d={geometry.line}
				fill="none"
				stroke="var(--sage)"
				stroke-width="1.4"
				pathLength="1"
				class="line-draw"
				opacity=".85"
			/>

			<!-- Шкала дат снизу -->
			{#each xTicks as t}
				<text
					x={t.x}
					y={H - 8}
					text-anchor="middle"
					font-size="9"
					fill="var(--ink-muted)"
					font-family="var(--font-mono)">{t.label}</text
				>
			{/each}

			<!-- Пунктир прогноза -->
			<line x1={fcX} x2={fcX} y1={padT} y2={H - padB} stroke="var(--line-strong)" stroke-dasharray="2 3" />
			<text
				x={fcX - 6}
				y={padT + 9}
				text-anchor="end"
				font-size="9"
				fill="var(--ink-muted)"
				font-family="var(--font-mono)"
				letter-spacing="1.5">FORECAST</text
			>

			<!-- Кроссхейр при наведении -->
			{#if hoverIdx >= 0}
				<line x1={active[0]} x2={active[0]} y1={padT} y2={H - padB} stroke="var(--sage)" stroke-opacity=".35" />
			{/if}

			<!-- Точка: покой (пульс) или активная -->
			{#if hoverIdx < 0}
				<circle cx={active[0]} cy={active[1]} r="8" fill="var(--sage)" opacity=".15" class="glow" />
			{/if}
			<circle cx={active[0]} cy={active[1]} r="3.6" fill="var(--bg)" stroke="var(--sage)" stroke-width="1.5" />

			<!-- Тултип -->
			{#if hoverIdx >= 0}
				<g transform="translate({tipX},{tipY})">
					<rect x="-64" y="-12" width="128" height="16" rx="2" fill="var(--ink)" />
					<text x="0" y="-1" text-anchor="middle" font-size="8.5" fill="var(--bg)" font-family="var(--font-mono)"
						>{delta}</text
					>
				</g>
			{/if}
		</svg>
	{/if}
</div>

<style>
	.wrap {
		width: 100%;
		min-height: 140px;
	}
	.diagram {
		display: block;
		overflow: visible;
	}
	.chart {
		cursor: crosshair;
		touch-action: none;
	}
	.line-draw {
		animation: line-in 1.8s cubic-bezier(0.4, 0.1, 0.2, 1) forwards;
	}
	@keyframes line-in {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
	.glow {
		animation: pulse 2s ease-in-out infinite;
		transform-box: fill-box;
		transform-origin: center;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.45;
			transform: scale(1.35);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.line-draw {
			animation: none;
			stroke-dashoffset: 0;
		}
		.glow {
			animation: none;
		}
	}
</style>
