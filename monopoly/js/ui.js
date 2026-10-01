import { board, groups } from "./data.js";
import { activePlayer, groupComplete, ownedTiles, tileOwner, tileRent } from "./game.js";
import {
  formatHouseCount, formatMoney, formatPropertiesCount, getGroupName, getTileName, translate
} from "./i18n.js";

const positions = new Map();
positions.set(0, { row: 12, col: 12, corner: true });
for (let index = 1; index <= 9; index++) positions.set(index, { row: 13, col: 12 - index });
positions.set(10, { row: 12, col: 1, corner: true });
for (let index = 11; index <= 19; index++) positions.set(index, { row: 22 - index, col: 1 });
positions.set(20, { row: 1, col: 1, corner: true });
for (let index = 21; index <= 29; index++) positions.set(index, { row: 1, col: index - 18 });
positions.set(30, { row: 1, col: 12, corner: true });
for (let index = 31; index <= 39; index++) positions.set(index, { row: index - 28, col: 13 });

export function renderGame(game, log, {
  selectedProperty = null,
  isRolling = false,
  isMoving = false,
  visualMovement = null,
  soundEnabled = true,
  soundSupported = true
} = {}) {
  if (game.phase === "finished") return renderFinalScreen(game, soundEnabled, soundSupported);

  const player = activePlayer(game);
  const tile = game.pendingTile === null ? null : board[game.pendingTile];
  return `
    <div class="game-shell">
      <header class="game-header">
        <a class="brand compact-brand" href="#" aria-label="${escapeHtml(translate(game.locale, "game.title"))}">
          <span class="brand-mark" aria-hidden="true">♜</span>
          <span><span class="eyebrow">${escapeHtml(translate(game.locale, "game.brand"))}</span><strong>${escapeHtml(translate(game.locale, "game.title"))}</strong></span>
        </a>
        <div class="game-header-actions">
          ${renderSoundToggle(game.locale, soundEnabled, soundSupported)}
          <button class="quiet-button" data-action="new-game" ${isRolling || isMoving ? "disabled" : ""}>${escapeHtml(translate(game.locale, "game.new"))}</button>
        </div>
      </header>
      <div class="game-layout">
        <section class="board-wrap" aria-label="${escapeHtml(translate(game.locale, "game.boardLabel"))}">
          <div class="board" role="grid" aria-label="${escapeHtml(translate(game.locale, "game.boardAria"))}">
            ${board.map((cell, index) => renderTile(game, cell, index)).join("")}
            ${renderMovingToken(game, visualMovement)}
            <div class="board-center">
              <p class="eyebrow">${escapeHtml(translate(game.locale, "game.centerEyebrow"))}</p>
              <h1>${escapeHtml(translate(game.locale, "game.title"))}</h1>
              <div class="dice${isRolling ? " is-rolling" : ""}" aria-label="${escapeHtml(isRolling ? translate(game.locale, "game.rolling") : translate(game.locale, "game.diceResult", { first: game.dice[0], second: game.dice[1] }))}">${game.dice.map(value => `<span>${value || "⚄"}</span>`).join("")}</div>
              <p class="board-message">${escapeHtml(game.message)}</p>
              <p class="board-turn"><span class="player-dot" style="--player-color:${player.color}"></span>${escapeHtml(translate(game.locale, "game.playerTurn", { name: player.name }))}</p>
            </div>
          </div>
        </section>
        <aside class="sidebar">
          <section class="turn-card">
            <div class="section-heading"><div><p class="eyebrow">${escapeHtml(translate(game.locale, "game.currentTurn"))}</p><h2>${escapeHtml(player.name)}</h2></div><span class="player-token" style="--player-color:${player.color}"></span></div>
            <p class="money-line">${escapeHtml(translate(game.locale, "game.treasury"))} <strong>${formatMoney(game.locale, player.money)}</strong></p>
            ${player.inJail ? `<p class="jail-note">${escapeHtml(translate(game.locale, "game.jailTurn", { turn: player.jailTurns + 1 }))}</p>` : ""}
            ${renderControls(game, tile, isRolling || isMoving)}
          </section>
          <section class="players-card">
            <div class="section-heading"><h2>${escapeHtml(translate(game.locale, "game.players"))}</h2><span class="eyebrow">${escapeHtml(translate(game.locale, "game.playersCount", { count: game.players.filter(p => !p.bankrupt).length }))}</span></div>
            <div class="players-list">${game.players.map((p, index) => renderPlayer(game, p, index)).join("")}</div>
          </section>
          ${selectedProperty !== null ? renderPropertyDetails(game, selectedProperty) : ""}
          <section class="log-card">
            <h2>${escapeHtml(translate(game.locale, "game.chronicle"))}</h2>
            <ol>${log.map(entry => `<li>${escapeHtml(entry)}</li>`).join("")}</ol>
          </section>
        </aside>
      </div>
      ${selectedProperty !== null ? renderPropertyModal(game, selectedProperty) : ""}
      ${game.pendingTrade ? renderPropertyTradeModal(game) : ""}
      <footer class="game-footer">${escapeHtml(translate(game.locale, "game.footer"))}</footer>
    </div>`;
}

