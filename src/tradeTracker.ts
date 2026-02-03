type WithdrawalRule = "profit_start" | "profit_hwm" | "goal_only";

interface Settings {
	startingCapital: number;
	dailyTargetPct: number;
	startDate: string;
	targetGoal: number;
}

interface DayEntry {
	id: string;
	date: string;
	actualClose: number | null;
	noTrade: boolean;
}

interface Cashflow {
	id: string;
	date: string;
	amount: number;
	type: "deposit" | "withdrawal";
	note?: string;
}

interface WithdrawalSettings {
	rule: WithdrawalRule;
	rate: number;
	buffer: number;
}

interface TrackerData {
	settings: Settings | null;
	days: DayEntry[];
	cashflows: Cashflow[];
	withdrawal: WithdrawalSettings;
}

interface DayMetrics {
	entry: DayEntry;
	dayIndex: number;
	targetStart: number;
	targetEnd: number;
	targetGain: number;
	netCashflow: number;
	tradingChange: number | null;
	tradingPct: number | null;
	status: "goal" | "green" | "neutral" | "red" | "pending";
	equityValue: number;
}

const STORAGE_KEY = "tradeTrackerData_v1";

const setupForm = getRequiredElement<HTMLFormElement>("setupForm");
const startingCapitalInput = getRequiredElement<HTMLInputElement>("startingCapital");
const dailyTargetPctInput = getRequiredElement<HTMLInputElement>("dailyTargetPct");
const startDateInput = getRequiredElement<HTMLInputElement>("startDate");
const targetGoalInput = getRequiredElement<HTMLInputElement>("targetGoal");
const resetAllButton = getRequiredElement<HTMLButtonElement>("resetAll");
const addDayButton = getRequiredElement<HTMLButtonElement>("addDay");

const summaryEquity = getRequiredElement<HTMLParagraphElement>("summaryEquity");
const summaryTargetEnd = getRequiredElement<HTMLParagraphElement>("summaryTargetEnd");
const summaryTargetPct = getRequiredElement<HTMLParagraphElement>("summaryTargetPct");
const summaryDrawdown = getRequiredElement<HTMLParagraphElement>("summaryDrawdown");

const targetDay = getRequiredElement<HTMLParagraphElement>("targetDay");
const targetStart = getRequiredElement<HTMLParagraphElement>("targetStart");
const targetEnd = getRequiredElement<HTMLParagraphElement>("targetEnd");
const targetGain = getRequiredElement<HTMLParagraphElement>("targetGain");

const daysContainer = getRequiredElement<HTMLDivElement>("daysContainer");
const historyBody = getRequiredElement<HTMLTableSectionElement>("historyBody");
const chartTargetPath = getRequiredElement<SVGPathElement>("targetPath");
const chartActualPath = getRequiredElement<SVGPathElement>("actualPath");

const metricWinRate = getRequiredElement<HTMLSpanElement>("metricWinRate");
const metricAvgGreen = getRequiredElement<HTMLSpanElement>("metricAvgGreen");
const metricAvgRed = getRequiredElement<HTMLSpanElement>("metricAvgRed");
const metricProfitFactor = getRequiredElement<HTMLSpanElement>("metricProfitFactor");
const metricGoalStreak = getRequiredElement<HTMLSpanElement>("metricGoalStreak");
const metricGreenStreak = getRequiredElement<HTMLSpanElement>("metricGreenStreak");

const cashflowForm = getRequiredElement<HTMLFormElement>("cashflowForm");
const cashflowDateInput = getRequiredElement<HTMLInputElement>("cashflowDate");
const cashflowTypeInput = getRequiredElement<HTMLSelectElement>("cashflowType");
const cashflowAmountInput = getRequiredElement<HTMLInputElement>("cashflowAmount");
const cashflowNoteInput = getRequiredElement<HTMLInputElement>("cashflowNote");
const cashflowList = getRequiredElement<HTMLDivElement>("cashflowList");

