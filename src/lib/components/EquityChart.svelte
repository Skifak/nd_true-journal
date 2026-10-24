<script>
	/**
	 * EquityChart — пресет LineChart под «Кривую капитала» журнала.
	 * Оси: слева % от стартового значения, снизу даты; пунктир прогноза на 75%.
	 *
	 *   <EquityChart values={equityByDay} dates={dayLabels} heightRatio={0.26} />
	 *
	 * Для других графиков (PnL по дням, R-мультипли, баланс) — используй LineChart напрямую.
	 * @type {{
	 *   values?: number[],
	 *   dates?: string[],
	 *   title?: string,
	 *   heightRatio?: number,
	 *   forecast?: { from?: number, label?: string } | null
	 * }}
	 */
	import LineChart from './LineChart.svelte';

	let {
		values = [22, 26, 24, 31, 29, 36, 34, 42],
		dates = [],
		title = 'Кривая капитала',
		heightRatio = 0.17,
		forecast = { from: 0.75, label: 'FORECAST' }
	} = $props();

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
	yFormat={(v, base) => {
		const pct = ((v - base) / (base || 1)) * 100;
		return (pct > 0 ? '+' : '') + pct.toFixed(0) + '%';
	}}
	tipFormat={(v, i, base) => {
		const pct = ((v - base) / (base || 1)) * 100;
		const d = Math.round(pct);
		return (d >= 0 ? '+' : '') + d + '%';
	}}
/>
