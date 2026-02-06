function getRequiredElementById<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Missing element: #${id}`);
	}
	return element as T;
}

const numGuestsInput = getRequiredElementById<HTMLInputElement>("numGuests");
const slicesPerPersonInput = getRequiredElementById<HTMLInputElement>("slicesPerPerson");
const slicesPerPizzaInput = getRequiredElementById<HTMLInputElement>("slicesPerPizza");
const resultNumberSpan = getRequiredElementById<HTMLSpanElement>("resultNumber");
const guestsContainer = getRequiredElementById<HTMLDivElement>("guestsContainer");
const pizzasContainer = getRequiredElementById<HTMLDivElement>("pizzasContainer");

const numGuestsValueSpan = getRequiredElementById<HTMLSpanElement>("numGuestsValue");
const slicesPerPersonValueSpan = getRequiredElementById<HTMLSpanElement>("slicesPerPersonValue");
const slicesPerPizzaValueSpan = getRequiredElementById<HTMLSpanElement>("slicesPerPizzaValue");

// Unicode emoji constants
const PIZZA_EMOJI = "\u{1F355}";
const GUEST_EMOJI = "\u{1F464}";

function renderIcons(container: HTMLElement, emoji: string, count: number): void {
	const fragment = document.createDocumentFragment();
	for (let i = 0; i < count; i++) {
		const span = document.createElement("span");
		span.textContent = emoji;
		span.classList.add("emoji-icon", "mx-1", "animate-icon");
		fragment.appendChild(span);
	}
	container.replaceChildren(fragment);
}

function updateValueDisplay(input: HTMLInputElement, output: HTMLSpanElement): void {
	output.textContent = String(input.valueAsNumber);
}

function calculatePizzas(): void {
	const numGuests = numGuestsInput.valueAsNumber;
	const slicesPerPerson = slicesPerPersonInput.valueAsNumber;
	const slicesPerPizza = slicesPerPizzaInput.valueAsNumber;

	updateValueDisplay(numGuestsInput, numGuestsValueSpan);
	updateValueDisplay(slicesPerPersonInput, slicesPerPersonValueSpan);
	updateValueDisplay(slicesPerPizzaInput, slicesPerPizzaValueSpan);

	if (numGuests > 0 && slicesPerPerson > 0 && slicesPerPizza > 0) {
		const totalSlicesNeeded = numGuests * slicesPerPerson;
		const pizzasNeeded = Math.ceil(totalSlicesNeeded / slicesPerPizza);

		resultNumberSpan.textContent = String(pizzasNeeded);

		renderIcons(guestsContainer, GUEST_EMOJI, Math.min(numGuests, 30));
		renderIcons(pizzasContainer, PIZZA_EMOJI, Math.min(pizzasNeeded, 30));
		return;
	}

	resultNumberSpan.textContent = "0";
	guestsContainer.replaceChildren();
	pizzasContainer.replaceChildren();
}

// Attach input event listeners so that every slider change triggers a recalculation
numGuestsInput.addEventListener("input", calculatePizzas);
slicesPerPersonInput.addEventListener("input", calculatePizzas);
slicesPerPizzaInput.addEventListener("input", calculatePizzas);

// Run the calculation on initial load so the icons show up by default.
calculatePizzas();
