<script lang="ts">
	import LineChart from './LineChart.svelte';

	interface Props {
		values?: number[];
		dates?: string[];
		title?: string;
		heightRatio?: number;
		forecast?: { from: number; label: string } | null;
		/** Домен оси Y в «сырых» единицах; по умолчанию шкала 0..100% от старта */
		yMin?: number | null;
		yMax?: number | null;
	}

	let {
		values = [22, 26, 24, 31, 29, 36, 34, 42],
		dates = [],
		title = 'Кривая капитала',
		heightRatio = 0.17,
		forecast = { from: 0.75, label: 'FORECAST' },
		yMin = null,
		yMax = null
	}: Props = $props();

	// Дата из YYYY-MM-DD → dd.mm (компактно для оси X)
	const shortDates = $derived(
		dates.map((d) => (d ?? '').slice(5).split('-').reverse().join('.'))
	);
</script>

<LineChart
	{values}
	labels={shortDates}
	{heightRatio}
	ariaLabel={title}
	{forecast}
	{yMin}
	{yMax}
	yFormat={(v, base) => {
		// Если домен задан в процентах (0..100) — печатаем как есть
		if (yMin !== null && yMax !== null) return Math.round(v) + '%';
		const pct = ((v - base) / (base || 1)) * 100;
		return (pct > 0 ? '+' : '') + pct.toFixed(0) + '%';
	}}
	tipFormat={(v, i, base) => {
		if (yMin !== null && yMax !== null) return Math.round(v) + '%';
		const pct = ((v - base) / (base || 1)) * 100;
		const d = Math.round(pct);
		return (d >= 0 ? '+' : '') + d + '%';
	}}
/>
