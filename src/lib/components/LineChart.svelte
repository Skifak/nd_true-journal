<script>
	/**
	 * LineChart — универсальный SVG-график линии в стиле nf-diagram/nf-chart
	 * (ink-orbit-saas-template). Без зависимостей, адаптивный, интерактивный.
	 *
	 * Базовое использование:
	 *   <LineChart values={[10, 14, 12, 18]} />
	 *
	 * Всё настраивается пропсами:
	 *   values      — числа (обязательно)
	 *   labels      — подписи точек по X (даты/категории); нет — сгенерируются даты
	 *   heightRatio — высота как доля ширины контейнера
	 *   yFormat     — (value, base) => string, подпись оси Y
	 *   tipFormat   — (value, index, base) => string, подпись тултипа
	 *   forecast    — { from?: number, label?: string } | null — пунктир прогноза
	 *   showPoints  — рисовать маркеры точек и кроссхейр
	 *   stroke / fill — CSS-цвета линии и заливки (по умолчанию — палитра журнала)
	 *
	 * @type {{
	 *   values?: number[],
	 *   labels?: string[],
	 *   heightRatio?: number,
	 *   ariaLabel?: string,
	 *   yFormat?: (v: number, base: number) => string,
	 *   tipFormat?: (v: number, i: number, base: number) => string,
	 *   forecast?: { from?: number, label?: string } | null,
	 *   showPoints?: boolean,
	 *   stroke?: string,
	 *   fill?: string,
	 *   strokeWidth?: number
	 * }}
	 */
	let {
		values = [],
		labels = [],
		heightRatio = 0.17,
		ariaLabel = 'График',
		yFormat = (v, base) => {
			const pct = ((v - base) / (base || 1)) * 100;
			return (pct > 0 ? '+' : '') + pct.toFixed(0) + '%';
		},
		tipFormat = (v, i, base) => {
			const pct = ((v - base) / (base || 1)) * 100;
			return (pct > 0 ? '+' : '') + pct.toFixed(0) + '%';
		},
		forecast = { from: 0.75, label: 'FORECAST' },
		showPoints = true,
		stroke = 'var(--sage)',
		fill = 'var(--ink)',
		strokeWidth = 1.4
	} = $props();

	const padT = 14;
	const padB = 26;
	const padL = 42;
	const padR = 16;
	const DEBOUNCE_MS = 250;

	// --- Замер контейнера (аналог useDimensions: ResizeObserver + debounce) ---
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

		update();
		const ro = new ResizeObserver(debounced);
		ro.observe(wrapEl);
		window.addEventListener('resize', debounced);

		return () => {
			ro.disconnect();
			window.removeEventListener('resize', debounced);
			clearTimeout(debounceId);
		};
	});

	// viewBox 1:1 с пикселями контейнера — без леттербокса
	const W = $derived(Math.max(340, Math.round(measured.width) || 720));
	const H = $derived(Math.round(Math.min(460, Math.max(150, W * heightRatio))));

	const safeValues = $derived(values.length > 1 ? values : [0, 0]);
	const base = $derived(safeValues[0] ?? 0);

	// Подписи X: из labels или демо-даты (последние n дней)
	const xLabels = $derived.by(() => {
		const n = safeValues.length;
		if (labels.length === n) return labels;
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
		const vals = safeValues;
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
		const area = `${line} L${pts[n - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`;
		return { line, area, pts, min, max };
	});

	const uid = $props.id();

	// Позиция пунктира прогноза
	const fcX = $derived.by(() => {
		if (!forecast) return 0;
		const n = geometry.pts.length;
		const from = forecast.from ?? 0.75;
		const idx = Math.max(
			0,
			Math.min(n - 1, from <= 1 ? Math.round((n - 1) * from) : Math.round(from))
		);
		return geometry.pts[idx][0];
	});

	// Ось Y: 5 уровней
	const yTicks = $derived.by(() => {
		const { min, max } = geometry;
		const ticks = [];
		for (let i = 0; i <= 4; i++) {
			const v = min + ((max - min) / 4) * i;
			ticks.push({
				y: padT + (1 - i / 4) * (H - padT - padB),
				label: yFormat(v, base)
			});
		}
		return ticks;
	});

	// Ось X: не более 6 подписей
	const xTicks = $derived.by(() => {
		const n = safeValues.length;
		const maxLabels = Math.min(6, Math.max(2, Math.floor(W / 110)));
		const step = Math.max(1, Math.ceil(n / maxLabels));
		const ticks = [];
		for (let i = n - 1; i >= 0; i -= step) {
			ticks.push({ x: geometry.pts[i][0], label: (xLabels[i] ?? '') });
		}
		return ticks.reverse();
	});

	// --- Интерактивность: pointermove → ближайшая точка ---
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
		if (!showPoints) return;
		const rect = e.currentTarget.getBoundingClientRect();
		hoverIdx = nearestX(((e.clientX - rect.left) / rect.width) * W);
	}

	// Тултип: строка формата + (дата/подпись точки)
	const tipText = $derived.by(() => {
		if (hoverIdx < 0) return '';
		const main = tipFormat(safeValues[hoverIdx], hoverIdx, base);
		const lb = xLabels[hoverIdx] ?? '';
		return lb ? main + ' · ' + lb : main;
	});

	const tipW = $derived(Math.max(96, Math.min(220, tipText.length * 5.4 + 16)));
	const tipX = $derived(Math.min(W - tipW / 2 - 4, Math.max(tipW / 2 + 4, active[0])));
	const tipY = $derived(active[1] < 34 ? active[1] + 26 : active[1] - 16);
