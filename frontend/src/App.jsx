import React, { useEffect, useMemo, useState } from "react";

import {
	ResponsiveContainer,
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	BarChart,
	Bar,
	Cell,
	ReferenceLine,
} from "recharts";

import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	CircleHelp,
	Download,
	FlaskConical,
	Leaf,
	RefreshCw,
	TrendingDown,
} from "lucide-react";

const API =
	import.meta.env.VITE_API_URL ||
	"https://food-inflation-in-el-nino.onrender.com";

const MODELS = [
	{
		key: "lstm_baseline",
		name: "LSTM Baseline",
		short: "LSTM baseline",
		color: "#2f6fed",
		description: "Historical food inflation only",
	},

	{
		key: "lstm_oni",
		name: "LSTM + ONI",
		short: "LSTM + ONI",
		color: "#13a889",
		description: "Food inflation + Oceanic Niño Index",
	},

	{
		key: "arimax",
		name: "ARIMAX",
		short: "ARIMAX",
		color: "#f59e0b",
		description: "Statistical model with ONI regressor",
	},

	{
		key: "prophet",
		name: "Prophet",
		short: "Prophet",
		color: "#8b5cf6",
		description: "Trend/seasonality model with ONI",
	},
];

const FALLBACK = {
	test_period: "January 2024 – December 2025",

	metrics: [
		{
			Model: "LSTM Baseline",
			MAE: 1.333475,
			RMSE: 1.64597,
			sMAPE: 43.889998,
			MASE: 0.990987,
			"Average Rank": 1,
		},

		{
			Model: "LSTM + ONI",
			MAE: 1.524525,
			RMSE: 1.942188,
			sMAPE: 49.637119,
			MASE: 1.132969,
			"Average Rank": 2,
		},

		{
			Model: "ARIMAX",
			MAE: 4.654987,
			RMSE: 6.305485,
			sMAPE: 85.443703,
			MASE: 3.459407,
			"Average Rank": 3,
		},

		{
			Model: "Prophet",
			MAE: 5.016948,
			RMSE: 6.685004,
			sMAPE: 87.403752,
			MASE: 3.728403,
			"Average Rank": 4,
		},
	],
};

const metricInfo = {
	MAE: {
		label: "Mean Absolute Error",
		detail: "Average absolute distance between the predicted and actual values. Lower is better.",
		unit: "",
	},

	RMSE: {
		label: "Root Mean Squared Error",
		detail: "Penalizes large misses more heavily than MAE. Lower is better.",
		unit: "",
	},

	sMAPE: {
		label: "Symmetric MAPE",
		detail: "Percentage-style error relative to the magnitude of actual and predicted values. Lower is better.",
		unit: "%",
	},

	MASE: {
		label: "Mean Absolute Scaled Error",
		detail: "Compares forecast error with a naïve historical-change baseline. Lower is better.",
		unit: "",
	},
};

const number = (v, digits = 2) =>
	Number(v).toLocaleString("en-IN", {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
	});

function normalizeComparison(data) {
	const rows = data?.metrics || [];

	return {
		test_period: data?.test_period || FALLBACK.test_period,
		metrics: rows.map((r) => ({ ...r, sMAPE: r.sMAPE ?? r["sMAPE (%)"] })),
	};
}

