import { board, groups, tileTypeNames } from "./data.js";
import { activePlayer, groupComplete, ownedTiles, tileOwner, tileRent } from "./game.js";

const positions = new Map();
positions.set(0, { row: 12, col: 12, corner: true });
for (let index = 1; index <= 9; index++) positions.set(index, { row: 12, col: 12 - index });
positions.set(10, { row: 12, col: 1, corner: true });
for (let index = 11; index <= 19; index++) positions.set(index, { row: 22 - index, col: 1 });
positions.set(20, { row: 1, col: 1, corner: true });
for (let index = 21; index <= 29; index++) positions.set(index, { row: 1, col: index - 18 });
positions.set(30, { row: 1, col: 12, corner: true });
for (let index = 31; index <= 39; index++) positions.set(index, { row: index - 28, col: 13 });

export function renderGame(game, log, selectedProperty, isRolling = false) {
  const player = activePlayer(game);
  const tile = game.pendingTile === null ? null : board[game.pendingTile];
  return `
    <div class="game-shell">
      <header class="game-header">
        <a class="brand compact-brand" href="#" aria-label="Королевство">
          <span class="brand-mark" aria-hidden="true">♜</span>
          <span><span class="eyebrow">Средневековая монополия</span><strong>Королевство</strong></span>
        </a>
        <button class="quiet-button" data-action="new-game" ${isRolling ? "disabled" : ""}>Новая партия</button>
      </header>
      <div class="game-layout">
        <section class="board-wrap" aria-label="Игровое поле">
          <div class="board" role="grid" aria-label="Игровое поле, 40 клеток">
            ${board.map((cell, index) => renderTile(game, cell, index)).join("")}
            <div class="board-center">
              <p class="eyebrow">Ход королевства</p>
              <h1>Королевство</h1>
              <div class="dice${isRolling ? " is-rolling" : ""}" aria-label="${isRolling ? "Бросаем кубики" : `Результат броска: ${game.dice.join(" и ")}`}">${game.dice.map(value => `<span>${value || "⚄"}</span>`).join("")}</div>
              <p class="board-message">${escapeHtml(game.message)}</p>
              <p class="board-turn"><span class="player-dot" style="--player-color:${player.color}"></span>Ходит ${escapeHtml(player.name)}</p>
            </div>
          </div>
        </section>
        <aside class="sidebar">
          <section class="turn-card">
            <div class="section-heading"><div><p class="eyebrow">Текущий ход</p><h2>${escapeHtml(player.name)}</h2></div><span class="player-token" style="--player-color:${player.color}"></span></div>
            <p class="money-line">Казна <strong>${formatMoney(player.money)}</strong></p>
            ${player.inJail ? `<p class="jail-note">В подземелье · попытка ${player.jailTurns + 1} из 3</p>` : ""}
            ${renderControls(game, tile, isRolling)}
          </section>
          <section class="players-card">
            <div class="section-heading"><h2>Игроки</h2><span class="eyebrow">${game.players.filter(p => !p.bankrupt).length} в партии</span></div>
            <div class="players-list">${game.players.map((p, index) => renderPlayer(game, p, index)).join("")}</div>
          </section>
          ${selectedProperty !== null ? renderPropertyDetails(game, selectedProperty) : ""}
          <section class="log-card">
            <h2>Летопись</h2>
            <ol>${log.map(entry => `<li>${escapeHtml(entry)}</li>`).join("")}</ol>
          </section>
        </aside>
      </div>
      ${selectedProperty !== null ? renderPropertyModal(game, selectedProperty) : ""}
      <footer class="game-footer">Играйте по очереди на одном устройстве · Все суммы указаны в монетах</footer>
    </div>`;
}