const withdrawRuleInput = getRequiredElement<HTMLSelectElement>("withdrawRule");
const withdrawRateInput = getRequiredElement<HTMLInputElement>("withdrawRate");
const withdrawBufferInput = getRequiredElement<HTMLInputElement>("withdrawBuffer");
const withdrawSuggestion = getRequiredElement<HTMLParagraphElement>("withdrawalSuggestion");
const withdrawNote = getRequiredElement<HTMLParagraphElement>("withdrawalNote");
const saveWithdrawSettings = getRequiredElement<HTMLButtonElement>("saveWithdrawSettings");

const exportButton = getRequiredElement<HTMLButtonElement>("exportData");
const importInput = getRequiredElement<HTMLInputElement>("importData");

const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".filter-button"));

let activeFilter: "all" | "goal" | "green" | "neutral" | "red" = "all";

function getRequiredElement<T extends Element>(id: string): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Missing element: #${id}`);
	}
	return element as unknown as T;
}

function defaultWithdrawalSettings(): WithdrawalSettings {
	return {
		rule: "profit_hwm",
		rate: 50,
		buffer: 0,
	};
}

function loadData(): TrackerData {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return {
			settings: null,
			days: [],
			cashflows: [],
			withdrawal: defaultWithdrawalSettings(),
		};
	}

	try {
		const parsed = JSON.parse(raw) as TrackerData;
		return {
			settings: parsed.settings ?? null,
			days: parsed.days ?? [],
			cashflows: parsed.cashflows ?? [],
			withdrawal: parsed.withdrawal ?? defaultWithdrawalSettings(),
		};
	} catch {
		return {
			settings: null,
			days: [],
			cashflows: [],
			withdrawal: defaultWithdrawalSettings(),
		};
	}
}

