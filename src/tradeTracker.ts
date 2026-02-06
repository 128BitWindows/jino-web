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

interface TrackerData {
	settings: Settings | null;
	days: DayEntry[];
	cashflows: Cashflow[];
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
const openSettingsButton = getRequiredElement<HTMLButtonElement>("openSettings");
const closeSettingsButton = getRequiredElement<HTMLButtonElement>("closeSettings");
const settingsDialog = getRequiredElement<HTMLDialogElement>("settingsDialog");

const summaryEquity = getRequiredElement<HTMLParagraphElement>("summaryEquity");
const summaryTargetEnd = getRequiredElement<HTMLParagraphElement>("summaryTargetEnd");
const summaryTargetPct = getRequiredElement<HTMLParagraphElement>("summaryTargetPct");
const summaryDrawdown = getRequiredElement<HTMLParagraphElement>("summaryDrawdown");

const targetDay = getRequiredElement<HTMLParagraphElement>("targetDay");
const targetStart = getRequiredElement<HTMLParagraphElement>("targetStart");
const targetEnd = getRequiredElement<HTMLParagraphElement>("targetEnd");
const targetGain = getRequiredElement<HTMLParagraphElement>("targetGain");

const currentDayCard = getRequiredElement<HTMLDivElement>("currentDayCard");
const historyBody = getRequiredElement<HTMLTableSectionElement>("historyBody");

const metricWinRate = getRequiredElement<HTMLSpanElement>("metricWinRate");
const metricAvgGreen = getRequiredElement<HTMLSpanElement>("metricAvgGreen");
const metricAvgRed = getRequiredElement<HTMLSpanElement>("metricAvgRed");
const metricProfitFactor = getRequiredElement<HTMLSpanElement>("metricProfitFactor");
const metricGoalStreak = getRequiredElement<HTMLSpanElement>("metricGoalStreak");
const metricGreenStreak = getRequiredElement<HTMLSpanElement>("metricGreenStreak");

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

function loadData(): TrackerData {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return {
			settings: null,
			days: [],
			cashflows: [],
		};
	}

