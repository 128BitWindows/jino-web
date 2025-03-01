// Get DOM elements
const numGuestsInput = document.getElementById("numGuests") as HTMLInputElement;
const slicesPerPersonInput = document.getElementById("slicesPerPerson") as HTMLInputElement;
const slicesPerPizzaInput = document.getElementById("slicesPerPizza") as HTMLInputElement;
const resultDiv = document.getElementById("result") as HTMLDivElement;
const guestsContainer = document.getElementById("guestsContainer") as HTMLDivElement;
const pizzasContainer = document.getElementById("pizzasContainer") as HTMLDivElement;

// Get the span elements that show the current slider value
const numGuestsValueSpan = document.getElementById("numGuestsValue") as HTMLSpanElement;
const slicesPerPersonValueSpan = document.getElementById("slicesPerPersonValue") as HTMLSpanElement;
const slicesPerPizzaValueSpan = document.getElementById("slicesPerPizzaValue") as HTMLSpanElement;

// Unicode emoji constants
const PIZZA_EMOJI = "\u{1F355}";
const GUEST_EMOJI = "\u{1F464}";

// Calculate and update the UI
function calculatePizzas(): void {
  // Parse the current slider values
  const numGuests = parseInt(numGuestsInput.value) || 0;
  const slicesPerPerson = parseInt(slicesPerPersonInput.value) || 0;
  const slicesPerPizza = parseInt(slicesPerPizzaInput.value) || 0;

  // Update the display spans next to each slider
  numGuestsValueSpan.textContent = numGuestsInput.value;
  slicesPerPersonValueSpan.textContent = slicesPerPersonInput.value;
  slicesPerPizzaValueSpan.textContent = slicesPerPizzaInput.value;

  // Only calculate if all values are > 0
  if (numGuests > 0 && slicesPerPerson > 0 && slicesPerPizza > 0) {
    const totalSlicesNeeded = numGuests * slicesPerPerson;
    const pizzasNeeded = Math.ceil(totalSlicesNeeded / slicesPerPizza);

    resultDiv.textContent = `For ${numGuests} guest(s) you'll need ${pizzasNeeded} pizza(s)!`;
    resultDiv.classList.remove("d-none");

    // Update guest icons: one emoji per guest
    guestsContainer.innerHTML = "";
    for (let i = 0; i < numGuests; i++) {
      const span = document.createElement("span");
      span.textContent = GUEST_EMOJI;
      span.classList.add("emoji-icon", "mx-1", "animate-icon");
      guestsContainer.appendChild(span);
    }

    // Update pizza icons: one emoji per pizza needed
    pizzasContainer.innerHTML = "";
    for (let i = 0; i < pizzasNeeded; i++) {
      const span = document.createElement("span");
      span.textContent = PIZZA_EMOJI;
      span.classList.add("emoji-icon", "mx-1", "animate-icon");
      pizzasContainer.appendChild(span);
    }
  } else {
    // If any field is invalid, show an error and clear icons
    resultDiv.textContent = "Please provide valid numbers in all fields.";
    resultDiv.classList.remove("d-none");
    guestsContainer.innerHTML = "";
    pizzasContainer.innerHTML = "";
  }
}

// Attach input event listeners so that every slider change triggers a recalculation
numGuestsInput.addEventListener("input", calculatePizzas);
slicesPerPersonInput.addEventListener("input", calculatePizzas);
slicesPerPizzaInput.addEventListener("input", calculatePizzas);

// Run the calculation on initial load so the icons show up by default.
calculatePizzas();