function saveData(data: TrackerData): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatCurrency(value: number): string {
	return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPercent(value: number, decimals = 2): string {
	return `${value.toFixed(decimals)}%`;
}

function parseNumber(input: HTMLInputElement): number {
	return Number.parseFloat(input.value) || 0;
}

function generateId(prefix: string): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getTodayString(): string {
	const today = new Date();
	return today.toISOString().slice(0, 10);
}

function addDays(base: string, days: number): string {
	const date = new Date(base);
	date.setDate(date.getDate() + days);
	return date.toISOString().slice(0, 10);
}

function getDefaultDayDate(days: DayEntry[], startDate?: string): string {
	const today = getTodayString();
	if (days.length === 0 && startDate) {
		return startDate;
	}
	const hasToday = days.some((day) => day.date === today);
	if (!hasToday) {
		return today;
	}

	if (days.length === 0) {
		return today;
	}

	const lastDate = days[days.length - 1].date || today;
	return addDays(lastDate, 1);
}

function getNetCashflowForDate(cashflows: Cashflow[], date: string): number {
	return cashflows
		.filter((flow) => flow.date === date)
		.reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
}

function buildMetrics(data: TrackerData): DayMetrics[] {
	if (!data.settings) {
		return [];
	}

	const dailyTarget = data.settings.dailyTargetPct / 100;
	let runningStart = data.settings.startingCapital;
	const metrics: DayMetrics[] = [];

	data.days.forEach((entry, index) => {
		const targetStartValue = runningStart;
		const targetEndValue = targetStartValue * (1 + dailyTarget);
		const targetGainValue = targetEndValue - targetStartValue;
		const netCashflow = getNetCashflowForDate(data.cashflows, entry.date);
		let tradingChange: number | null = null;
		let tradingPct: number | null = null;
		let status: DayMetrics["status"] = "pending";

		if (entry.noTrade) {
			tradingChange = 0;
			tradingPct = 0;
			status = "neutral";
		} else if (entry.actualClose !== null) {
			tradingChange = entry.actualClose - targetStartValue - netCashflow;
			tradingPct = targetStartValue > 0 ? (tradingChange / targetStartValue) * 100 : 0;
			if (tradingChange >= targetGainValue) {
				status = "goal";
			} else if (tradingChange > 0) {
				status = "green";
			} else if (tradingChange === 0) {
				status = "neutral";
			} else {
				status = "red";
			}
		}

		if (entry.actualClose !== null) {
			runningStart = entry.actualClose;
		} else if (entry.noTrade) {
			runningStart = targetStartValue + netCashflow;
		}

		metrics.push({
			entry,
			dayIndex: index + 1,
			targetStart: targetStartValue,
			targetEnd: targetEndValue,
			targetGain: targetGainValue,
			netCashflow,
			tradingChange,
			tradingPct,
			status,
			equityValue: entry.actualClose ?? (entry.noTrade ? targetStartValue + netCashflow : targetStartValue),
		});
	});

	return metrics;
}

function computeMaxDrawdown(values: number[]): number {
	let peak = values[0] ?? 0;
	let maxDrawdown = 0;
	values.forEach((value) => {
		if (value > peak) {
			peak = value;
		}
		const drawdown = peak > 0 ? (peak - value) / peak : 0;
		if (drawdown > maxDrawdown) {
			maxDrawdown = drawdown;
		}
	});
	return maxDrawdown * 100;
}

function renderSummary(data: TrackerData, metrics: DayMetrics[]): void {
	if (!data.settings) {
		summaryEquity.textContent = formatCurrency(0);
		summaryTargetEnd.textContent = formatCurrency(0);
		summaryTargetPct.textContent = formatPercent(0);
		summaryDrawdown.textContent = formatPercent(0);
		return;
	}

	const lastActual = metrics.slice().reverse().find((metric) => metric.entry.actualClose !== null);
	const currentEquity = lastActual?.entry.actualClose ?? data.settings.startingCapital;
	const currentTarget = metrics[metrics.length - 1];
	const targetEndValue = currentTarget ? currentTarget.targetEnd : data.settings.startingCapital;
	const equityCurve = [data.settings.startingCapital, ...metrics.map((metric) => metric.equityValue)];
	const maxDrawdown = computeMaxDrawdown(equityCurve);

	summaryEquity.textContent = formatCurrency(currentEquity);
	summaryTargetEnd.textContent = formatCurrency(targetEndValue);
	summaryTargetPct.textContent = formatPercent(data.settings.dailyTargetPct, 2);
	summaryDrawdown.textContent = formatPercent(maxDrawdown, 2);
}

function renderTargetPanel(data: TrackerData, metrics: DayMetrics[]): void {
	if (!data.settings) {
		targetDay.textContent = "Day 0";
		targetStart.textContent = formatCurrency(0);
		targetEnd.textContent = formatCurrency(0);
		targetGain.textContent = formatCurrency(0);
		return;
	}

	const dayCount = metrics.length;
	const currentMetric = metrics[metrics.length - 1];
	if (!currentMetric) {
		targetDay.textContent = "Day 1";
		targetStart.textContent = formatCurrency(data.settings.startingCapital);
		const targetEndValue = data.settings.startingCapital * (1 + data.settings.dailyTargetPct / 100);
		targetEnd.textContent = formatCurrency(targetEndValue);
		targetGain.textContent = formatCurrency(targetEndValue - data.settings.startingCapital);
		return;
	}

	targetDay.textContent = `Day ${dayCount}`;
	targetStart.textContent = formatCurrency(currentMetric.targetStart);
	targetEnd.textContent = formatCurrency(currentMetric.targetEnd);
	targetGain.textContent = formatCurrency(currentMetric.targetGain);
}

function renderDays(data: TrackerData, metrics: DayMetrics[]): void {
	daysContainer.innerHTML = "";
	metrics.forEach((metric) => {
		const card = document.createElement("div");
		card.className = "day-card";

		const header = document.createElement("div");
		header.className = "day-header";

		const heading = document.createElement("div");
		heading.innerHTML = `<strong>Day ${metric.dayIndex}</strong> <span class="text-muted">(${metric.entry.date || "No date"})</span>`;

		const statusBadge = document.createElement("span");
		statusBadge.className = `status-badge ${getStatusClass(metric.status)}`;
		statusBadge.textContent = getStatusLabel(metric.status, metric.entry);

		header.appendChild(heading);
		header.appendChild(statusBadge);

		const body = document.createElement("div");
		body.className = "row g-3 mt-2";

		body.appendChild(buildInputGroup("Date", buildDateInput(metric.entry)));
		body.appendChild(buildInputGroup("Actual Close", buildActualInput(metric.entry, metric.netCashflow, metric.targetStart, metric.entry.noTrade)));
		body.appendChild(buildToggleGroup("No Trade Today", buildNoTradeToggle(metric.entry)));

		const stats = document.createElement("div");
		stats.className = "col-12";
		stats.innerHTML = `
			<div class="row g-3">
				<div class="col-sm-4">
					<div class="small text-muted">Target Start</div>
					<div><strong>${formatCurrency(metric.targetStart)}</strong></div>
				</div>
				<div class="col-sm-4">
					<div class="small text-muted">Target End</div>
					<div><strong>${formatCurrency(metric.targetEnd)}</strong></div>
				</div>
				<div class="col-sm-4">
					<div class="small text-muted">Target Gain</div>
					<div><strong>${formatCurrency(metric.targetGain)}</strong></div>
				</div>
				<div class="col-sm-4">
					<div class="small text-muted">Net Cashflow</div>
					<div><strong>${formatCurrency(metric.netCashflow)}</strong></div>
				</div>
				<div class="col-sm-4">
					<div class="small text-muted">Trading Change</div>
					<div><strong>${metric.tradingChange !== null ? formatCurrency(metric.tradingChange) : "--"}</strong></div>
				</div>
				<div class="col-sm-4">
					<div class="small text-muted">Trading %</div>
					<div><strong>${metric.tradingPct !== null ? formatPercent(metric.tradingPct) : "--"}</strong></div>
				</div>
			</div>
		`;

		const footer = document.createElement("div");
		footer.className = "d-flex justify-content-end mt-3";
		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.className = "btn btn-outline-danger btn-sm";
		deleteButton.textContent = "Remove Day";
		deleteButton.addEventListener("click", () => {
			data.days = data.days.filter((day) => day.id !== metric.entry.id);
			saveData(data);
			renderAll(data);
		});
		footer.appendChild(deleteButton);

		card.appendChild(header);
		card.appendChild(body);
		card.appendChild(stats);
		card.appendChild(footer);
		daysContainer.appendChild(card);
	});
}

function getStatusClass(status: DayMetrics["status"]): string {
	switch (status) {
		case "goal":
			return "status-goal";
		case "green":
			return "status-green";
		case "neutral":
			return "status-neutral";
		case "red":
			return "status-red";
		default:
			return "status-pending";
	}
}

function getStatusLabel(status: DayMetrics["status"], entry?: DayEntry): string {
	if (entry?.noTrade) {
		return "No Trade";
	}
	switch (status) {
		case "goal":
			return "Met Goal";
		case "green":
			return "Green";
		case "neutral":
			return "Neutral";
		case "red":
			return "Red";
		default:
			return "Pending";
	}
}

function buildInputGroup(label: string, input: HTMLElement): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "col-md-4";
	const labelEl = document.createElement("label");
	labelEl.className = "form-label";
	labelEl.textContent = label;
	wrapper.appendChild(labelEl);
	wrapper.appendChild(input);
	return wrapper;
}