	try {
		const parsed = JSON.parse(raw) as TrackerData;
		return {
			settings: parsed.settings ?? null,
			days: parsed.days ?? [],
			cashflows: parsed.cashflows ?? [],
		};
	} catch {
		return {
			settings: null,
			days: [],
			cashflows: [],
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
	currentDayCard.innerHTML = "";
	const currentMetric = metrics[metrics.length - 1];
	if (!currentMetric) {
		currentDayCard.innerHTML = `
			<p class="text-muted mb-3">No trading days logged yet.</p>
			<button type="button" class="btn btn-outline-primary" id="addDayInline">Add Trading Day</button>
		`;
		const inlineButton = currentDayCard.querySelector<HTMLButtonElement>("#addDayInline");
		inlineButton?.addEventListener("click", () => addDayButton.click());
		return;
	}

	const header = document.createElement("div");
	header.className = "day-header mb-3";
	header.innerHTML = `<div><strong>Day ${currentMetric.dayIndex}</strong> <span class="text-muted">(${currentMetric.entry.date || "No date"})</span></div>`;

	const statusBadge = document.createElement("span");
	statusBadge.className = `status-badge ${getStatusClass(currentMetric.status)}`;
	statusBadge.textContent = getStatusLabel(currentMetric.status, currentMetric.entry);
	header.appendChild(statusBadge);

	const body = document.createElement("div");
	body.className = "row g-3";
	body.appendChild(buildInputGroup("Date", buildDateInput(currentMetric.entry)));
	body.appendChild(buildInputGroup("Actual Close", buildActualInput(currentMetric.entry, currentMetric.netCashflow, currentMetric.targetStart, currentMetric.entry.noTrade)));
	body.appendChild(buildToggleGroup("No Trade Today", buildNoTradeToggle(currentMetric.entry)));

	const stats = document.createElement("div");
	stats.className = "col-12";
	stats.innerHTML = `
		<div class="row g-3">
			<div class="col-sm-4">
				<div class="small text-muted">Target Start</div>
				<div><strong>${formatCurrency(currentMetric.targetStart)}</strong></div>
			</div>
			<div class="col-sm-4">
				<div class="small text-muted">Target End</div>
				<div><strong>${formatCurrency(currentMetric.targetEnd)}</strong></div>
			</div>
			<div class="col-sm-4">
				<div class="small text-muted">Target Gain</div>
				<div><strong>${formatCurrency(currentMetric.targetGain)}</strong></div>
			</div>
			<div class="col-sm-4">
				<div class="small text-muted">Net Cashflow</div>
				<div><strong>${formatCurrency(currentMetric.netCashflow)}</strong></div>
			</div>
			<div class="col-sm-4">
				<div class="small text-muted">Trading Change</div>
				<div><strong>${currentMetric.tradingChange !== null ? formatCurrency(currentMetric.tradingChange) : "--"}</strong></div>
			</div>
			<div class="col-sm-4">
				<div class="small text-muted">Trading %</div>
				<div><strong>${currentMetric.tradingPct !== null ? formatPercent(currentMetric.tradingPct) : "--"}</strong></div>
			</div>
		</div>
	`;

	const footer = document.createElement("div");
	footer.className = "d-flex flex-column gap-2 mt-3";

	const cashflowToggle = document.createElement("button");
	cashflowToggle.type = "button";
	cashflowToggle.className = "btn btn-outline-secondary btn-sm";
	cashflowToggle.textContent = "Add Cashflow";

	const cashflowForm = document.createElement("div");
	cashflowForm.className = "row g-2 w-100 mt-2 d-none";
	cashflowForm.innerHTML = `
		<div class="col-md-4">
			<label class="form-label">Type</label>
			<select class="form-select form-select-sm" data-field="type">
				<option value="deposit">Deposit</option>
				<option value="withdrawal">Withdrawal</option>
			</select>
		</div>
		<div class="col-md-4">
			<label class="form-label">Amount</label>
			<input class="form-control form-control-sm" type="number" min="0" step="0.01" data-field="amount" />
		</div>
		<div class="col-md-4">
			<label class="form-label">Note</label>
			<input class="form-control form-control-sm" type="text" maxlength="80" data-field="note" />
		</div>
		<div class="col-12 d-flex justify-content-end">
			<button type="button" class="btn btn-primary btn-sm" data-action="save">Save Cashflow</button>
		</div>
	`;

	cashflowToggle.addEventListener("click", () => {
		cashflowForm.classList.toggle("d-none");
	});

	const saveCashflowButton = cashflowForm.querySelector<HTMLButtonElement>('[data-action="save"]');
	saveCashflowButton?.addEventListener("click", () => {
		const type = (cashflowForm.querySelector('[data-field="type"]') as HTMLSelectElement).value as Cashflow["type"];
		const amountValue = Number.parseFloat((cashflowForm.querySelector('[data-field="amount"]') as HTMLInputElement).value);
		const noteValue = (cashflowForm.querySelector('[data-field="note"]') as HTMLInputElement).value.trim();
		if (!Number.isFinite(amountValue) || amountValue <= 0) {
			return;
		}
		addCashflow(currentMetric.entry.date, {
			type,
			amount: amountValue,
			note: noteValue || undefined,
		});
		cashflowForm.classList.add("d-none");
	});

	const cashflowList = document.createElement("div");
	cashflowList.className = "d-flex flex-wrap gap-2";
	getCashflowsForDate(data.cashflows, currentMetric.entry.date).forEach((flow) => {
		const pill = document.createElement("span");
		pill.className = `cashflow-pill ${flow.type}`;
		pill.textContent = `${flow.type === "deposit" ? "+" : "-"}${formatCurrency(flow.amount)} ${flow.note ?? ""}`.trim();
		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "btn btn-link btn-sm p-0 ms-1";
		remove.textContent = "×";
		remove.addEventListener("click", () => removeCashflow(flow.id));
		pill.appendChild(remove);
		cashflowList.appendChild(pill);
	});

	const deleteButton = document.createElement("button");
	deleteButton.type = "button";
	deleteButton.className = "btn btn-outline-danger btn-sm";
	deleteButton.textContent = "Remove Day";
	deleteButton.addEventListener("click", () => {
		data.days = data.days.filter((day) => day.id !== currentMetric.entry.id);
		saveData(data);
		renderAll(data);
	});
	footer.appendChild(cashflowToggle);
	footer.appendChild(cashflowForm);
	footer.appendChild(cashflowList);
	footer.appendChild(deleteButton);

	currentDayCard.appendChild(header);
	currentDayCard.appendChild(body);
	currentDayCard.appendChild(stats);
	currentDayCard.appendChild(footer);
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
			const dateCell = document.createElement("td");
			const dateInput = document.createElement("input");
			dateInput.type = "date";
			dateInput.className = "form-control form-control-sm";
			dateInput.value = metric.entry.date;
			dateInput.addEventListener("change", () => updateDay(metric.entry.id, { date: dateInput.value }));
			dateCell.appendChild(dateInput);

			const dayCell = document.createElement("td");
			dayCell.textContent = String(metric.dayIndex);

			const targetStartCell = document.createElement("td");
			targetStartCell.textContent = formatCurrency(metric.targetStart);

			const targetEndCell = document.createElement("td");
			targetEndCell.textContent = formatCurrency(metric.targetEnd);

			const actualCell = document.createElement("td");
			const actualInput = document.createElement("input");
			actualInput.type = "number";
			actualInput.min = "0";
			actualInput.step = "0.01";
			actualInput.className = "form-control form-control-sm";
			actualInput.value = metric.entry.actualClose !== null ? String(metric.entry.actualClose) : "";
			actualInput.disabled = metric.entry.noTrade;
			actualInput.addEventListener("change", () => {
				const value = Number.parseFloat(actualInput.value);
				updateDay(metric.entry.id, { actualClose: Number.isFinite(value) ? value : null });
			});
			actualCell.appendChild(actualInput);

			const pctCell = document.createElement("td");
			pctCell.textContent = metric.tradingPct !== null ? formatPercent(metric.tradingPct) : "--";

			const statusCell = document.createElement("td");
			statusCell.innerHTML = `<span class="status-badge ${getStatusClass(metric.status)}">${getStatusLabel(metric.status, metric.entry)}</span>`;

			const editCell = document.createElement("td");
			editCell.className = "edit-cell";

			const noTradeLabel = document.createElement("label");
			noTradeLabel.className = "no-trade-toggle";
			const toggle = document.createElement("input");
			toggle.type = "checkbox";
			toggle.className = "form-check-input";
			toggle.checked = metric.entry.noTrade;
			toggle.addEventListener("change", () => updateDay(metric.entry.id, { noTrade: toggle.checked }));
			noTradeLabel.appendChild(toggle);
			noTradeLabel.appendChild(document.createTextNode(" No Trade"));

			const buttonGroup = document.createElement("div");
			buttonGroup.className = "edit-buttons";
			const cashflowButton = document.createElement("button");
			cashflowButton.type = "button";
			cashflowButton.className = "btn btn-outline-secondary btn-sm";
			cashflowButton.textContent = "Cashflow";
			cashflowButton.addEventListener("click", () => setCurrentDay(metric.entry.id));
			const removeButton = document.createElement("button");
			removeButton.type = "button";
			removeButton.className = "btn btn-outline-danger btn-sm";
			removeButton.textContent = "Remove";
			removeButton.addEventListener("click", () => removeDay(metric.entry.id));
			buttonGroup.appendChild(cashflowButton);
			buttonGroup.appendChild(removeButton);

			editCell.appendChild(noTradeLabel);
			editCell.appendChild(buttonGroup);

			row.appendChild(dateCell);
			row.appendChild(dayCell);
			row.appendChild(targetStartCell);
			row.appendChild(targetEndCell);
			row.appendChild(actualCell);
			row.appendChild(pctCell);
			row.appendChild(statusCell);
			row.appendChild(editCell);
			historyBody.appendChild(row);
		});
}

