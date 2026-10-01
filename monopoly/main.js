import {
  acceptPropertySale, activePlayer, buildHouse, buyProperty, createGame, endTurn, mortgageProperty,
  payJailFine, proposePropertyPurchase, proposePropertySale, rejectPropertySale, rollDice, skipPurchase,
  unmortgageProperty, useJailCard
} from "./js/game.js";
import { createSoundEffects } from "./js/audio.js";
import { animateTokenAlongPath, createMovementPath, tokenCenterInBoard } from "./js/movement.js";
import { renderGame } from "./js/ui.js";
import { getPlayerOrdinal, supportedLocales, translate } from "./js/i18n.js";
import { bindActionButtons, handleNewGameAction } from "./js/actions.js";

const app = document.querySelector("#app");
const soundEffects = createSoundEffects();
let soundEnabled = soundEffects.supported;
let game = null;
let selectedProperty = null;
let log = [];
let setupError = "";
let locale = "ru";
let isRolling = false;
let isMoving = false;
let visualMovement = null;

function startGame(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const inputs = [...form.querySelectorAll("[name=player]")];
  if (inputs.slice(0, 2).some(input => !input.value.trim())) {
    setupError = translate(locale, "setup.missingPlayers");
    renderSetup(inputs.map(input => input.value));
    app.querySelector("[name=player][aria-invalid=true]")?.focus();
    return;
  }
  const names = inputs.map(input => input.value).filter(name => name.trim());
  try {
    game = createGame(names, { locale });
    selectedProperty = null;
    log = [translate(locale, "setup.intro")];
    isRolling = false;
    isMoving = false;
    visualMovement = null;
    render();
  } catch (error) {
    setupError = error.message;
    renderSetup();
  }
}

function renderSetup(playerValues = []) {
  document.documentElement.lang = locale;
  document.title = translate(locale, "page.title");
  document.querySelector('meta[name="description"]').content = translate(locale, "page.description");
  app.innerHTML = `
    <section class="setup-screen">
      <header class="setup-header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">♜</span>
          <div><p class="eyebrow">${escapeHtml(translate(locale, "setup.eyebrow"))}</p><h1>${escapeHtml(translate(locale, "setup.title"))}</h1></div>
        </div>
        ${renderSoundToggle()}
      </header>
      <p class="intro">${escapeHtml(translate(locale, "setup.intro"))}</p>
      <form id="setup-form" class="setup-card" novalidate>
        <label class="language-label" for="language-select">${escapeHtml(translate(locale, "setup.language"))}
          <select id="language-select" name="locale">
            ${supportedLocales.map(language => `<option value="${language}" ${language === locale ? "selected" : ""}>${escapeHtml(translate(locale, `language.${language}`))}</option>`).join("")}
          </select>
        </label>
        <h2>${escapeHtml(translate(locale, "setup.players"))}</h2>
        ${[1, 2, 3, 4].map(number => `
          <label>${escapeHtml(translate(locale, "setup.player", { number }))}
            <input name="player" maxlength="18" placeholder="${escapeHtml(translate(locale, "setup.namePlaceholder", { ordinal: getPlayerOrdinal(locale, number) }))}" autocomplete="off" ${number <= 2 ? `aria-required="true" ${setupError && !playerValues[number - 1]?.trim() ? "aria-invalid=\"true\"" : ""}` : ""} value="${escapeHtml(playerValues[number - 1] || "")}"></label>`).join("")}
        <p class="error" role="alert">${escapeHtml(setupError)}</p>
        <button class="primary-button" type="submit">${escapeHtml(translate(locale, "setup.start"))}</button>
        <p class="setup-note">${escapeHtml(translate(locale, "setup.note"))}</p>
      </form>
      <p class="compatibility-note">${escapeHtml(translate(locale, "setup.compatibility"))}</p>
    </section>`;
  app.querySelector("#setup-form").addEventListener("submit", startGame);
  bindSoundToggle();
  app.querySelector("#language-select").addEventListener("change", event => {
    const values = [...app.querySelectorAll("[name=player]")].map(input => input.value);
    locale = event.currentTarget.value;
    setupError = "";
    renderSetup(values);
  });
  app.querySelectorAll("[name=player]").forEach(input => input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    const requiredNames = [...app.querySelectorAll("[aria-required=true]")];
    if (setupError && requiredNames.every(requiredInput => requiredInput.value.trim())) {
      setupError = "";
      app.querySelector(".error").textContent = "";
    }
  }));
}