function buildToggleGroup(label: string, input: HTMLInputElement): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "col-md-4 d-flex align-items-end";
	const toggle = document.createElement("div");
	toggle.className = "form-check";
	const labelEl = document.createElement("label");
	labelEl.className = "form-check-label";
	labelEl.textContent = label;
	if (!input.id) {
		input.id = generateId("toggle");
	}
	labelEl.htmlFor = input.id;
	input.classList.add("form-check-input");
	toggle.appendChild(input);
	toggle.appendChild(labelEl);
	wrapper.appendChild(toggle);
	return wrapper;
}

function buildDateInput(entry: DayEntry): HTMLInputElement {
	const input = document.createElement("input");
	input.type = "date";
	input.className = "form-control";
	input.value = entry.date;
	input.addEventListener("change", () => {
		entry.date = input.value;
		const data = loadData();
		const day = data.days.find((item) => item.id === entry.id);
		if (day) {
			day.date = entry.date;
			saveData(data);
			renderAll(data);
		}
	});
	return input;
}

function buildActualInput(entry: DayEntry, netCashflow: number, targetStartValue: number, noTrade: boolean): HTMLInputElement {
	const input = document.createElement("input");
	input.type = "number";
	input.className = "form-control";
	input.min = "0";
	input.step = "0.01";
	input.value = entry.actualClose !== null ? String(entry.actualClose) : "";
	input.disabled = noTrade;
	if (noTrade && entry.actualClose === null) {
		const suggested = targetStartValue + netCashflow;
		input.value = suggested ? String(suggested.toFixed(2)) : "";
	}
	input.addEventListener("change", () => {
		const value = Number.parseFloat(input.value);
		entry.actualClose = Number.isFinite(value) ? value : null;
		const data = loadData();
		const day = data.days.find((item) => item.id === entry.id);
		if (day) {
			day.actualClose = entry.actualClose;
			saveData(data);
			renderAll(data);
		}
	});
	return input;
}