function updateDay(id: string, update: Partial<DayEntry>): void {
	const data = loadData();
	const day = data.days.find((item) => item.id === id);
	if (!day) {
		return;
	}
	Object.assign(day, update);
	if (day.noTrade) {
		day.actualClose = day.actualClose ?? null;
	}
	saveData(data);
	renderAll(data);
}

function removeDay(id: string): void {
	const data = loadData();
	data.days = data.days.filter((day) => day.id !== id);
	saveData(data);
	renderAll(data);
}

function getCashflowsForDate(cashflows: Cashflow[], date: string): Cashflow[] {
	return cashflows.filter((flow) => flow.date === date);
}

function addCashflow(date: string, payload: Omit<Cashflow, "id" | "date">): void {
	const data = loadData();
	data.cashflows.push({
		id: generateId("cashflow"),
		date,
		amount: payload.amount,
		type: payload.type,
		note: payload.note,
	});
	saveData(data);
	renderAll(data);
}

function removeCashflow(id: string): void {
	const data = loadData();
	data.cashflows = data.cashflows.filter((flow) => flow.id !== id);
	saveData(data);
	renderAll(data);
}

function setCurrentDay(dayId: string): void {
	const data = loadData();
	const index = data.days.findIndex((day) => day.id === dayId);
	if (index < 0) {
		return;
	}
	const day = data.days.splice(index, 1)[0];
	data.days.push(day);
	saveData(data);
	renderAll(data);
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

function renderAll(data: TrackerData): void {
	const metrics = buildMetrics(data);
	renderSummary(data, metrics);
	renderTargetPanel(data, metrics);
	renderDays(data, metrics);
	renderHistory(metrics);
	renderMetrics(metrics);
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
	saveData(data);
	renderAll(data);
	if (settingsDialog.open) {
		settingsDialog.close();
	}
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

openSettingsButton.addEventListener("click", () => {
	if (!settingsDialog.open) {
		settingsDialog.showModal();
	}
});

closeSettingsButton.addEventListener("click", () => {
	if (settingsDialog.open) {
		settingsDialog.close();
	}
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

if (!initialData.settings) {
	settingsDialog.showModal();
}