</script>

<div class="wrap" bind:this={wrapEl}>
	{#if measured.width > 0}
		<svg
			class="diagram chart"
			class:interactive={showPoints}
			width={W}
			height={H}
			viewBox="0 0 {W} {H}"
			role="img"
			aria-label={ariaLabel}
			onpointermove={onMove}
			onpointerleave={() => (hoverIdx = -1)}
		>
			<defs>
				<linearGradient id="{uid}-area" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color={fill} stop-opacity=".12" />
					<stop offset="1" stop-color={fill} stop-opacity="0" />
				</linearGradient>
			</defs>

			<!-- Сетка + шкала Y -->
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
				stroke={stroke}
				stroke-width={strokeWidth}
				pathLength="1"
				class="line-draw"
				opacity=".85"
			/>

			<!-- Шкала X -->
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
			{#if forecast}
				<line x1={fcX} x2={fcX} y1={padT} y2={H - padB} stroke="var(--line-strong)" stroke-dasharray="2 3" />
				{#if forecast.label}
					<text
						x={fcX - 6}
						y={padT + 9}
						text-anchor="end"
						font-size="9"
						fill="var(--ink-muted)"
						font-family="var(--font-mono)"
						letter-spacing="1.5">{forecast.label}</text
					>
				{/if}
			{/if}

			{#if showPoints}
				<!-- Кроссхейр при наведении -->
				{#if hoverIdx >= 0}
					<line
						x1={active[0]}
						x2={active[0]}
						y1={padT}
						y2={H - padB}
						stroke={stroke}
						stroke-opacity=".35"
					/>
				{/if}

				<!-- Точка: покой (пульс) или активная -->
				{#if hoverIdx < 0}
					<circle cx={active[0]} cy={active[1]} r="8" fill={stroke} opacity=".15" class="glow" />
				{/if}
				<circle cx={active[0]} cy={active[1]} r="3.6" fill="var(--bg)" stroke={stroke} stroke-width="1.5" />

				<!-- Тултип -->
				{#if hoverIdx >= 0}
					<g transform="translate({tipX},{tipY})">
						<rect x={-tipW / 2} y="-12" width={tipW} height="16" rx="2" fill="var(--ink)" />
						<text
							x="0"
							y="-1"
							text-anchor="middle"
							font-size="8.5"
							fill="var(--bg)"
							font-family="var(--font-mono)">{tipText}</text
						>
					</g>
				{/if}
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
	.chart.interactive {
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
