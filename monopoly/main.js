import {
  activePlayer, buildHouse, buyProperty, createGame, endTurn, mortgageProperty,
  payJailFine, rollDice, skipPurchase, unmortgageProperty, useJailCard
} from "./js/game.js";
import { renderGame } from "./js/ui.js";

const app = document.querySelector("#app");
let game = null;
let selectedProperty = null;
let log = [];
let setupError = "";
let isRolling = false;

function startGame(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const names = [...form.querySelectorAll("[name=player]")].map(input => input.value).filter(Boolean);
  try {
    game = createGame(names);
    selectedProperty = null;
    log = ["Добро пожаловать в королевство!"];
    isRolling = false;
    render();
  } catch (error) {
    setupError = error.message;
    renderSetup();
  }
}

function renderSetup() {
  app.innerHTML = `
    <section class="setup-screen">
      <header class="brand">
        <span class="brand-mark" aria-hidden="true">♜</span>
        <div><p class="eyebrow">Настольная игра · 2–4 игрока</p><h1>Королевство</h1></div>
      </header>
      <p class="intro">Покупайте земли, стройте владения и станьте самым состоятельным правителем.</p>
      <form id="setup-form" class="setup-card">
        <h2>Кто играет?</h2>
        <label>Игрок 1 <input name="player" maxlength="18" value="Артур" autocomplete="off" required></label>
        <label>Игрок 2 <input name="player" maxlength="18" value="Изольда" autocomplete="off" required></label>
        <label>Игрок 3 <input name="player" maxlength="18" placeholder="Имя третьего игрока"></label>
        <label>Игрок 4 <input name="player" maxlength="18" placeholder="Имя четвёртого игрока"></label>
        <p class="error" role="alert">${escapeHtml(setupError)}</p>
        <button class="primary-button" type="submit">Начать партию</button>
        <p class="setup-note">Локальная игра на одном устройстве. Передавайте ход друг другу.</p>
      </form>
      <p class="compatibility-note">Работает в современных браузерах на компьютере, планшете и телефоне.</p>
    </section>`;
  app.querySelector("#setup-form").addEventListener("submit", startGame);
}

function render() {
  app.innerHTML = renderGame(game, log, selectedProperty, isRolling);
  app.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", handleAction));
  if (!isRolling) {
    app.querySelectorAll("[data-property]").forEach(button => button.addEventListener("click", () => {
      selectedProperty = Number(button.dataset.property);
      render();
      if (window.matchMedia("(max-width: 700px)").matches) {
        app.querySelector(".property-modal .modal-close")?.focus({ preventScroll: true });
      }
    }));
  }
  app.querySelector(".property-modal")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeProperty();
  });
}

function handleAction(event) {
  if (isRolling) return;
  const action = event.currentTarget.dataset.action;
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
    case "close-property":
      closeProperty();
      return;
    case "new-game":
      game = null;
      setupError = "";
      renderSetup();
      return;
    default: return;
  }
  if (didChange) {
    log.unshift(game.message);
    log = log.slice(0, 8);
  }
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
    rollDice(game);
    isRolling = false;
    recordGameMessage();
    render();
  }, 850);
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
