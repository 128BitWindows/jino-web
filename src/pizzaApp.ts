const numGuestsInput = document.getElementById("numGuests") as HTMLInputElement;
const slicesPerPersonInput = document.getElementById("slicesPerPerson") as HTMLInputElement;
const slicesPerPizzaInput = document.getElementById("slicesPerPizza") as HTMLInputElement;
const resultDiv = document.getElementById("result") as HTMLDivElement;

//Calculate and display the number of pizzas needed
function calculatePizzas(): void 
{
	// Read and parse integer values from each input
	const numGuests = parseInt(numGuestsInput.value) || 0;
	const slicesPerPerson = parseInt(slicesPerPersonInput.value) || 0;
	const slicesPerPizza = parseInt(slicesPerPizzaInput.value) || 0;

	// If all values are > 0, calculate
	if (numGuests > 0 && slicesPerPerson > 0 && slicesPerPizza > 0) 
    {
		const totalSlicesNeeded = numGuests * slicesPerPerson;
		const pizzasNeeded = Math.ceil(totalSlicesNeeded / slicesPerPizza);

		resultDiv.textContent = `You will need ${pizzasNeeded} pizza(s) for ${numGuests} guest(s).`;
		resultDiv.classList.remove("d-none");
	}
    else
    {
		// If any field is missing/invalid, show a message
		resultDiv.textContent = "Please provide valid numbers in all fields.";
		resultDiv.classList.remove("d-none");
	}
}
numGuestsInput.addEventListener("input", calculatePizzas);
slicesPerPersonInput.addEventListener("input", calculatePizzas);
slicesPerPizzaInput.addEventListener("input", calculatePizzas);