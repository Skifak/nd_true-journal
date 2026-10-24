<script lang="ts">
	import LineChart from './LineChart.svelte';
	import type { EquityCurve } from '#lib/domain/journal.ts';

	interface Props {
		curve?: EquityCurve | null;
		title?: string;
		heightRatio?: number;
	}

	let { curve = null, title = 'Кривая капитала', heightRatio = 0.17 }: Props = $props();

	// Один сэмпл — нужны две точки, чтобы линия вообще была
	const values = $derived(curve && curve.values.length > 1 ? curve.values : [0, 0]);
	const dates = $derived(curve && curve.values.length > 1 ? curve.dates : []);

	// Компактные подписи: разные месяцы → 'мм.гг', один месяц → 'дд'
	const shortDates = $derived.by(() => {
		const months = new Set(dates.map((d) => d.slice(0, 7)));
		const sameMonth = months.size <= 1;
		return dates.map((d) => (sameMonth ? d.slice(8) : d.slice(5).split('-').reverse().join('.')));
	});
</script>

<LineChart
	{values}
	labels={shortDates.length === values.length ? shortDates : []}
	{heightRatio}
	ariaLabel={title}
	forecast={null}
	yFormat={(v, base) => {
		const pct = ((v - base) / (base || 1)) * 100;
		return (pct > 0 ? '+' : '') + pct.toFixed(0) + '%';
	}}
	tipFormat={(v, i, base) => {
		const pct = ((v - base) / (base || 1)) * 100;
		const d = Math.round(pct);
		const money = v.toFixed(2) + ' $';
		return money + ' · ' + (d >= 0 ? '+' : '') + d + '%';
	}}
/>