function App() {
	const [comparison, setComparison] = useState(FALLBACK);

	const [predictions, setPredictions] = useState(null);

	const [dataset, setDataset] = useState([]);

	const [activeMetric, setActiveMetric] = useState("MAE");

	const [selectedModels, setSelectedModels] = useState(
		MODELS.map((m) => m.key),
	);

	const [range, setRange] = useState("all");

	const [loading, setLoading] = useState(true);

	const [apiState, setApiState] = useState("connecting");

	const [lastUpdated, setLastUpdated] = useState(null);

	const loadData = async () => {
		setLoading(true);

		try {
			const [c, p, d] = await Promise.all([
				fetch(`${API}/comparison`).then((r) => {
					if (!r.ok) throw new Error("comparison");
					return r.json();
				}),

				fetch(`${API}/predictions`).then((r) => {
					if (!r.ok) throw new Error("predictions");
					return r.json();
				}),

				fetch(`${API}/data`).then((r) => {
					if (!r.ok) throw new Error("data");
					return r.json();
				}),
			]);

			setComparison(normalizeComparison(c));
			setPredictions(p);
			setDataset(d);
			setApiState("live");
			setLastUpdated(new Date());
		} catch {
			setApiState("fallback");

			// The checked-in comparison results remain visible if the API is asleep or unavailable.

			setComparison(FALLBACK);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const metrics = comparison.metrics || FALLBACK.metrics;

	const ranked = useMemo(
		() =>
			[...metrics].sort(
				(a, b) => Number(a[activeMetric]) - Number(b[activeMetric]),
			),
		[metrics, activeMetric],
	);

	const best = ranked[0];

	const baseline = metrics.find((m) => /LSTM Baseline/i.test(m.Model));

	const withOni = metrics.find((m) => /LSTM \+ ONI/i.test(m.Model));

	const oniChange =
		baseline && withOni
			? ((Number(withOni.MAE) - Number(baseline.MAE)) /
					Number(baseline.MAE)) *
				100
			: null;

	const visibleModels = MODELS.filter((m) => selectedModels.includes(m.key));

	const chartRows = ranked
		.filter((r) => visibleModels.some((m) => m.name === r.Model))
		.map((r) => ({ ...r, label: r.Model }));

	const forecastRows = useMemo(() => {
		if (!predictions) return [];

		const keys = ["lstm_baseline", "lstm_oni", "arimax", "prophet"];

		const dateMap = new Map();

		keys.forEach((key) =>
			(predictions[key] || []).forEach((point) => {
				const date = String(point.date || "").slice(0, 10);

				if (!date) return;

				if (!dateMap.has(date))
					dateMap.set(date, {
						date,
						timestamp: new Date(date).getTime(),
					});

				const label = MODELS.find((m) => m.key === key)?.name || key;

				dateMap.get(date)[label] = Number(
					point.predicted_food_inflation,
				);
			}),
		);

		const rows = [...dateMap.values()].sort(
			(a, b) => a.timestamp - b.timestamp,
		);

		if (range === "test")
			return rows.filter(
				(r) => r.date >= "2024-01-01" && r.date <= "2025-12-31",
			);

		if (range === "recent") return rows.slice(-36);

		return rows;
	}, [predictions, range]);

	const actualRows = useMemo(
		() =>
			(dataset || [])
				.map((r) => {
					const date = String(r.date || r.Date || r.ds || "").slice(
						0,
						10,
					);

					const inflation = Number(
						r.food_inflation ??
							r.Food_Inflation ??
							r.food_inflation_rate ??
							r.CFPI ??
							r.cfpi,
					);

					const oni = Number(r.ONI ?? r.oni ?? r.ONI_anomaly);

					return {
						date,
						timestamp: new Date(date).getTime(),
						actual: Number.isFinite(inflation) ? inflation : null,
						ONI: Number.isFinite(oni) ? oni : null,
					};
				})
				.filter((r) => r.date && Number.isFinite(r.timestamp))
				.sort((a, b) => a.timestamp - b.timestamp),
		[dataset],
	);

	const mergedForecast = useMemo(() => {
		const map = new Map(actualRows.map((r) => [r.date, { ...r }]));

		forecastRows.forEach((r) =>
			map.set(r.date, { ...(map.get(r.date) || {}), ...r }),
		);

		return [...map.values()].sort(
			(a, b) => new Date(a.date) - new Date(b.date),
		);
	}, [actualRows, forecastRows]);

	// Independent of the range selector above: this series always shows only the test window.
	const testForecastRows = useMemo(() => {
		if (!predictions) return [];

		const dateMap = new Map();
		MODELS.forEach((model) => {
			(predictions[model.key] || []).forEach((point) => {
				const date = String(point.date || "").slice(0, 10);
				if (!date || date < "2024-01-01" || date > "2025-12-31") return;

				if (!dateMap.has(date))
					dateMap.set(date, {
						date,
						timestamp: new Date(date).getTime(),
					});
				const value = Number(point.predicted_food_inflation);
				dateMap.get(date)[model.name] = Number.isFinite(value)
					? value
					: null;
			});
		});

		return [...dateMap.values()].sort((a, b) => a.timestamp - b.timestamp);
	}, [predictions]);

	const testMergedForecast = useMemo(() => {
		const start = "2024-01-01";
		const end = "2025-12-31";
		const map = new Map(
			actualRows
				.filter((row) => row.date >= start && row.date <= end)
				.map((row) => [row.date, { ...row }]),
		);

		testForecastRows.forEach((row) => {
			map.set(row.date, { ...(map.get(row.date) || {}), ...row });
		});

		return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
	}, [actualRows, testForecastRows]);

	const downloadCsv = () => {
		const cols = ["Model", "MAE", "RMSE", "sMAPE", "MASE", "Average Rank"];

		const lines = [
			cols.join(","),
			...metrics.map((r) =>
				cols.map((c) => JSON.stringify(r[c] ?? "")).join(","),
			),
		].join("\n");

		const url = URL.createObjectURL(
			new Blob([lines], { type: "text/csv;charset=utf-8;" }),
		);

		const a = document.createElement("a");
		a.href = url;
		a.download = "food-inflation-model-comparison.csv";
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="app-shell">
			<a className="skip-link" href="#main-content">
				Skip to dashboard content
			</a>

			<header className="topbar">
				<a
					href="#top"
					className="brand"
					aria-label="Food Inflation Lab home"
				>
					<span className="brand-mark">
						<Leaf size={20} />
					</span>
					<span>
						food<span className="brand-light">inflation</span>
						<small>RESEARCH DASHBOARD</small>
					</span>
				</a>

				<nav aria-label="Main navigation">
					<a href="#overview">Overview</a>
					<a href="#forecasts">Forecasts</a>
					<a href="#evaluation">Evaluation</a>
				</nav>

				<div className="top-actions">
					<span
						className={`status-dot ${apiState === "live" ? "is-live" : ""}`}
					></span>
					<span className="status-text">
						{apiState === "live"
							? "Live API"
							: apiState === "fallback"
								? "Saved results"
								: "Connecting"}
					</span>
					<button
						className="icon-button"
						onClick={loadData}
						aria-label="Refresh dashboard"
						title="Refresh data"
					>
						<RefreshCw
							size={17}
							className={loading ? "spin" : ""}
						/>
					</button>
				</div>
			</header>

			<main id="main-content">
				<section className="hero" id="top">
					<div className="hero-copy">
						<div className="eyebrow">
							<span className="eyebrow-line"></span> TIME-SERIES
							MODEL BENCHMARK
						</div>

						<h1>
							Can El Niño help
							<br />
							<em>predict food inflation?</em>
						</h1>

						<p className="hero-description">
							A side-by-side evaluation of forecasting models for
							Indian food inflation — measuring whether climate
							signals add predictive value beyond historical
							patterns.
						</p>

						<div className="hero-meta">
							<span>
								<CalendarDays size={15} /> Test window:{" "}
								{comparison.test_period}
							</span>
							<span>
								<Activity size={15} /> 4 forecasting models
							</span>
						</div>

						<a className="text-link" href="#evaluation">
							Explore model performance{" "}
							<span aria-hidden="true">↘</span>
						</a>
					</div>

					<div
						className="hero-visual"
						aria-label="Illustration of climate data and food supply"
					>
						<div className="orb orb-one"></div>
						<div className="orb orb-two"></div>
						<div className="visual-grid"></div>
						<div className="visual-label label-top">
							CLIMATE SIGNAL <span>ONI / ENSO</span>
						</div>
						<div className="visual-chart">
							<div className="chart-caption">
								FOOD INFLATION INDEX <b>01 — 25</b>
							</div>
							<svg
								viewBox="0 0 420 150"
								role="img"
								aria-label="Decorative trend line illustration"
							>
								<path
									d="M0 116 C25 110 24 78 53 88 S90 118 112 79 S145 44 170 67 S205 112 227 73 S265 32 290 58 S321 97 343 50 S390 45 420 17"
									fill="none"
									stroke="#4e91f4"
									strokeWidth="3"
									strokeLinecap="round"
								/>
								<path
									d="M0 116 C25 110 24 78 53 88 S90 118 112 79 S145 44 170 67 S205 112 227 73 S265 32 290 58 S321 97 343 50 S390 45 420 17 L420 150 L0 150Z"
									fill="url(#fill)"
									opacity=".3"
								/>
								<defs>
									<linearGradient
										id="fill"
										x1="0"
										x2="0"
										y1="0"
										y2="1"
									>
										<stop stopColor="#4e91f4" />
										<stop
											offset="1"
											stopColor="#4e91f4"
											stopOpacity="0"
										/>
									</linearGradient>
								</defs>
							</svg>
							<div className="visual-axis">
								<span>JAN ’21</span>
								<span>JAN ’23</span>
								<span>DEC ’25</span>
							</div>
						</div>
						<div className="visual-stat">
							<span className="stat-icon">
								<TrendingDown size={17} />
							</span>
							<span>
								<small>BEST MODEL MAE</small>
								<strong>
									{number(baseline?.MAE ?? 1.333475, 3)}
								</strong>
							</span>
							<span className="stat-unit">LOWER IS BETTER</span>
						</div>
						<div className="visual-label label-bottom">
							MODEL EVALUATION <span>4 METRICS</span>
						</div>
					</div>
				</section>

				<section
					className="section-block"
					id="overview"
					aria-labelledby="overview-title"
				>
					<div className="section-heading">
						<div>
							<div className="eyebrow">AT A GLANCE</div>
							<h2 id="overview-title">Evaluation snapshot</h2>
						</div>
						<p>All models scored on the same unseen test period.</p>
					</div>

					<div className="stat-grid">
						<article className="stat-card featured">
							<div className="stat-card-top">
								<span>TOP PERFORMER</span>
								<span className="mini-icon blue">
									<CheckCircle2 size={17} />
								</span>
							</div>
							<div className="stat-main">
								{baseline?.Model || "LSTM Baseline"}
							</div>
							<div className="stat-foot">
								Lowest error across all four metrics
							</div>
							<div className="card-accent"></div>
						</article>

						<article className="stat-card">
							<div className="stat-card-top">
								<span>BEST MAE</span>
								<span className="mini-icon">
									<Activity size={17} />
								</span>
							</div>
							<div className="stat-main">
								{number(baseline?.MAE ?? 1.333475, 3)}
							</div>
							<div className="stat-foot">
								Mean absolute error{" "}
								<span className="unit-tag">
									lower is better
								</span>
							</div>
						</article>

						<article className="stat-card">
							<div className="stat-card-top">
								<span>TEST PERIOD</span>
								<span className="mini-icon">
									<CalendarDays size={17} />
								</span>
							</div>
							<div className="stat-main">
								24 <small>months</small>
							</div>
							<div className="stat-foot">Jan 2024 – Dec 2025</div>
						</article>

						<article className="stat-card">
							<div className="stat-card-top">
								<span>ADDING ONI TO LSTM</span>
								<span
									className={`mini-icon ${oniChange > 0 ? "orange" : "green"}`}
								>
									<ArrowUpRight size={17} />
								</span>
							</div>
							<div className="stat-main">
								{oniChange === null
									? "+14.3%"
									: `${oniChange > 0 ? "+" : ""}${number(oniChange, 1)}%`}{" "}
								<small>MAE</small>
							</div>
							<div className="stat-foot">
								{oniChange > 0
									? "Error increased versus baseline"
									: "Change versus baseline"}
							</div>
						</article>
					</div>
				</section>

				<section
					className="section-block"
					id="forecasts"
					aria-labelledby="forecasts-title"
				>
					<div className="section-heading">
						<div>
							<div className="eyebrow">FORECAST BEHAVIOUR</div>
							<h2 id="forecasts-title">Predictions over time</h2>
						</div>
						<div className="chart-controls">
							<label className="select-wrap">
								<span className="sr-only">
									Forecast date range
								</span>
								<select
									value={range}
									onChange={(e) => setRange(e.target.value)}
								>
									<option value="all">
										All available dates
									</option>
									<option value="test">
										Evaluation period (2024–25)
									</option>
									<option value="recent">
										Recent 36 points
									</option>
								</select>
								<ChevronDown size={15} />
							</label>
						</div>
					</div>

					<div className="panel forecast-panel">
						<div className="panel-header">
							<div>
								<h3>Actual vs model predictions</h3>
								<p>
									Monthly food inflation · values from the
									prediction API
								</p>
							</div>
							<span className="chart-pill">
								<span></span>{" "}
								{forecastRows.length
									? `${forecastRows.length} dated points`
									: "Awaiting prediction data"}
							</span>
						</div>

						{mergedForecast.length ? (
							<>
								<div className="line-chart">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<LineChart
											data={mergedForecast}
											margin={{
												top: 10,
												right: 12,
												left: 0,
												bottom: 0,
											}}
										>
											<CartesianGrid
												strokeDasharray="3 5"
												stroke="#e9edf4"
											/>
											<XAxis
												dataKey="date"
												tickFormatter={(v) =>
													v?.slice(0, 4) === "2024" ||
													v?.slice(0, 4) === "2025"
														? v.slice(0, 7)
														: v?.slice(0, 4)
												}
												minTickGap={30}
												tick={{
													fontSize: 11,
													fill: "#8792a5",
												}}
												axisLine={false}
												tickLine={false}
											/>
											<YAxis
												tick={{
													fontSize: 11,
													fill: "#8792a5",
												}}
												axisLine={false}
												tickLine={false}
												width={45}
											/>
											<Tooltip
												labelFormatter={(v) =>
													`Date: ${v}`
												}
												formatter={(v, n) => [
													number(v, 2),
													n,
												]}
												contentStyle={{
													border: "1px solid #e6eaf1",
													borderRadius: 12,
													fontSize: 12,
												}}
											/>
											<Legend
												wrapperStyle={{
													fontSize: 12,
													paddingTop: 12,
												}}
											/>
											{actualRows.length > 0 && (
												<Line
													type="monotone"
													dataKey="actual"
													name="Actual food inflation"
													stroke="#17243a"
													strokeWidth={2.7}
													dot={false}
													connectNulls
												/>
											)}
											{visibleModels.map((m) => (
												<Line
													key={m.key}
													type="monotone"
													dataKey={m.name}
													name={m.name}
													stroke={m.color}
													strokeWidth={2}
													dot={false}
													connectNulls
												/>
											))}
										</LineChart>
									</ResponsiveContainer>
								</div>
								<div
									className="model-toggles"
									aria-label="Choose models to display"
								>
									{MODELS.map((m) => (
										<label
											key={m.key}
											className={
												selectedModels.includes(m.key)
													? "toggle active"
													: "toggle"
											}
										>
											<input
												type="checkbox"
												checked={selectedModels.includes(
													m.key,
												)}
												onChange={(e) =>
													setSelectedModels((old) =>
														e.target.checked
															? [...old, m.key]
															: old.filter(
																	(k) =>
																		k !==
																		m.key,
																),
													)
												}
											/>
											<span
												style={{
													"--model-color": m.color,
												}}
											></span>
											{m.name}
										</label>
									))}
								</div>
							</>
						) : (
							<div className="empty-chart">
								<div className="empty-icon">
									<Activity size={22} />
								</div>
								<h4>Prediction series will appear here</h4>
								<p>
									The dashboard tried to fetch{" "}
									<code>/predictions</code> and{" "}
									<code>/data</code>. Evaluation metrics below
									are still available from saved results.
								</p>
								<button
									className="button-secondary"
									onClick={loadData}
								>
									<RefreshCw size={15} /> Retry API connection
								</button>
							</div>
						)}

						<p className="chart-note">
							<CircleHelp size={14} /> Prediction values are
							plotted as returned by the backend. Actual series is
							shown only when a recognized food-inflation column
							is available.
						</p>
					</div>

					<div className="panel forecast-panel test-forecast-panel">
						<div className="panel-header">
							<div>
								<h3>Model predictions on the test data only</h3>
								<p>
									January 2024 – December 2025 · same held-out
									window used for evaluation
								</p>
							</div>
							<span className="chart-pill">
								<span></span>{" "}
								{testMergedForecast.length
									? `${testMergedForecast.length} test-period dates`
									: "No test-period data"}
							</span>
						</div>

						{testMergedForecast.length ? (
							<div className="line-chart">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart
										data={testMergedForecast}
										margin={{
											top: 10,
											right: 12,
											left: 0,
											bottom: 0,
										}}
									>
										<CartesianGrid
											strokeDasharray="3 5"
											stroke="#e9edf4"
										/>
										<XAxis
											dataKey="date"
											tickFormatter={(v) =>
												v?.slice(0, 7)
											}
											minTickGap={30}
											tick={{
												fontSize: 11,
												fill: "#8792a5",
											}}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{
												fontSize: 11,
												fill: "#8792a5",
											}}
											axisLine={false}
											tickLine={false}
											width={45}
										/>
										<Tooltip
											labelFormatter={(v) => `Date: ${v}`}
											formatter={(v, n) => [
												number(v, 2),
												n,
											]}
											contentStyle={{
												border: "1px solid #e6eaf1",
												borderRadius: 12,
												fontSize: 12,
											}}
										/>
										<Legend
											wrapperStyle={{
												fontSize: 12,
												paddingTop: 12,
											}}
										/>
										{actualRows.some(
											(row) =>
												row.actual !== null &&
												row.date >= "2024-01-01" &&
												row.date <= "2025-12-31",
										) && (
											<Line
												type="monotone"
												dataKey="actual"
												name="Actual food inflation"
												stroke="#17243a"
												strokeWidth={2.7}
												dot={{ r: 2 }}
												connectNulls={false}
											/>
										)}
										{visibleModels.map((model) => (
											<Line
												key={model.key}
												type="monotone"
												dataKey={model.name}
												name={model.name}
												stroke={model.color}
												strokeWidth={2}
												dot={{ r: 2 }}
												connectNulls={false}
											/>
										))}
									</LineChart>
								</ResponsiveContainer>
							</div>
						) : (
							<div className="empty-chart">
								<div className="empty-icon">
									<Activity size={22} />
								</div>
								<h4>
									No predictions found for the test window
								</h4>
								<p>
									Check that the prediction API returns dated
									predictions between January 2024 and
									December 2025.
								</p>
								<button
									className="button-secondary"
									onClick={loadData}
								>
									<RefreshCw size={15} /> Retry API connection
								</button>
							</div>
						)}
						<p className="chart-note">
							<CircleHelp size={14} /> This chart filters
							prediction dates to the evaluation window; it does
							not retrain or recalculate any model.
						</p>
					</div>
				</section>

				<section
					className="section-block"
					id="evaluation"
					aria-labelledby="evaluation-title"
				>
					<div className="section-heading">
						<div>
							<div className="eyebrow">HEAD-TO-HEAD</div>
							<h2 id="evaluation-title">Model performance</h2>
						</div>
						<button
							className="button-secondary"
							onClick={downloadCsv}
						>
							<Download size={16} /> Export metrics
						</button>
					</div>

					<div className="evaluation-grid">
						<div className="panel metric-panel">
							<div className="panel-header">
								<div>
									<h3>Compare evaluation metrics</h3>
									<p>Select a metric to rank each model.</p>
								</div>
								<span className="lower-label">
									<ArrowDownRight size={14} /> Lower is better
								</span>
							</div>

							<div
								className="metric-tabs"
								role="tablist"
								aria-label="Evaluation metric"
							>
								{Object.keys(metricInfo).map((k) => (
									<button
										key={k}
										role="tab"
										aria-selected={activeMetric === k}
										className={
											activeMetric === k
												? "metric-tab selected"
												: "metric-tab"
										}
										onClick={() => setActiveMetric(k)}
									>
										{k}
									</button>
								))}
							</div>

							<div className="metric-description">
								<strong>
									{metricInfo[activeMetric].label}
								</strong>
								<span>{metricInfo[activeMetric].detail}</span>
							</div>

							<div className="bar-chart">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={chartRows}
										layout="vertical"
										margin={{
											top: 4,
											right: 24,
											left: 12,
											bottom: 0,
										}}
									>
										<CartesianGrid
											strokeDasharray="3 5"
											horizontal={false}
											stroke="#e9edf4"
										/>
										<XAxis
											type="number"
											tick={{
												fontSize: 11,
												fill: "#8792a5",
											}}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											type="category"
											dataKey="Model"
											width={105}
											tick={{
												fontSize: 11,
												fill: "#4c596d",
											}}
											axisLine={false}
											tickLine={false}
										/>
										<Tooltip
											formatter={(v) => [
												number(v, 3),
												activeMetric,
											]}
											contentStyle={{
												borderRadius: 10,
												border: "1px solid #e6eaf1",
												fontSize: 12,
											}}
										/>
										<Bar
											dataKey={activeMetric}
											radius={[0, 5, 5, 0]}
											barSize={24}
										>
											{chartRows.map((entry, index) => (
												<Cell
													key={entry.Model}
													fill={
														MODELS.find(
															(m) =>
																m.name ===
																entry.Model,
														)?.color || "#9aa6b8"
													}
													opacity={
														index === 0 ? 1 : 0.78
													}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>

							<div className="best-callout">
								<span className="callout-icon">
									<CheckCircle2 size={18} />
								</span>
								<div>
									<strong>
										{ranked[0]?.Model} leads on{" "}
										{activeMetric}
									</strong>
									<p>
										{number(
											ranked[0]?.[activeMetric] ?? 0,
											3,
										)}{" "}
										{activeMetric === "sMAPE" ? "%" : ""} —
										the lowest error among the evaluated
										models.
									</p>
								</div>
							</div>
						</div>

						<div className="panel table-panel">
							<div className="panel-header">
								<div>
									<h3>Full scorecard</h3>
									<p>
										All four error metrics, lower is better.
									</p>
								</div>
								<span className="tiny-label">TEST SET</span>
							</div>

							<div className="table-scroll">
								<table>
									<caption className="sr-only">
										Forecast model evaluation metrics for
										January 2024 to December 2025
									</caption>
									<thead>
										<tr>
											<th scope="col">Model</th>
											<th scope="col">MAE</th>
											<th scope="col">RMSE</th>
											<th scope="col">sMAPE</th>
											<th scope="col">MASE</th>
										</tr>
									</thead>
									<tbody>
										{metrics.map((r) => {
											const isBest =
												/LSTM Baseline/i.test(r.Model);
											return (
												<tr
													key={r.Model}
													className={
														isBest
															? "winner-row"
															: ""
													}
												>
													<th scope="row">
														<span
															className="table-model-dot"
															style={{
																"--model-color":
																	MODELS.find(
																		(m) =>
																			m.name ===
																			r.Model,
																	)?.color ||
																	"#94a3b8",
															}}
														></span>
														{r.Model}
														{isBest && (
															<span className="winner-tag">
																BEST
															</span>
														)}
													</th>
													<td>{number(r.MAE, 2)}</td>
													<td>{number(r.RMSE, 2)}</td>
													<td>
														{number(r.sMAPE, 2)}%
													</td>
													<td>{number(r.MASE, 2)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							<div className="rank-list">
								<div className="rank-heading">
									OVERALL RANKING{" "}
									<span>by average metric rank</span>
								</div>
								{[...metrics]
									.sort(
										(a, b) =>
											Number(
												a["Average Rank"] ??
													a["Final Rank"],
											) -
											Number(
												b["Average Rank"] ??
													b["Final Rank"],
											),
									)
									.map((r, i) => (
										<div className="rank-row" key={r.Model}>
											<span
												className={`rank-number ${i === 0 ? "rank-first" : ""}`}
											>
												{i + 1}
											</span>
											<span>{r.Model}</span>
											<span className="rank-track">
												<i
													style={{
														width: `${Math.max(8, 100 - i * 25)}%`,
														"--model-color":
															MODELS.find(
																(m) =>
																	m.name ===
																	r.Model,
															)?.color ||
															"#94a3b8",
													}}
												></i>
											</span>
										</div>
									))}
							</div>
						</div>
					</div>
				</section>

				<section
					className="insight-section"
					aria-labelledby="insights-title"
				>
					<div className="insight-heading">
						<span className="insight-icon">
							<FlaskConical size={20} />
						</span>
						<div>
							<div className="eyebrow">
								WHAT THE RESULTS SUGGEST
							</div>
							<h2 id="insights-title">
								The signal is not the whole story.
							</h2>
						</div>
					</div>
					<div className="insight-cards">
						<article>
							<span className="insight-number">01</span>
							<h3>History wins this benchmark</h3>
							<p>
								The univariate LSTM baseline has the lowest
								error across MAE, RMSE, sMAPE and MASE in this
								test period.
							</p>
						</article>
						<article>
							<span className="insight-number">02</span>
							<h3>ONI did not improve the LSTM</h3>
							<p>
								The LSTM with ONI has higher MAE than the
								baseline. In this experiment, adding this
								climate indicator did not improve out-of-sample
								accuracy.
							</p>
						</article>
						<article>
							<span className="insight-number">03</span>
							<h3>Interpret with care</h3>
							<p>
								This is evidence for one dataset and test
								window, not proof that El Niño never matters.
								Lag choices, sample size and other drivers may
								affect results.
							</p>
						</article>
					</div>
				</section>

				<section className="methodology">
					<div>
						<div className="eyebrow">METHODOLOGY</div>
						<h2>Designed for a fair comparison.</h2>
						<p>
							Each model is evaluated on a common chronological
							holdout window, January 2024 through December 2025.
							Error metrics are calculated on the same test period
							so the rankings are directly comparable.
						</p>
					</div>
					<div className="method-points">
						<div>
							<span>01</span>
							<p>
								<strong>Shared test window</strong>
								<small>Jan 2024 — Dec 2025</small>
							</p>
						</div>
						<div>
							<span>02</span>
							<p>
								<strong>Four complementary metrics</strong>
								<small>MAE · RMSE · sMAPE · MASE</small>
							</p>
						</div>
						<div>
							<span>03</span>
							<p>
								<strong>Baseline included</strong>
								<small>
									Tests whether ONI adds useful signal
								</small>
							</p>
						</div>
					</div>
				</section>
			</main>

			<footer>
				<a href="#top" className="footer-brand">
					<span className="brand-mark">
						<Leaf size={16} />
					</span>{" "}
					Food Inflation Lab
				</a>
				<p>
					Forecast evaluation dashboard · India food inflation & ENSO
				</p>
				<div className="footer-right">
					<span
						className={`status-dot ${apiState === "live" ? "is-live" : ""}`}
					></span>
					{apiState === "live"
						? "Connected to forecasting API"
						: apiState === "fallback"
							? "Showing saved evaluation metrics"
							: "Connecting to API"}
					{lastUpdated && (
						<small>
							{" "}
							· Updated{" "}
							{lastUpdated.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</small>
					)}
				</div>
			</footer>
		</div>
	);
}

export default App;