function buildNoTradeToggle(entry: DayEntry): HTMLInputElement {
	const input = document.createElement("input");
	input.type = "checkbox";
	input.checked = entry.noTrade;
	input.addEventListener("change", () => {
		entry.noTrade = input.checked;
		const data = loadData();
		const day = data.days.find((item) => item.id === entry.id);
		if (day) {
			day.noTrade = entry.noTrade;
			saveData(data);
			renderAll(data);
		}
	});
	return input;
}

function renderHistory(metrics: DayMetrics[]): void {
	historyBody.innerHTML = "";
	metrics
		.filter((metric) => {
			if (activeFilter === "all") {
				return true;
			}
			return metric.status === activeFilter;
		})
		.forEach((metric) => {
			const row = document.createElement("tr");
			row.innerHTML = `
				<td>${metric.entry.date || "--"}</td>
				<td>${metric.dayIndex}</td>
				<td>${formatCurrency(metric.targetStart)}</td>
				<td>${formatCurrency(metric.targetEnd)}</td>
				<td>${metric.entry.actualClose !== null ? formatCurrency(metric.entry.actualClose) : "--"}</td>
				<td>${metric.tradingPct !== null ? formatPercent(metric.tradingPct) : "--"}</td>
				<td><span class="status-badge ${getStatusClass(metric.status)}">${getStatusLabel(metric.status, metric.entry)}</span></td>
			`;
			historyBody.appendChild(row);
		});
}

function renderCashflows(data: TrackerData): void {
	cashflowList.innerHTML = "";
	data.cashflows.forEach((flow) => {
		const item = document.createElement("div");
		item.className = "d-flex justify-content-between align-items-center";
		const sign = flow.type === "deposit" ? "+" : "-";
		item.innerHTML = `
			<div>
				<strong>${flow.date}</strong> ${flow.note ? `- ${flow.note}` : ""}
				<div class="small text-muted">${flow.type}</div>
			</div>
			<div class="d-flex align-items-center gap-2">
				<span>${sign}${formatCurrency(flow.amount)}</span>
				<button type="button" class="btn btn-outline-danger btn-sm">Remove</button>
			</div>
		`;
		const removeButton = item.querySelector("button");
		if (removeButton) {
			removeButton.addEventListener("click", () => {
				data.cashflows = data.cashflows.filter((itemFlow) => itemFlow.id !== flow.id);
				saveData(data);
				renderAll(data);
			});
		}
		cashflowList.appendChild(item);
	});
}

