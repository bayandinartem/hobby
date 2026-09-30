const SUITS = [
	{ name: "трефы", symbol: "♣", color: "black" },
	{ name: "бубны", symbol: "♦", color: "red" },
	{ name: "черви", symbol: "♥", color: "red" },
	{ name: "пики", symbol: "♠", color: "black" },
];
const RANKS = ["", "Туз", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Валет", "Дама", "Король"];
const board = document.querySelector("#board");
const moveCount = document.querySelector("#move-count");
const undoButton = document.querySelector("#undo");
const status = document.querySelector("#game-status");
let state;
let history = [];
let selected = null;
let pointerStart = null;
let suppressPointerClick = false;
let animationFrame;

function sourceFromElement(element) {
	return {
		type: element.dataset.sourceType,
		index: element.dataset.sourceIndex === "" ? undefined : Number(element.dataset.sourceIndex),
		cardIndex: element.dataset.cardIndex === "" ? undefined : Number(element.dataset.cardIndex),
	};
}

function createDeck() {
	const deck = SUITS.flatMap((suit, suitIndex) =>
		Array.from({ length: 13 }, (_, index) => ({
			id: `${suitIndex}-${index + 1}`,
			suit: suit.name,
			suitIndex,
			symbol: suit.symbol,
			color: suit.color,
			value: index + 1,
			faceUp: false,
		})),
	);

	for (let index = deck.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
	}
	return deck;
}

function createGame() {
	const deck = createDeck();
	const tableau = Array.from({ length: 7 }, (_, columnIndex) =>
		Array.from({ length: columnIndex + 1 }, (_, cardIndex) => {
			const card = deck.pop();
			card.faceUp = cardIndex === columnIndex;
			return card;
		}),
	);
	return {
		stock: deck,
		waste: [],
		tableau,
		foundations: Array.from({ length: 4 }, () => []),
		moves: 0,
		won: false,
	};
}

function cardName(card) {
	return `${RANKS[card.value]} ${card.suit}`;
}

function cardMarkup(card, source, extraClass = "") {
	const selectedClass = isSelected(source) ? " is-selected" : "";
	const label = cardName(card);
	if (!card.faceUp) {
		return `<button class="card card-back ${extraClass}" type="button" disabled data-card-id="${card.id}" aria-label="Карта рубашкой вверх"></button>`;
	}
	const suit = SUITS[card.suitIndex];
	return `
		<button class="card ${card.color} ${extraClass}${selectedClass}" type="button"
			data-card-id="${card.id}"
			data-source-type="${source.type}" data-source-index="${source.index ?? ""}"
			data-card-index="${source.cardIndex ?? ""}" aria-label="${label}">
			<span aria-hidden="true" class="card-corner"><span>${RANKS[card.value]}</span><span>${suit.symbol}</span></span>
			<span aria-hidden="true" class="card-center">${suit.symbol}</span>
			<span aria-hidden="true" class="card-corner card-corner-bottom"><span>${RANKS[card.value]}</span><span>${suit.symbol}</span></span>
		</button>`;
}

function isSelected(source) {
	return selected
		&& selected.type === source.type
		&& selected.index === source.index
		&& selected.cardIndex === source.cardIndex;
}

function captureCardPositions() {
	return new Map([...board.querySelectorAll("[data-card-id]")].map((card) => {
		const rect = card.getBoundingClientRect();
		return [card.dataset.cardId, { left: rect.left, top: rect.top }];
	}));
}

function animateCardPositions(previousPositions) {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const cardsToAnimate = [];
	for (const card of board.querySelectorAll("[data-card-id]")) {
		const previous = previousPositions.get(card.dataset.cardId);
		if (!previous) continue;
		const rect = card.getBoundingClientRect();
		const deltaX = previous.left - rect.left;
		const deltaY = previous.top - rect.top;
		if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;
		card.style.transition = "none";
		card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
		cardsToAnimate.push(card);
	}
	if (!cardsToAnimate.length) return;
	if (animationFrame) cancelAnimationFrame(animationFrame);
	void board.offsetWidth;
	animationFrame = requestAnimationFrame(() => {
		for (const card of cardsToAnimate) {
			card.style.transition = "";
			card.style.transform = "";
		}
		animationFrame = undefined;
	});
}

function render(previousPositions = null) {
	const wasteCard = state.waste.at(-1);
	const topRow = `
		<div class="top-row">
			<div class="draw-piles">
				<div class="pile">
					<button aria-label="${state.stock.length ? "Взять карту из колоды" : state.waste.length ? "Перевернуть сброс" : "Колода пуста"}"
						class="card ${state.stock.length ? "card-back" : "card-slot"}" data-action="stock"
						${state.stock.length ? `data-card-id="${state.stock.at(-1).id}"` : ""}
						type="button" ${!state.stock.length && !state.waste.length ? "disabled" : ""}>
						${!state.stock.length && state.waste.length ? "↻" : ""}
					</button>
					<div class="pile-label">КОЛОДА</div>
				</div>
				<div class="pile" data-pile-type="waste">
					${wasteCard ? cardMarkup(wasteCard, { type: "waste" }) : '<div aria-label="Сброс пуст" class="card-slot"></div>'}
					<div class="pile-label">СБРОС</div>
				</div>
			</div>
			<div class="foundations">
				${state.foundations.map((pile, index) => `
					<div class="pile" data-pile-type="foundation" data-pile-index="${index}">
						${pile.length
							? cardMarkup(pile.at(-1), { type: "foundation", index })
							: '<div aria-label="Пустое основание" class="card-slot foundation-slot"></div>'}
						<div class="pile-label">ОСНОВАНИЕ</div>
					</div>`).join("")}
			</div>
		</div>`;
	const columns = state.tableau.map((pile, columnIndex) => `
		<div aria-label="Колонка ${columnIndex + 1}" class="tableau-column ${pile.length ? "" : "is-empty"}"
			data-pile-type="tableau" data-pile-index="${columnIndex}">
			${pile.length
				? `<div class="tableau-stack" style="height:calc(var(--card-height) + ${pile.slice(0, -1).reduce((height, card) => height + (card.faceUp ? 32 : 20), 0)}px)">${pile.map((card, cardIndex) => {
					const source = { type: "tableau", index: columnIndex, cardIndex };
					const top = pile.slice(0, cardIndex).reduce((height, previousCard) => height + (previousCard.faceUp ? 32 : 20), 0);
					return `<div class="tableau-card" style="--stack-index:${cardIndex};--stack-top:${top}px">${cardMarkup(card, source)}</div>`;
				}).join("")}</div>`
				: '<div aria-label="Пустая колонка" class="card-slot"></div>'}
		</div>`).join("");

	board.innerHTML = `${topRow}<div class="tableau">${columns}</div>`;
	moveCount.value = state.moves;
	undoButton.disabled = history.length === 0;
	if (previousPositions) animateCardPositions(previousPositions);
}

function snapshot() {
	return JSON.parse(JSON.stringify(state));
}

function beginMove() {
	history.push(snapshot());
}

function getSourceCards(source) {
	if (!source) return [];
	if (source.type === "waste") return state.waste.length ? [state.waste.at(-1)] : [];
	if (source.type === "foundation") {
		const pile = state.foundations[source.index];
		return pile?.length ? [pile.at(-1)] : [];
	}
	if (source.type === "tableau") {
		const pile = state.tableau[source.index];
		if (!pile || source.cardIndex < 0 || source.cardIndex >= pile.length) return [];
		const cards = pile.slice(source.cardIndex);
		return cards.length && cards.every((card) => card.faceUp) ? cards : [];
	}
	return [];
}

function isValidSequence(cards) {
	return cards.every((card, index) => index === 0
		|| (cards[index - 1].value === card.value + 1 && cards[index - 1].color !== card.color));
}

function canMoveToTableau(cards, source, destinationIndex) {
	if (!cards.length || source.type === "tableau" && source.index === destinationIndex) return false;
	if (!isValidSequence(cards)) return false;
	const destination = state.tableau[destinationIndex];
	if (!destination) return false;
	const bottomCard = cards[0];
	if (!destination.length) return bottomCard.value === 13;
	const topCard = destination.at(-1);
	return topCard.faceUp && topCard.value === bottomCard.value + 1 && topCard.color !== bottomCard.color;
}

function canMoveToFoundation(cards, source, foundationIndex) {
	if (cards.length !== 1 || source.type === "foundation") return false;
	const foundation = state.foundations[foundationIndex];
	if (!foundation) return false;
	const card = cards[0];
	if (!foundation.length) return card.value === 1 && card.suitIndex === foundationIndex;
	const topCard = foundation.at(-1);
	return topCard.suitIndex === card.suitIndex && card.value === topCard.value + 1;
}

function removeSourceCards(source) {
	if (source.type === "waste") return [state.waste.pop()];
	if (source.type === "foundation") return [state.foundations[source.index].pop()];
	const cards = state.tableau[source.index].splice(source.cardIndex);
	const newlyExposed = state.tableau[source.index].at(-1);
	if (newlyExposed && !newlyExposed.faceUp) newlyExposed.faceUp = true;
	return cards;
}

function moveSelectionTo(destination, { animate = true } = {}) {
	const cards = getSourceCards(selected);
	if (destination.type === "tableau" && !canMoveToTableau(cards, selected, destination.index)) return false;
	if (destination.type === "foundation" && !canMoveToFoundation(cards, selected, destination.index)) return false;
	if (destination.type !== "tableau" && destination.type !== "foundation") return false;

	const previousPositions = animate ? captureCardPositions() : null;
	beginMove();
	const movedCards = removeSourceCards(selected);
	if (destination.type === "tableau") {
		state.tableau[destination.index].push(...movedCards);
	} else {
		state.foundations[destination.index].push(movedCards[0]);
	}
	state.moves += 1;
	state.won = state.foundations.every((pile) => pile.length === 13);
	selected = null;
	render(previousPositions);
	status.textContent = state.won ? "Победа! Все карты собраны по мастям." : "Ход выполнен.";
	return true;
}

function moveCardToFoundation(source) {
	if (source.type !== "tableau" && source.type !== "waste") return false;
	const cards = getSourceCards(source);
	if (cards.length !== 1) return false;
	const card = cards[0];
	const matchingFoundation = state.foundations.findIndex((pile) => (
		pile.length && pile.at(-1).suitIndex === card.suitIndex
	));
	const emptyFoundation = state.foundations.findIndex((pile, index) => (
		!pile.length && index === card.suitIndex
	));
	const foundationIndex = matchingFoundation >= 0 ? matchingFoundation : emptyFoundation;
	if (foundationIndex < 0) return false;

	selected = source;
	return moveSelectionTo({ type: "foundation", index: foundationIndex });
}

function drawFromStock() {
	if (state.stock.length) {
		const previousPositions = captureCardPositions();
		beginMove();
		const card = state.stock.pop();
		card.faceUp = true;
		state.waste.push(card);
		state.moves += 1;
		selected = null;
		render(previousPositions);
		status.textContent = `Открыта карта: ${cardName(card)}.`;
	} else if (state.waste.length) {
		const previousPositions = captureCardPositions();
		beginMove();
		state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
		state.waste = [];
		state.moves += 1;
		selected = null;
		render(previousPositions);
		status.textContent = "Сброс возвращён в колоду.";
	} else {
		return;
	}
}

function selectSource(source) {
	if (!getSourceCards(source).length) return;
	if (isSelected(source)) {
		selected = null;
		status.textContent = "Выбор снят.";
	} else {
		selected = source;
		status.textContent = "Выберите подходящую колонку или основание.";
	}
	render();
}

function handleBoardClick(event) {
	if (suppressPointerClick) {
		suppressPointerClick = false;
		return;
	}
	const clickedCard = event.target.closest("[data-source-type]");
	if (event.detail >= 2 && clickedCard) {
		event.preventDefault();
		if (!moveCardToFoundation(sourceFromElement(clickedCard))) {
			status.textContent = "Эту карту сейчас нельзя отправить в основание.";
		}
		return;
	}
	const stockButton = event.target.closest("[data-action='stock']");
	if (stockButton) {
		drawFromStock();
		return;
	}

	const sourceElement = clickedCard;
	const source = sourceElement ? {
		type: sourceElement.dataset.sourceType,
		index: sourceElement.dataset.sourceIndex === "" ? undefined : Number(sourceElement.dataset.sourceIndex),
		cardIndex: sourceElement.dataset.cardIndex === "" ? undefined : Number(sourceElement.dataset.cardIndex),
	} : null;
	const pileElement = event.target.closest("[data-pile-type]");
	const destination = pileElement && pileElement.dataset.pileType !== "waste" ? {
		type: pileElement.dataset.pileType,
		index: Number(pileElement.dataset.pileIndex),
	} : null;

	if (selected && source && isSelected(source)) {
		selected = null;
		status.textContent = "Выбор снят.";
		render();
		return;
	}
	if (selected && destination) {
		if (moveSelectionTo(destination)) return;
		status.textContent = "Такой ход сделать нельзя.";
		return;
	}
	if (source) {
		selectSource(source);
	}
}

function undoMove() {
	if (!history.length) return;
	const previousPositions = captureCardPositions();
	state = history.pop();
	selected = null;
	status.textContent = "Последний ход отменён.";
	render(previousPositions);
}

function newGame() {
	state = createGame();
	history = [];
	selected = null;
	status.textContent = "Новая раздача готова. Удачной игры!";
	render();
}

board.addEventListener("click", handleBoardClick);
undoButton.addEventListener("click", undoMove);
document.querySelector("#new-game").addEventListener("click", newGame);

function clearDragPreview(start) {
	if (!start) return;
	for (const item of start.draggedCards ?? []) {
		item.element.remove();
		item.source.style.visibility = "";
		if (item.destination) item.destination.style.visibility = "";
	}
	start.draggedCards = [];
}

function animateDragPreview(start) {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		clearDragPreview(start);
		return;
	}

	const previews = start.draggedCards.filter((item) => {
		item.destination = board.querySelector(`[data-card-id="${item.cardId}"]`);
		return item.destination;
	});
	if (previews.length !== start.draggedCards.length) {
		clearDragPreview(start);
		return;
	}

	for (const item of previews) {
		const currentRect = item.element.getBoundingClientRect();
		const destinationRect = item.destination.getBoundingClientRect();
		item.destination.style.visibility = "hidden";
		item.element.style.transition = "transform 240ms cubic-bezier(0.2, 0.75, 0.25, 1)";
		item.element.style.willChange = "transform";
		item.element.style.setProperty("--landing-x", `${destinationRect.left - currentRect.left}px`);
		item.element.style.setProperty("--landing-y", `${destinationRect.top - currentRect.top}px`);
	}
	void previews[0].element.offsetWidth;

	let finished = 0;
	let cleaned = false;
	const finish = () => {
		if (cleaned) return;
		cleaned = true;
		clearTimeout(fallback);
		clearDragPreview(start);
	};
	const fallback = window.setTimeout(finish, 350);
	for (const item of previews) {
		item.element.addEventListener("transitionend", (event) => {
			if (event.propertyName !== "transform") return;
			finished += 1;
			if (finished === previews.length) finish();
		}, { once: true });
	}
	requestAnimationFrame(() => {
		for (const item of previews) {
			item.element.style.transform = "translate(var(--landing-x), var(--landing-y))";
		}
	});
}

