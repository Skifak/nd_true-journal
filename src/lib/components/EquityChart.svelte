<script>
	/**
	 * Заглушка графика в стиле nf-diagram/nf-chart (ink-orbit-saas-template).
	 * Позже заменяется реальными данными: props values → массив чисел.
	 * @type {{values?: number[], title?: string}}
	 */
	let { values = [22, 26, 24, 31, 29, 36, 34, 42], title = 'Кривая капитала' } = $props();

	const W = 300;
	const H = 130;
	const PAD = 14;
	const forecastFrom = 6; // индекс, с которого пунктир «FORECAST»

	// Пересчёт значений в точки (как zn() в оригинале: сглаживание C-кривыми)
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
	const last = $derived(geometry.pts[geometry.pts.length - 1]);
	const fcX = $derived(geometry.pts[Math.min(forecastFrom, geometry.pts.length - 1)][0]);
</script>

<svg class="diagram chart" viewBox="0 0 {W} {H + 6}" role="img" aria-label={title}>
	<defs>
		<linearGradient id="{uid}-area" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--ink)" stop-opacity=".12" />
			<stop offset="1" stop-color="var(--ink)" stop-opacity="0" />
		</linearGradient>
	</defs>

	<!-- Сеточные линии 25/50/75% -->
	{#each [0.25, 0.5, 0.75] as f}
		<line x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="var(--line)" />
	{/each}

	<path d={geometry.area} fill="url(#{uid}-area)" />
	<path d={geometry.line} fill="none" stroke="var(--sage)" stroke-width="1.4" pathLength="1" class="line-draw" opacity=".85" />

	<!-- Пунктир прогноза -->
	<line x1={fcX} x2={fcX} y1="10" y2={H - PAD} stroke="var(--line-strong)" stroke-dasharray="2 3" />
	<text x={fcX - 4} y={H - 4} text-anchor="end" font-size="7" fill="var(--ink-muted)" font-family="var(--font-mono)" letter-spacing="1">FORECAST</text>

	<!-- Пульсирующая точка на последнем значении -->
	{#if last}
		<circle cx={last[0]} cy={last[1]} r="7" fill="var(--sage)" opacity=".15" class="glow" />
	{/if}
	{#if last}
		<circle cx={last[0]} cy={last[1]} r="3.2" fill="var(--bg)" stroke="var(--sage)" stroke-width="1.5" />
	{/if}
</svg>

<style>
	.diagram {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.chart {
		cursor: crosshair;
	}
	.line-draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		transition: stroke-dashoffset 1.8s cubic-bezier(0.4, 0.1, 0.2, 1);
	}
	svg {
		view-transition-name: none;
	}
	svg:hover .line-draw,
	.panel:hover .line-draw {
		/* перерисовка при появлении; в Svelte компонент монтируется заново — анимация играется на mount */
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
</style>