function render() {
  document.documentElement.lang = game.locale;
  document.title = translate(game.locale, "page.title");
  document.querySelector('meta[name="description"]').content = translate(game.locale, "page.description");
  app.innerHTML = renderGame(game, log, {
    selectedProperty,
    isRolling,
    isMoving,
    visualMovement,
    soundEnabled,
    soundSupported: soundEffects.supported
  });
  bindActionButtons(app, handleAction);
  bindSoundToggle();
  if (!isRolling && !isMoving) {
    app.querySelectorAll("[data-property]").forEach(button => button.addEventListener("click", () => {
      selectedProperty = Number(button.dataset.property);
      render();
      if (window.matchMedia("(max-width: 700px)").matches) {
        app.querySelector(".property-modal .modal-close")?.focus({ preventScroll: true });
      }
    }));
  }
  app.querySelectorAll("[data-trade-toggle]").forEach(button => button.addEventListener("click", () => {
    const formKey = `${button.dataset.tradeToggle}-${button.dataset.propertyIndex}`;
    const form = button.closest(".property-card").querySelector(`[data-property-trade-form="${formKey}"]`);
    form.hidden = false;
    form.querySelector("[name=buyerId]:not([type=hidden]), [name=price]")?.focus({ preventScroll: true });
  }));
  app.querySelectorAll("[data-property-trade-form]").forEach(form => form.addEventListener("submit", handlePropertyTradeOffer));
  app.querySelector(".property-modal")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeProperty();
  });
}

function handleAction(event) {
  if (isRolling || isMoving) return;
  const action = event.currentTarget.dataset.action;
  if (game.pendingTrade && !["accept-sale", "reject-sale", "new-game"].includes(action)) return;
  let didChange = true;
  switch (action) {
    case "roll":
      animateDiceRoll();
      return;
    case "buy": buyProperty(game); break;
    case "skip": skipPurchase(game); break;
    case "end": endTurn(game); break;
    case "jail-card": didChange = useJailCard(game); break;
    case "jail-fine": didChange = payJailFine(game); break;
    case "build": didChange = selectedProperty !== null && buildHouse(game, selectedProperty); break;
    case "mortgage": didChange = selectedProperty !== null && mortgageProperty(game, selectedProperty); break;
    case "unmortgage": didChange = selectedProperty !== null && unmortgageProperty(game, selectedProperty); break;
    case "accept-sale": didChange = acceptPropertySale(game); break;
    case "reject-sale": didChange = rejectPropertySale(game); break;
    case "close-property":
      closeProperty();
      return;
    case "new-game":
      handleNewGameAction(action, {
        resetGame() {
          game = null;
          setupError = "";
        },
        showSetup: renderSetup
      });
      return;
    default: return;
  }
  if (didChange && ["buy", "build", "unmortgage", "accept-sale"].includes(action)) {
    soundEffects.playCoins();
  }
  if (didChange) {
    log.unshift(game.message);
    log = log.slice(0, 8);
  }
  render();
}

function handlePropertyTradeOffer(event) {
  event.preventDefault();
  if (isRolling || isMoving || game.pendingTrade) return;
  const form = event.currentTarget;
  const error = form.querySelector("[data-sale-error]");
  const buyerValue = form.elements.buyerId.value;
  if (form.dataset.tradeKind === "sale" && !buyerValue) {
    error.textContent = translate(game.locale, "trade.invalidBuyer");
    return;
  }
  const price = Number(form.elements.price.value);
  if (!Number.isSafeInteger(price) || price <= 0) {
    error.textContent = translate(game.locale, "trade.invalidPrice");
    return;
  }
  const tileIndex = Number(form.dataset.propertyIndex);
  const propose = form.dataset.tradeKind === "purchase" ? proposePropertyPurchase : proposePropertySale;
  if (!propose(game, tileIndex, Number(buyerValue), price)) {
    error.textContent = translate(game.locale, "trade.cannotOffer");
    return;
  }
  selectedProperty = null;
  recordGameMessage();
  render();
}