function renderFinalScreen(game, soundEnabled, soundSupported) {
  const winner = game.players[game.winner];
  const ranking = game.players
    .filter(player => player.id !== winner.id)
    .sort((first, second) => second.money - first.money);
  return `
    <main class="final-screen">
      <section class="final-content" aria-labelledby="final-title">
        <p class="eyebrow">${escapeHtml(translate(game.locale, "game.final"))}</p>
        <h1 id="final-title">${escapeHtml(translate(game.locale, "game.winner", { name: winner.name }))}</h1>
        <p class="final-summary">${escapeHtml(translate(game.locale, "game.finalTreasury"))} <strong>${formatMoney(game.locale, winner.money)}</strong></p>
        <section class="final-results" aria-labelledby="results-title">
          <h2 id="results-title">${escapeHtml(translate(game.locale, "game.otherResults"))}</h2>
          <ol>${ranking.map((player, index) => `
            <li class="${player.bankrupt ? "is-bankrupt" : ""}">
              <span class="final-rank">${index + 2}.</span>
              <span class="player-dot" style="--player-color:${player.color}"></span>
              <span class="final-player-name">${escapeHtml(player.name)}${player.bankrupt ? escapeHtml(translate(game.locale, "game.eliminated")) : ""}</span>
              <span class="final-assets">${escapeHtml(formatPropertiesCount(game.locale, ownedTiles(game, player.id).length))}</span>
              <strong>${formatMoney(game.locale, player.money)}</strong>
            </li>`).join("")}</ol>
        </section>
        <div class="final-actions">
          ${renderSoundToggle(game.locale, soundEnabled, soundSupported)}
          <button class="primary-button final-new-game" data-action="new-game">${escapeHtml(translate(game.locale, "game.newFromResult"))}</button>
        </div>
      </section>
    </main>`;
}

function renderSoundToggle(locale, enabled, supported) {
  const labelKey = supported ? enabled ? "sound.enabled" : "sound.disabled" : "sound.unavailable";
  return `<button class="quiet-button sound-toggle" type="button" data-sound-toggle aria-pressed="${supported && enabled}" ${supported ? "" : "disabled"}>${escapeHtml(translate(locale, labelKey))}</button>`;
}