function updateDragPreview(start, deltaX, deltaY) {
	for (const item of start.draggedCards) {
		item.element.style.left = `${item.left + deltaX}px`;
		item.element.style.top = `${item.top + deltaY}px`;
	}
}

document.addEventListener("pointerdown", (event) => {
	const card = event.target.closest("[data-source-type]");
	if (!card || card.disabled) {
		pointerStart = null;
		return;
	}
	pointerStart = {
		source: sourceFromElement(card),
		pointerId: event.pointerId,
		x: event.clientX,
		y: event.clientY,
		pointerType: event.pointerType,
		draggedCards: [],
	};
});

document.addEventListener("pointermove", (event) => {
	if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
	const deltaX = event.clientX - pointerStart.x;
	const deltaY = event.clientY - pointerStart.y;
	if (!pointerStart.draggedCards.length && Math.hypot(deltaX, deltaY) >= 8) {
		const cards = getSourceCards(pointerStart.source);
		for (const movedCard of cards) {
			const sourceCard = board.querySelector(`[data-card-id="${movedCard.id}"]`);
			if (!sourceCard) continue;
			const rect = sourceCard.getBoundingClientRect();
			const previewCard = sourceCard.cloneNode(true);
			previewCard.classList.remove("is-selected");
			previewCard.classList.add("drag-preview");
			previewCard.style.cssText += `;position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:10000;pointer-events:none;transition:none;`;
			document.body.append(previewCard);
			sourceCard.style.visibility = "hidden";
			pointerStart.draggedCards.push({
				element: previewCard,
				source: sourceCard,
				cardId: movedCard.id,
				left: rect.left,
				top: rect.top,
			});
		}
	}
	updateDragPreview(pointerStart, deltaX, deltaY);
});

document.addEventListener("pointerup", (event) => {
	if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
	const start = pointerStart;
	pointerStart = null;
	const dragged = Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 8;
	if (!dragged) {
		if (start.pointerType === "touch" && moveCardToFoundation(start.source)) {
			suppressPointerClick = true;
			window.setTimeout(() => { suppressPointerClick = false; }, 0);
		}
		return;
	}
	updateDragPreview(start, event.clientX - start.x, event.clientY - start.y);
	suppressPointerClick = true;
	window.setTimeout(() => { suppressPointerClick = false; }, 0);
	const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-pile-type]");
	if (!target || target.dataset.pileType === "waste") {
		clearDragPreview(start);
		return;
	}
	selected = start.source;
	if (!moveSelectionTo({ type: target.dataset.pileType, index: Number(target.dataset.pileIndex) }, { animate: false })) {
		clearDragPreview(start);
		status.textContent = "Такой ход сделать нельзя.";
		render();
		return;
	}
	animateDragPreview(start);
});

document.addEventListener("pointercancel", () => {
	clearDragPreview(pointerStart);
	pointerStart = null;
});

state = createGame();
render();