function closeProperty() {
  const closedTile = selectedProperty;
  selectedProperty = null;
  render();
  if (closedTile !== null) {
    app.querySelector(`[data-property="${closedTile}"]`)?.focus({ preventScroll: true });
  }
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && selectedProperty !== null && window.matchMedia("(max-width: 700px)").matches) {
    closeProperty();
  }
});

function animateDiceRoll() {
  if (isRolling) return;
  soundEffects.playDiceRoll();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    rollDice(game);
    recordGameMessage();
    render();
    return;
  }

  isRolling = true;
  render();
  const dice = app.querySelector(".dice");
  const faces = dice.querySelectorAll("span");
  dice.classList.add("is-rolling");
  const shuffleTimer = window.setInterval(() => {
    faces.forEach(face => {
      face.textContent = String(Math.floor(Math.random() * 6) + 1);
    });
  }, 75);

  window.setTimeout(() => {
    window.clearInterval(shuffleTimer);
    const player = activePlayer(game);
    const startPosition = player.position;
    const wasInJail = player.inJail;
    rollDice(game);
    isRolling = false;
    recordGameMessage();
    const finalPosition = player.position;
    const didNotMoveInJail = wasInJail && player.inJail && finalPosition === startPosition;
    if (didNotMoveInJail || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      visualMovement = null;
      render();
      return;
    }
    animatePlayerMovement(player.id, startPosition, game.lastRollTotal, finalPosition);
  }, 850);
}

function animatePlayerMovement(playerId, startPosition, rollTotal, finalPosition) {
  const player = game.players[playerId];
  const { path, rolledDestination, hasSpecialMove } = createMovementPath(startPosition, rollTotal, finalPosition);

  isMoving = true;
  visualMovement = { playerId, position: startPosition };
  render();
  const board = app.querySelector(".board");
  const piece = board.querySelector(".moving-token");
  const pointFor = index => {
    const tile = board.querySelector(`[data-property="${index}"]`);
    return tokenCenterInBoard(tile, board);
  };
  const destinationPiece = board.querySelector(`[data-property="${finalPosition}"] [data-player-id="${playerId}"]`);
  if (destinationPiece) destinationPiece.style.visibility = "hidden";

  const steps = path.length - 1;
  let playedSteps = 1;
  let stepTimer = null;
  if (steps > 0) {
    soundEffects.playStep();
    if (steps > 1) {
      stepTimer = window.setInterval(() => {
        soundEffects.playStep();
        playedSteps++;
        if (playedSteps >= steps) window.clearInterval(stepTimer);
      }, 125);
    }
  }
  const clearStepTimer = () => {
    if (stepTimer !== null) window.clearInterval(stepTimer);
  };
  animateTokenAlongPath(piece, path, pointFor, {
    stepDuration: 125,
    extraDuration: hasSpecialMove ? 180 : 0
  }).then(() => {
    clearStepTimer();
    finishPlayerMovement(destinationPiece);
    render();
  }, error => {
    clearStepTimer();
    finishPlayerMovement(destinationPiece);
    game.message = translate(game.locale, "game.animationError");
    recordGameMessage();
    console.error("Player movement animation failed:", error);
    render();
  });
}

function finishPlayerMovement(destinationPiece) {
  if (destinationPiece) destinationPiece.style.visibility = "";
  visualMovement = null;
  isMoving = false;
}

function renderSoundToggle() {
  const labelKey = soundEffects.supported ? soundEnabled ? "sound.enabled" : "sound.disabled" : "sound.unavailable";
  return `<button class="quiet-button sound-toggle" type="button" data-sound-toggle aria-pressed="${soundEnabled}" ${soundEffects.supported ? "" : "disabled"}>${escapeHtml(translate(locale, labelKey))}</button>`;
}

function bindSoundToggle() {
  app.querySelectorAll("[data-sound-toggle]").forEach(button => button.addEventListener("click", () => {
    soundEnabled = soundEffects.setEnabled(!soundEnabled);
    app.querySelectorAll("[data-sound-toggle]").forEach(toggle => {
      toggle.setAttribute("aria-pressed", String(soundEnabled));
      toggle.textContent = translate(game?.locale ?? locale, soundEnabled ? "sound.enabled" : "sound.disabled");
    });
  }));
}

function recordGameMessage() {
  log.unshift(game.message);
  log = log.slice(0, 8);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

renderSetup();