function renderTile(game, cell, index) {
  const { row, col } = positions.get(index);
  const land = game.properties[index];
  const owner = tileOwner(game, index);
  const groupColor = cell.group ? groups[cell.group].color : "transparent";
  const playersHere = game.players.filter(p => !p.bankrupt && p.position === index);
  const corner = [0, 10, 20, 30].includes(index);
  const tokenPosition = corner ? "center" : index < 10 ? "bottom" : index < 20 ? "left" : index < 30 ? "top" : "right";
  const classes = ["tile", `tile-${cell.type}`, corner ? "tile-corner" : "", `tile-tokens-${tokenPosition}`, game.pendingTile === index ? "tile-pending" : ""].filter(Boolean).join(" ");
  const gridPlacement = corner
    ? `grid-row:${row} / span 2;grid-column:${col} / span 2;`
    : `grid-row:${row};grid-column:${col};`;
  const locale = game.locale;
  const labelKey = {
    start: "tile.start.short",
    goToJail: "tile.goToJail.short",
    jail: "tile.jail.short",
    free: "tile.free.short",
    chest: "tile.chest.short",
    chance: "tile.chance.short",
    tax: "tile.tax.short",
    rail: "tile.rail.short"
  }[cell.type];
  const label = labelKey
    ? translate(locale, labelKey)
    : cell.type === "utility"
      ? translate(locale, cell.translationKey === "forge" ? "tile.utility.forge" : "tile.utility.mill")
      : getTileName(locale, cell.translationKey);
  const ownerTitle = owner
    ? translate(locale, "tile.owner", { name: owner.name })
    : translate(locale, "tile.unowned");
  const houses = land.houses
    ? `<span class="house-mark" aria-label="${escapeHtml(land.houses === 5 ? translate(locale, "tile.castle") : translate(locale, "tile.houses", { count: land.houses }))}">${land.houses === 5 ? "♜" : "⌂".repeat(land.houses)}</span>`
    : "";
  const playerTokens = playersHere.map(p => `<span class="mini-token" data-player-id="${p.id}" style="--player-color:${p.color}" title="${escapeHtml(p.name)}" aria-label="${escapeHtml(p.name)}"></span>`).join("");
  const tileContents = `<span class="tile-band" style="--group-color:${groupColor}"></span>
    <span class="tile-type">${escapeHtml(translate(locale, `tileType.${cell.type}`))}</span>
    <span class="tile-name">${escapeHtml(label)}</span>
    ${cell.price ? `<span class="tile-price">${cell.price}</span>` : ""}
    ${land.mortgaged ? `<span class="mortgage-mark">${escapeHtml(translate(locale, "tile.mortgage"))}</span>` : ""}
    ${houses}
    <span class="tile-owner" style="--owner-color:${owner?.color || "transparent"}" title="${escapeHtml(ownerTitle)}"></span>
    <span class="tile-tokens">${playerTokens}</span>`;
  return `<button class="${classes}" aria-label="${escapeHtml(getTileName(locale, cell.translationKey))}. ${escapeHtml(ownerTitle)}. ${cell.type === "property" && owner ? escapeHtml(translate(locale, "tile.rent", { amount: tileRent(game, index) })) : ""}" style="${gridPlacement}" data-property="${index}">
    ${cell.type === "jail" ? `<span class="jail-visit">${escapeHtml(translate(locale, "tile.jailVisitor"))}</span>` : ""}
    ${tileContents}
  </button>`;
}

function renderPropertyTradeModal(game) {
  const offer = game.pendingTrade;
  const seller = game.players[offer.sellerId];
  const buyer = game.players[offer.buyerId];
  const tile = board[offer.tile];
  const canAfford = buyer.money >= offer.price;
  const isPurchaseOffer = offer.kind === "purchase";
  return `<div class="trade-modal" data-modal-backdrop>
    <section class="trade-dialog" role="dialog" aria-modal="true" aria-labelledby="trade-title">
      <p class="eyebrow">${escapeHtml(translate(game.locale, isPurchaseOffer ? "trade.purchaseTitle" : "trade.title"))}</p>
      <h2 id="trade-title">${escapeHtml(translate(game.locale, isPurchaseOffer ? "trade.purchaseDescription" : "trade.description", {
        seller: seller.name,
        buyer: buyer.name,
        tile: getTileName(game.locale, tile.translationKey),
        price: formatMoney(game.locale, offer.price).replace(/\s(?=◈$)/, "\u00a0")
      }))}</h2>
      ${!canAfford ? `<p class="error" role="status">${escapeHtml(translate(game.locale, "trade.insufficientFunds"))}</p>` : ""}
      <div class="button-row trade-actions">
        <button class="primary-button" data-action="accept-sale" ${canAfford ? "" : "disabled"}>${escapeHtml(translate(game.locale, "trade.accept"))}</button>
        <button class="secondary-button" data-action="reject-sale">${escapeHtml(translate(game.locale, "trade.reject"))}</button>
      </div>
    </section>
  </div>`;
}

function renderMovingToken(game, movement) {
  if (!movement) return "";
  const color = game.players[movement.playerId].color;
  return `<span class="mini-token moving-token" aria-hidden="true" style="--player-color:${color}" data-visual-position="${movement.position}"></span>`;
}