function renderChart(data: TrackerData, metrics: DayMetrics[]): void {
	if (!data.settings) {
		chartTargetPath.setAttribute("d", "");
		chartActualPath.setAttribute("d", "");
		return;
	}

	const targets: number[] = [data.settings.startingCapital];
	const actuals: number[] = [data.settings.startingCapital];
	metrics.forEach((metric) => {
		targets.push(metric.targetEnd);
		actuals.push(metric.entry.actualClose ?? metric.equityValue);
	});

	const allValues = [...targets, ...actuals];
	const minValue = Math.min(...allValues);
	const maxValue = Math.max(...allValues);
	const range = maxValue - minValue || 1;

	const width = 600;
	const height = 240;

	function buildPath(values: number[]): string {
		return values
			.map((value, index) => {
				const x = (index / (values.length - 1 || 1)) * width;
				const normalized = (value - minValue) / range;
				const y = height - normalized * height;
				return `${index === 0 ? "M" : "L"}${x},${y}`;
			})
			.join(" ");
	}

	chartTargetPath.setAttribute("d", buildPath(targets));
	chartActualPath.setAttribute("d", buildPath(actuals));
}

function renderMetrics(metrics: DayMetrics[]): void {
	const completed = metrics.filter((metric) => metric.tradingChange !== null);
	const greens = completed.filter((metric) => (metric.tradingChange ?? 0) > 0);
	const reds = completed.filter((metric) => (metric.tradingChange ?? 0) < 0);
	const winRate = completed.length > 0 ? (greens.length / completed.length) * 100 : 0;
	const avgGreen = greens.length > 0 ? greens.reduce((sum, metric) => sum + (metric.tradingPct ?? 0), 0) / greens.length : 0;
	const avgRed = reds.length > 0 ? reds.reduce((sum, metric) => sum + (metric.tradingPct ?? 0), 0) / reds.length : 0;
	const totalGains = greens.reduce((sum, metric) => sum + Math.max(metric.tradingChange ?? 0, 0), 0);
	const totalLosses = reds.reduce((sum, metric) => sum + Math.abs(metric.tradingChange ?? 0), 0);
	const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Number.POSITIVE_INFINITY : 0;

	metricWinRate.textContent = formatPercent(winRate);
	metricAvgGreen.textContent = formatPercent(avgGreen);
	metricAvgRed.textContent = formatPercent(avgRed);
	metricProfitFactor.textContent = Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "Infinity";

	let goalStreak = 0;
	let greenStreak = 0;
	for (let i = metrics.length - 1; i >= 0; i -= 1) {
		if (metrics[i].status === "goal") {
			goalStreak += 1;
		} else {
			break;
		}
	}
	for (let i = metrics.length - 1; i >= 0; i -= 1) {
		if (metrics[i].status === "goal" || metrics[i].status === "green") {
			greenStreak += 1;
		} else {
			break;
		}
	}
	metricGoalStreak.textContent = goalStreak.toString();
	metricGreenStreak.textContent = greenStreak.toString();
}

function renderWithdrawalSuggestion(data: TrackerData, metrics: DayMetrics[]): void {
	if (!data.settings) {
		withdrawSuggestion.textContent = formatCurrency(0);
		withdrawNote.textContent = "";
		return;
	}

	const lastActual = metrics.slice().reverse().find((metric) => metric.entry.actualClose !== null);
	const equity = lastActual?.entry.actualClose ?? data.settings.startingCapital;

	let highWaterMark = data.settings.startingCapital;
	metrics.forEach((metric) => {
		if (metric.entry.actualClose !== null) {
			highWaterMark = Math.max(highWaterMark, metric.entry.actualClose);
		}
	});

	const rate = data.withdrawal.rate / 100;
	const buffer = data.withdrawal.buffer;
	let base = 0;
	let note = "";

	switch (data.withdrawal.rule) {
		case "profit_start":
			base = Math.max(0, equity - data.settings.startingCapital);
			note = "Based on profits above your starting capital.";
			break;
		case "profit_hwm": {
			const threshold = Math.max(data.settings.startingCapital, highWaterMark - buffer);
			base = Math.max(0, equity - threshold);
			note = `Based on profits above your high-water mark with a ${formatCurrency(buffer)} buffer.`;
			break;
		}
		case "goal_only":
			base = Math.max(0, equity - data.settings.targetGoal);
			note = "Only withdraw after you exceed your goal equity.";
			break;
	}

	const suggestion = base * rate;
	withdrawSuggestion.textContent = formatCurrency(suggestion);
	withdrawNote.textContent = note;
}

