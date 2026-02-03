function getRequiredElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Missing element: #${id}`);
	}
	return element as T;
}

const numGuestsInput = getRequiredElement<HTMLInputElement>("numGuests");
const slicesPerPersonInput = getRequiredElement<HTMLInputElement>("slicesPerPerson");
const slicesPerPizzaInput = getRequiredElement<HTMLInputElement>("slicesPerPizza");
const resultDiv = getRequiredElement<HTMLDivElement>("result");
const guestsContainer = getRequiredElement<HTMLDivElement>("guestsContainer");
const pizzasContainer = getRequiredElement<HTMLDivElement>("pizzasContainer");

const numGuestsValueSpan = getRequiredElement<HTMLSpanElement>("numGuestsValue");
const slicesPerPersonValueSpan = getRequiredElement<HTMLSpanElement>("slicesPerPersonValue");
const slicesPerPizzaValueSpan = getRequiredElement<HTMLSpanElement>("slicesPerPizzaValue");

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

		resultDiv.textContent = `For ${numGuests} guest(s) you'll need ${pizzasNeeded} pizza(s)!`;
		resultDiv.classList.remove("d-none");

		renderIcons(guestsContainer, GUEST_EMOJI, numGuests);
		renderIcons(pizzasContainer, PIZZA_EMOJI, pizzasNeeded);
		return;
	}

	resultDiv.textContent = "Please provide valid numbers in all fields.";
	resultDiv.classList.remove("d-none");
	guestsContainer.replaceChildren();
	pizzasContainer.replaceChildren();
}

// Attach input event listeners so that every slider change triggers a recalculation
numGuestsInput.addEventListener("input", calculatePizzas);
slicesPerPersonInput.addEventListener("input", calculatePizzas);
slicesPerPizzaInput.addEventListener("input", calculatePizzas);

// Run the calculation on initial load so the icons show up by default.
calculatePizzas();