function renderControls(game, tile, isRolling) {
  const player = activePlayer(game);
  let controls = "";
  let hint = "";
  if (isRolling) {
    controls = `<button class="primary-button roll-button" disabled aria-live="polite">${escapeHtml(translate(game.locale, "control.rolling"))}</button>`;
  }
  else if (game.phase === "finished") {
    controls = `<p class="winner-banner">${escapeHtml(translate(game.locale, "control.winner", { name: game.players[game.winner].name }))}</p><button class="primary-button" data-action="new-game">${escapeHtml(translate(game.locale, "control.playAgain"))}</button>`;
  }
  else if (game.phase === "buy" && tile) {
    controls = `<div class="button-row"><button class="primary-button" data-action="buy" ${player.money < tile.price ? "disabled" : ""}>${escapeHtml(translate(game.locale, "control.buy"))}</button><button class="secondary-button" data-action="skip">${escapeHtml(translate(game.locale, "control.decline"))}</button></div>`;
    hint = translate(game.locale, "control.purchaseHint", { name: getTileName(game.locale, tile.translationKey), price: tile.price });
  }
  else if (player.inJail) {
    controls = `<div class="button-stack">
      ${player.getOutOfJail ? `<button class="secondary-button" data-action="jail-card">${escapeHtml(translate(game.locale, "control.jailCard"))}</button>` : ""}
      ${player.money >= 50 ? `<button class="secondary-button" data-action="jail-fine">${escapeHtml(translate(game.locale, "control.jailFine"))}</button>` : ""}
      <button class="primary-button" data-action="roll">${escapeHtml(translate(game.locale, "control.roll"))}</button>
    </div>`;
  }
  else if (game.phase === "roll") {
    controls = `<button class="primary-button roll-button" data-action="roll">${escapeHtml(translate(game.locale, "control.roll"))}</button>`;
    hint = translate(game.locale, "control.doubleHint");
  }
  else if (game.phase === "end") controls = `<button class="primary-button" data-action="end">${escapeHtml(translate(game.locale, "control.endTurn"))}</button>`;
  return `<div class="turn-controls">${controls}</div><p class="turn-feedback">${hint ? escapeHtml(hint) : "&nbsp;"}</p>`;
}