function renderTile(game, cell, index) {
  const { row, col } = positions.get(index);
  const land = game.properties[index];
  const owner = tileOwner(game, index);
  const groupColor = cell.group ? groups[cell.group].color : "transparent";
  const playersHere = game.players.filter(p => !p.bankrupt && p.position === index);
  const corner = [0, 10, 20, 30].includes(index);
  const classes = ["tile", `tile-${cell.type}`, corner ? "tile-corner" : "", game.pendingTile === index ? "tile-pending" : ""].filter(Boolean).join(" ");
  const span = corner ? "grid-row:span 2;grid-column:span 2;" : "";
  let label = cell.name;
  if (cell.type === "property") label = cell.name.split(" ")[0];
  else if (cell.type === "start") label = "Ворота";
  else if (cell.type === "goToJail") label = "Стража";
  else if (cell.type === "jail") label = "Подземелье";
  else if (cell.type === "free") label = "Праздник";
  else if (cell.type === "chest") label = "Корона";
  else if (cell.type === "chance") label = "Судьба";
  else if (cell.type === "tax") label = "Подать";
  else if (cell.type === "rail") label = "Тракт";
  else if (cell.type === "utility") label = cell.name === "Кузница" ? "Кузница" : "Мельница";
  const ownerTitle = owner ? `Владелец: ${owner.name}` : "Свободно";
  const houses = land.houses ? `<span class="house-mark" aria-label="${land.houses === 5 ? "замок" : `домов: ${land.houses}`}">${land.houses === 5 ? "♜" : "⌂".repeat(land.houses)}</span>` : "";
  const playerTokens = playersHere.map(p => `<span class="mini-token" style="--player-color:${p.color}" title="${escapeHtml(p.name)}" aria-label="${escapeHtml(p.name)}"></span>`).join("");
  const tileContents = `<span class="tile-band" style="--group-color:${groupColor}"></span>
    <span class="tile-type">${tileTypeNames[cell.type]}</span>
    <span class="tile-name">${escapeHtml(label)}</span>
    ${cell.price ? `<span class="tile-price">${cell.price}</span>` : ""}
    ${land.mortgaged ? `<span class="mortgage-mark">Залог</span>` : ""}
    ${houses}
    <span class="tile-owner" style="--owner-color:${owner?.color || "transparent"}" title="${ownerTitle}"></span>
    <span class="tile-tokens">${playerTokens}</span>`;
  return `<button class="${classes}" aria-label="${escapeHtml(cell.name)}. ${ownerTitle}. ${cell.type === "property" && owner ? `Рента ${tileRent(game, index)} монет.` : ""}" style="grid-row:${row};grid-column:${col};${span}" data-property="${index}">
    ${index === 10 ? `<span class="jail-visit">В гостях</span>` : ""}
    ${tileContents}
  </button>`;
}

function renderControls(game, tile, isRolling) {
  const player = activePlayer(game);
  if (isRolling) return `<button class="primary-button roll-button" disabled aria-live="polite">Кубики катятся…</button>`;
  if (game.phase === "finished") {
    return `<p class="winner-banner">Победитель: ${escapeHtml(game.players[game.winner].name)}!</p><button class="primary-button" data-action="new-game">Сыграть ещё раз</button>`;
  }
  if (game.phase === "buy" && tile) {
    return `<p class="action-hint">Купить «${escapeHtml(tile.name)}» за ${tile.price} монет?</p>
      <div class="button-row"><button class="primary-button" data-action="buy" ${player.money < tile.price ? "disabled" : ""}>Купить</button><button class="secondary-button" data-action="skip">Отказаться</button></div>`;
  }
  if (player.inJail) {
    return `<div class="button-stack">
      ${player.getOutOfJail ? `<button class="secondary-button" data-action="jail-card">Использовать карту освобождения</button>` : ""}
      ${player.money >= 50 ? `<button class="secondary-button" data-action="jail-fine">Заплатить 50 и выйти</button>` : ""}
      <button class="primary-button" data-action="roll">Бросить кубики</button>
    </div>`;
  }
  if (game.phase === "roll") return `<button class="primary-button roll-button" data-action="roll">Бросить кубики</button><p class="subtle">Выпадет дубль — получите дополнительный ход.</p>`;
  if (game.phase === "end") return `<button class="primary-button" data-action="end">Передать ход</button>`;
  return "";
}