function renderAll(data: TrackerData): void {
	const metrics = buildMetrics(data);
	renderSummary(data, metrics);
	renderTargetPanel(data, metrics);
	renderDays(data, metrics);
	renderHistory(metrics);
	renderCashflows(data);
	renderChart(data, metrics);
	renderMetrics(metrics);
	renderWithdrawalSuggestion(data, metrics);
}

setupForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const data = loadData();
	const settings: Settings = {
		startingCapital: parseNumber(startingCapitalInput),
		dailyTargetPct: parseNumber(dailyTargetPctInput),
		startDate: startDateInput.value,
		targetGoal: parseNumber(targetGoalInput),
	};

	data.settings = settings;
	if (!data.withdrawal.buffer) {
		data.withdrawal.buffer = settings.startingCapital * 0.1;
	}
	saveData(data);
	renderAll(data);
});

resetAllButton.addEventListener("click", () => {
	localStorage.removeItem(STORAGE_KEY);
	renderAll(loadData());
});

addDayButton.addEventListener("click", () => {
	const data = loadData();
	if (!data.settings) {
		return;
	}
	const newDay: DayEntry = {
		id: generateId("day"),
		date: getDefaultDayDate(data.days, data.settings.startDate),
		actualClose: null,
		noTrade: false,
	};
	data.days.push(newDay);
	saveData(data);
	renderAll(data);
});

cashflowForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const data = loadData();
	const flow: Cashflow = {
		id: generateId("cashflow"),
		date: cashflowDateInput.value,
		type: cashflowTypeInput.value as Cashflow["type"],
		amount: parseNumber(cashflowAmountInput),
		note: cashflowNoteInput.value.trim() || undefined,
	};
	data.cashflows.push(flow);
	saveData(data);
	cashflowForm.reset();
	renderAll(data);
});

saveWithdrawSettings.addEventListener("click", () => {
	const data = loadData();
	data.withdrawal.rule = withdrawRuleInput.value as WithdrawalRule;
	data.withdrawal.rate = parseNumber(withdrawRateInput);
	data.withdrawal.buffer = parseNumber(withdrawBufferInput);
	saveData(data);
	renderAll(data);
});

exportButton.addEventListener("click", () => {
	const data = loadData();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "trade-tracker-backup.json";
	link.click();
	URL.revokeObjectURL(url);
});

importInput.addEventListener("change", () => {
	const file = importInput.files?.[0];
	if (!file) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		try {
			const parsed = JSON.parse(String(reader.result)) as TrackerData;
			saveData(parsed);
			renderAll(loadData());
		} catch {
			window.alert("Invalid JSON file.");
		}
	};
	reader.readAsText(file);
});

filterButtons.forEach((button) => {
	button.addEventListener("click", () => {
		filterButtons.forEach((btn) => btn.classList.remove("active"));
		button.classList.add("active");
		activeFilter = button.dataset.filter as typeof activeFilter;
		renderAll(loadData());
	});
});

function hydrateForm(data: TrackerData): void {
	withdrawRuleInput.value = data.withdrawal.rule;
	withdrawRateInput.value = String(data.withdrawal.rate);
	withdrawBufferInput.value = String(data.withdrawal.buffer);

	if (!data.settings) {
		return;
	}
	startingCapitalInput.value = String(data.settings.startingCapital);
	dailyTargetPctInput.value = String(data.settings.dailyTargetPct);
	startDateInput.value = data.settings.startDate;
	targetGoalInput.value = String(data.settings.targetGoal);
}

const initialData = loadData();
hydrateForm(initialData);
renderAll(initialData);
