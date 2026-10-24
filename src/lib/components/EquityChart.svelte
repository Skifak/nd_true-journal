<script>
	/**
	 * Заглушка графика в стиле nf-diagram/nf-chart (ink-orbit-saas-template).
	 * Полная ширина: viewBox строится по реальной ширине контейнера (1:1, без искажений).
	 * Высота = 16% ширины, зажата в [190..300]px.
	 * Интерактив: crosshair-вертикаль, точка и тултип при наведении (как в оригинале).
	 * @type {{values?: number[], title?: string}}
	 */
	let { values = [22, 26, 24, 31, 29, 36, 34, 42], title = 'Кривая капитала' } = $props();

	const PAD = 18;
	const forecastFrom = 6;

	// Реальная ширина контейнера → пиксельный viewBox (без леттербокса)
	let wrapEl = $state(null);
	let cw = $state(0);
	const W = $derived(Math.max(320, Math.round(cw) || 640));
	const H = $derived(Math.round(Math.min(300, Math.max(190, W * 0.16))));

	// Геометрия (формула zn() из оригинала: C-сглаживание)
	const geometry = $derived.by(() => {
		const vals = values.length > 1 ? values : [1, 2];
		const n = vals.length;
		const min = Math.min(...vals);
		const range = Math.max(...vals) - min || 1;
		const pts = vals.map((v, i) => [
			PAD + (n < 2 ? 0 : (i / (n - 1)) * (W - PAD * 2)),
			H - PAD - ((v - min) / range) * (H - PAD * 2)
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
				? `${line} L${pts[n - 1][0].toFixed(1)},${H - PAD} L${pts[0][0].toFixed(1)},${H - PAD} Z`
				: '';
		return { line, area, pts };
	});

	const uid = $props.id();
	const fcX = $derived(geometry.pts[Math.min(forecastFrom, geometry.pts.length - 1)][0]);

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

	// Подпись тултипа: дельта от первого значения в %
	const delta = $derived.by(() => {
		if (hoverIdx < 0) return '';
		const v0 = values[0] || 1;
		const d = Math.round(((values[hoverIdx] - v0) / v0) * 100);
		return (
			(hoverIdx >= forecastFrom ? 'pred ' : 'pt ' + (hoverIdx + 1) + ' ') +
			(d >= 0 ? '+' : '') +
			d +
			'%'
		);
	});

	// Тултип не вылезает за края
	const tipX = $derived(Math.min(W - 46, Math.max(46, active[0])));
	const tipY = $derived(active[1] < 32 ? active[1] + 24 : active[1] - 14);
</script>

<div class="wrap" bind:this={wrapEl} bind:clientWidth={cw}>
	{#if cw > 0}
		<svg
			class="diagram chart"
			width={W}
			height={H + 6}
			viewBox="0 0 {W} {H + 6}"
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

			{#each [0.25, 0.5, 0.75] as f}
				<line x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="var(--line)" />
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

			<!-- Пунктир прогноза -->
			<line
				x1={fcX}
				x2={fcX}
				y1="10"
				y2={H - PAD}
				stroke="var(--line-strong)"
				stroke-dasharray="2 3"
			/>
			<text
				x={fcX - 6}
				y={H - 6}
				text-anchor="end"
				font-size="9"
				fill="var(--ink-muted)"
				font-family="var(--font-mono)"
				letter-spacing="1.5">FORECAST</text
			>

			<!-- Кроссхейр при наведении -->
			{#if hoverIdx >= 0}
				<line
					x1={active[0]}
					x2={active[0]}
					y1="10"
					y2={H - PAD}
					stroke="var(--sage)"
					stroke-opacity=".35"
				/>
			{/if}

			<!-- Точка: покой (пульс) или активная -->
			{#if hoverIdx < 0}
				<circle cx={active[0]} cy={active[1]} r="8" fill="var(--sage)" opacity=".15" class="glow" />
			{/if}
			<circle
				cx={active[0]}
				cy={active[1]}
				r="3.6"
				fill="var(--bg)"
				stroke="var(--sage)"
				stroke-width="1.5"
			/>

			<!-- Тултип -->
			{#if hoverIdx >= 0}
				<g transform="translate({tipX},{tipY})">
					<rect x="-36" y="-12" width="72" height="16" rx="2" fill="var(--ink)" />
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
		min-height: 120px;
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