function renderPlayer(game, player, index) {
  const assets = ownedTiles(game, player.id).length;
  return `<div class="player-row ${game.currentPlayer === index && game.phase !== "finished" ? "is-active" : ""} ${player.bankrupt ? "is-bankrupt" : ""}">
    <span class="player-dot" style="--player-color:${player.color}"></span>
    <span class="player-name">${escapeHtml(player.name)}${player.inJail ? " · в подземелье" : ""}</span>
    <span class="player-assets">${assets} влад.</span>
    <strong>${formatMoney(player.money)}</strong>
  </div>`;
}

function renderPropertyDetails(game, index) {
  const cell = board[index];
  const land = game.properties[index];
  const owner = tileOwner(game, index);
  const player = activePlayer(game);
  if (!cell.price || !["property", "rail", "utility"].includes(cell.type)) return "";
  const canBuild = cell.group && land.owner === player.id && groupComplete(game, player.id, cell.group) &&
    !land.mortgaged && land.houses < 5 && !board.some((tile, i) => tile.group === cell.group && game.properties[i].mortgaged) &&
    land.houses <= Math.min(...board.map((tile, i) => tile.group === cell.group ? game.properties[i].houses : Infinity));
  return `<section class="property-card">
    <div class="section-heading"><h2>${escapeHtml(cell.name)}</h2><span class="property-swatch" style="--group-color:${cell.group ? groups[cell.group].color : "#ad925f"}"></span></div>
    ${cell.group ? `<p class="property-group">${escapeHtml(groups[cell.group].label)}</p>` : ""}
    <p>${owner ? `Владелец: <strong>${escapeHtml(owner.name)}</strong>` : `Цена: <strong>${formatMoney(cell.price)}</strong>`}${land.mortgaged ? " · заложено" : ""}</p>
    ${cell.type === "property" ? `<p>Рента по уровню владения:</p>
      <ul class="rent-list">${cell.rents.map((rent, level) => `<li><span>${level === 0 ? "Без домов" : level === 5 ? "Замок" : `${level} ${level === 1 ? "дом" : "дома"}`}</span><strong>${formatMoney(rent)}</strong></li>`).join("")}</ul>
      <p>Полный набор удваивает базовую ренту. Постройка дома: ${formatMoney(cell.buildCost)}.</p>` : `<p>${cell.type === "rail" ? "Рента зависит от числа трактов у владельца: 25, 50, 100 или 200 монет." : "Рента равна результату броска ×4, либо ×10 при владении обеими мельницей и кузницей."}</p>`}
    ${land.houses ? `<p>Улучшения: ${land.houses === 5 ? "замок" : `${land.houses} домов`}</p>` : ""}
    <div class="button-row compact-actions">
      ${canBuild ? `<button class="secondary-button" data-action="build" ${player.money < cell.buildCost ? "disabled" : ""}>Построить · ${cell.buildCost}</button>` : ""}
      ${land.owner === player.id && land.houses === 0 && !land.mortgaged ? `<button class="secondary-button" data-action="mortgage">Заложить · ${Math.floor(cell.price / 2)}</button>` : ""}
      ${land.owner === player.id && land.mortgaged ? `<button class="secondary-button" data-action="unmortgage" ${player.money < Math.ceil(cell.price / 2 * 1.1) ? "disabled" : ""}>Выкупить залог · ${Math.ceil(cell.price / 2 * 1.1)}</button>` : ""}
    </div>
  </section>`;
}

function renderPropertyModal(game, index) {
  const cell = board[index];
  if (!cell.price || !["property", "rail", "utility"].includes(cell.type)) return "";
  return `<div class="property-modal" data-modal-backdrop>
    <section class="property-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(cell.name)}">
      <button class="modal-close" type="button" data-action="close-property" aria-label="Закрыть карточку">×</button>
      ${renderPropertyDetails(game, index)}
    </section>
  </div>`;
}

function formatMoney(amount) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ◈`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