function renderPlayer(game, player, index) {
  const assets = ownedTiles(game, player.id).length;
  return `<div class="player-row ${game.currentPlayer === index && game.phase !== "finished" ? "is-active" : ""} ${player.bankrupt ? "is-bankrupt" : ""}">
    <span class="player-dot" style="--player-color:${player.color}"></span>
    <span class="player-name">${escapeHtml(player.name)}${player.inJail ? ` · ${escapeHtml(translate(game.locale, "game.inJailSuffix"))}` : ""}</span>
    <span class="player-assets">${escapeHtml(formatPropertiesCount(game.locale, assets))}</span>
    <strong>${formatMoney(game.locale, player.money)}</strong>
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
  const tradeKind = owner?.id === player.id ? "sale" : "purchase";
  const canOfferTrade = Boolean(owner && !owner.bankrupt && !land.mortgaged && !player.bankrupt);
  return `<section class="property-card">
    <div class="section-heading"><h2>${escapeHtml(getTileName(game.locale, cell.translationKey))}</h2><span class="property-swatch" style="--group-color:${cell.group ? groups[cell.group].color : "#ad925f"}"></span></div>
    ${cell.group ? `<p class="property-group">${escapeHtml(getGroupName(game.locale, cell.group))}</p>` : ""}
    <p>${owner ? `${escapeHtml(translate(game.locale, "property.owner"))} <strong>${escapeHtml(owner.name)}</strong>` : `${escapeHtml(translate(game.locale, "property.price"))} <strong>${formatMoney(game.locale, cell.price)}</strong>`}${land.mortgaged ? escapeHtml(translate(game.locale, "property.mortgaged")) : ""}</p>
    ${cell.type === "property" ? `<p>${escapeHtml(translate(game.locale, "property.rentLevels"))}</p>
      <ul class="rent-list">${cell.rents.map((rent, level) => `<li><span>${escapeHtml(level === 0 ? translate(game.locale, "property.noHouses") : level === 5 ? translate(game.locale, "property.castle") : formatHouseCount(game.locale, level))}</span><strong>${formatMoney(game.locale, rent)}</strong></li>`).join("")}</ul>
      <p>${escapeHtml(translate(game.locale, "property.monopoly", { cost: formatMoney(game.locale, cell.buildCost) }))}</p>` : `<p>${escapeHtml(translate(game.locale, cell.type === "rail" ? "property.railRent" : "property.utilityRent"))}</p>`}
    ${land.houses ? `<p>${escapeHtml(translate(game.locale, "property.improvements"))} ${land.houses === 5 ? escapeHtml(translate(game.locale, "property.castle").toLowerCase()) : escapeHtml(translate(game.locale, "property.houses", { count: land.houses }))}</p>` : ""}
    <div class="button-row compact-actions">
      ${canBuild ? `<button class="secondary-button" data-action="build" ${player.money < cell.buildCost ? "disabled" : ""}>${escapeHtml(translate(game.locale, "property.build", { cost: cell.buildCost }))}</button>` : ""}
      ${land.owner === player.id && land.houses === 0 && !land.mortgaged ? `<button class="secondary-button" data-action="mortgage">${escapeHtml(translate(game.locale, "property.mortgageAction", { amount: Math.floor(cell.price / 2) }))}</button>` : ""}
      ${land.owner === player.id && land.mortgaged ? `<button class="secondary-button" data-action="unmortgage" ${player.money < Math.ceil(cell.price / 2 * 1.1) ? "disabled" : ""}>${escapeHtml(translate(game.locale, "property.unmortgageAction", { amount: Math.ceil(cell.price / 2 * 1.1) }))}</button>` : ""}
      ${canOfferTrade ? `<button class="secondary-button" type="button" data-trade-toggle="${tradeKind}" data-property-index="${index}">${escapeHtml(translate(game.locale, tradeKind === "sale" ? "property.offerSale" : "property.offerPurchase"))}</button>` : ""}
    </div>
    ${canOfferTrade ? renderPropertyTradeForm(game, index, tradeKind, owner) : ""}
  </section>`;
}

function renderPropertyTradeForm(game, index, kind, owner) {
  const player = activePlayer(game);
  const buyers = kind === "sale"
    ? game.players.filter(candidate => candidate.id !== owner.id && !candidate.bankrupt)
    : [];
  if (kind === "sale" && !buyers.length) return "";
  return `<form class="sale-offer-form" data-property-trade-form="${kind}-${index}" data-property-index="${index}" data-trade-kind="${kind}" hidden novalidate>
    ${kind === "sale" ? `<label>${escapeHtml(translate(game.locale, "trade.buyer"))}
      <select name="buyerId">
        <option value="">${escapeHtml(translate(game.locale, "trade.chooseBuyer"))}</option>
        ${buyers.map(buyer => `<option value="${buyer.id}">${escapeHtml(buyer.name)}</option>`).join("")}
      </select>
    </label>` : `<input type="hidden" name="buyerId" value="${player.id}">`}
    <label>${escapeHtml(translate(game.locale, kind === "sale" ? "trade.price" : "trade.purchasePrice"))}
      <input name="price" type="number" min="1" step="1" inputmode="numeric" aria-required="true">
    </label>
    <p class="error" role="alert" data-sale-error></p>
    <button class="primary-button" type="submit">${escapeHtml(translate(game.locale, kind === "sale" ? "trade.submit" : "trade.purchaseSubmit"))}</button>
  </form>`;
}

function renderPropertyModal(game, index) {
  const cell = board[index];
  if (!cell.price || !["property", "rail", "utility"].includes(cell.type)) return "";
  return `<div class="property-modal" data-modal-backdrop>
    <section class="property-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(translate(game.locale, "tile.propertyDialog", { name: getTileName(game.locale, cell.translationKey) }))}">
      <button class="modal-close" type="button" data-action="close-property" aria-label="${escapeHtml(translate(game.locale, "property.close"))}">×</button>
      ${renderPropertyDetails(game, index)}
    </section>
  </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
