import { board, cards, groups } from "./data.js";
import { getCardText, getTileName, resolveLocale, translate } from "./i18n.js";

const startingMoney = 1500;
const startBonus = 200;

export function createGame(playerNames, { random = Math.random, locale = "ru" } = {}) {
  const gameLocale = resolveLocale(locale);
  if (playerNames.length < 2 || playerNames.length > 4) {
    throw new Error(translate(gameLocale, "game.playerCount"));
  }
  if (typeof random !== "function") throw new TypeError(translate(gameLocale, "game.rngFunction"));
  const names = playerNames.map(name => name.trim());
  if (names.some(name => !name)) throw new Error(translate(gameLocale, "game.emptyPlayerName"));

  return {
    locale: gameLocale,
    players: names.map((name, index) => ({
      id: index,
      name,
      color: ["#b84b43", "#387c9a", "#d19a32", "#6c5794"][index],
      money: startingMoney,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJail: false,
      jailCardDeck: null,
      bankrupt: false
    })),
    properties: board.map(() => ({ owner: null, houses: 0, mortgaged: false })),
    currentPlayer: 0,
    phase: "roll",
    pendingTrade: null,
    dice: [0, 0],
    lastRollTotal: 0,
    doublesCount: 0,
    message: translate(gameLocale, "game.startMessage"),
    pendingTile: null,
    winner: null,
    cardDecks: {
      chance: shuffled(cards.chance, random),
      chest: shuffled(cards.chest, random)
    },
    cardIndices: { chance: 0, chest: 0 }
  };
}

function shuffled(source, random) {
  const deck = [...source];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function activePlayer(game) {
  return game.players[game.currentPlayer];
}

export function rollDice(game, random = Math.random) {
  if (game.phase !== "roll") return;
  const player = activePlayer(game);
  const first = die(random);
  const second = die(random);
  game.dice = [first, second];
  game.lastRollTotal = first + second;
  const isDouble = first === second;
  if (!player.inJail && isDouble) {
    game.doublesCount++;
    if (game.doublesCount >= 3) {
      sendToJail(game, player);
      return;
    }
  } else if (!player.inJail) {
    game.doublesCount = 0;
  }

  if (player.inJail) {
    if (isDouble) {
      player.inJail = false;
      player.jailTurns = 0;
      movePlayer(game, player, game.lastRollTotal, false);
      resolveLanding(game, player, false);
      return;
    }
    player.jailTurns++;
    if (player.jailTurns >= 3) {
      player.money -= 50;
      player.inJail = false;
      player.jailTurns = 0;
      movePlayer(game, player, game.lastRollTotal, false);
      game.message = translate(game.locale, "game.rollJailFine", { name: player.name });
      resolveLanding(game, player, false);
    } else {
      game.message = translate(game.locale, "game.jailRemain", { name: player.name, first, second });
      finishAction(game);
    }
    return;
  }

  movePlayer(game, player, game.lastRollTotal, true);
  resolveLanding(game, player, isDouble);
}

function die(random) {
  return Math.floor(random() * 6) + 1;
}

function movePlayer(game, player, steps, collectStart) {
  const oldPosition = player.position;
  player.position = (player.position + steps) % board.length;
  if (collectStart && oldPosition + steps >= board.length) {
    player.money += startBonus;
    game.message = translate(game.locale, "game.collectStart", { name: player.name, amount: startBonus });
  }
}

function resolveLanding(game, player, isDouble) {
  const index = player.position;
  const tile = board[index];
  const placeMessage = translate(game.locale, "game.arrive", { name: player.name, tile: getTileName(game.locale, tile.translationKey) });
  game.pendingTile = null;

  switch (tile.type) {
    case "property":
    case "rail":
    case "utility":
      resolvePurchaseOrRent(game, player, index, tile);
      break;
    case "tax":
      player.money -= tile.amount;
      game.message = translate(game.locale, "game.tax", { place: placeMessage, amount: tile.amount });
      finishAction(game);
      break;
    case "chance":
    case "chest":
      resolveCardLanding(game, player, tile, placeMessage, isDouble);
      break;
    case "goToJail":
      sendToJail(game, player);
      break;
    case "jail":
      game.message = translate(game.locale, "game.jailVisit", { place: placeMessage });
      finishAction(game);
      break;
    case "free":
      game.message = translate(game.locale, "game.free", { place: placeMessage });
      finishAction(game);
      break;
    default:
      game.message = placeMessage;
      finishAction(game);
  }
  grantDoubleRoll(game, player, isDouble);
}

function resolvePurchaseOrRent(game, player, index, tile) {
  const land = game.properties[index];
  if (land.owner === null) {
    game.pendingTile = index;
    game.phase = "buy";
    game.message = translate(game.locale, "game.buyAvailable", { tile: getTileName(game.locale, tile.translationKey), price: tile.price });
    return;
  }
  if (land.owner === player.id || land.mortgaged) {
    game.message = land.mortgaged
      ? translate(game.locale, "game.mortgagedRent", { tile: getTileName(game.locale, tile.translationKey) })
      : translate(game.locale, "game.ownProperty", { tile: getTileName(game.locale, tile.translationKey) });
    finishAction(game);
    return;
  }

  const owner = game.players[land.owner];
  let rent;
  if (tile.type === "utility") {
    const ownedCount = ownedTiles(game, owner.id).filter(i => board[i].type === "utility").length;
    rent = game.lastRollTotal * (ownedCount === 2 ? 10 : 4);
  } else if (tile.type === "rail") {
    const ownedCount = ownedTiles(game, owner.id).filter(i => board[i].type === "rail").length;
    rent = [0, 25, 50, 100, 200][ownedCount];
  } else {
    rent = rentFor(game, index);
  }
  player.money -= rent;
  owner.money += rent;
  game.message = translate(game.locale, "game.rentPaid", { name: player.name, rent, owner: owner.name });
  finishAction(game);
}

function rentFor(game, index) {
  const tile = board[index];
  const land = game.properties[index];
  const owner = land.owner;
  if (land.houses) return tile.rents[land.houses];
  const monopoly = tile.group && groups[tile.group] &&
    ownedTiles(game, owner).filter(i => board[i].group === tile.group).length === groups[tile.group].size;
  return tile.rents[0] * (monopoly ? 2 : 1);
}

function resolveCardLanding(game, player, tile, placeMessage, isDouble) {
  const card = drawCard(game, tile.type, player);
  const cardMessage = `${placeMessage} ${getCardText(game.locale, card)}`;
  const effect = card.effect;
  if (effect.kind === "money") player.money += effect.amount;
  if (effect.kind === "repair") {
    const houses = game.properties.reduce((sum, land) => sum + (land.owner === player.id ? Math.min(land.houses, 4) : 0), 0);
    const hotels = game.properties.reduce((sum, land) => sum + (land.owner === player.id && land.houses === 5 ? 1 : 0), 0);
    player.money -= houses * effect.house + hotels * effect.hotel;
  }
  if (effect.kind === "jail") {
    sendToJail(game, player);
    game.message = `${cardMessage} ${game.message}`;
    return;
  }
  if (effect.kind === "move") {
    const previous = player.position;
    player.position = effect.to;
    if (effect.collectStart && effect.to < previous) player.money += startBonus;
    resolveLanding(game, player, false);
    game.message = `${cardMessage} ${game.message}`;
    return;
  }
  game.message = cardMessage;
  finishAction(game);
  grantDoubleRoll(game, player, isDouble);
}

function drawCard(game, type, player) {
  const deck = game.cardDecks[type];
  const cardIndex = game.cardIndices[type] % deck.length;
  const card = deck[cardIndex];
  if (card.effect.kind === "jailCard") {
    deck.splice(cardIndex, 1);
    game.cardIndices[type] = cardIndex % Math.max(deck.length, 1);
    player.getOutOfJail = true;
    player.jailCardDeck = type;
  } else {
    game.cardIndices[type]++;
  }
  return card;
}

function grantDoubleRoll(game, player, isDouble) {
  if (game.phase === "end" && isDouble && game.doublesCount < 3 && !player.inJail) {
    game.phase = "roll";
    game.message += translate(game.locale, "game.double");
  }
}

export function buyProperty(game) {
  if (game.phase !== "buy" || game.pendingTile === null) return;
  const player = activePlayer(game);
  const tile = board[game.pendingTile];
  if (player.money < tile.price) {
    game.message = translate(game.locale, "game.cannotAfford", { tile: getTileName(game.locale, tile.translationKey) });
    return;
  }
  player.money -= tile.price;
  game.properties[game.pendingTile].owner = player.id;
  game.message = translate(game.locale, "game.bought", { name: player.name, tile: getTileName(game.locale, tile.translationKey) });
  afterLanding(game, player);
}

export function skipPurchase(game) {
  if (game.phase !== "buy") return;
  const player = activePlayer(game);
  game.message = translate(game.locale, "game.declined", { name: player.name });
  afterLanding(game, player);
}

function afterLanding(game, player) {
  game.pendingTile = null;
  finishAction(game);
  grantDoubleRoll(game, player, game.dice[0] === game.dice[1] && !player.inJail);
}

function finishAction(game) {
  const player = activePlayer(game);
  if (player.money < 0) {
    player.bankrupt = true;
    for (const land of game.properties) {
      if (land.owner === player.id) {
        land.owner = null;
        land.houses = 0;
        land.mortgaged = false;
      }
    }
    game.message += translate(game.locale, "game.bankrupt", { name: player.name });
    const remaining = game.players.filter(candidate => !candidate.bankrupt);
    if (remaining.length === 1) {
      game.winner = remaining[0].id;
      game.phase = "finished";
      game.message += translate(game.locale, "game.winnerMessage", { name: remaining[0].name });
      return;
    }
  }
  game.phase = "end";
}

export function endTurn(game) {
  if (game.phase !== "end") return;
  let next = game.currentPlayer;
  do {
    next = (next + 1) % game.players.length;
  } while (game.players[next].bankrupt);
  game.currentPlayer = next;
  game.doublesCount = 0;
  game.phase = "roll";
  game.message = translate(game.locale, "game.nextPlayer", { name: activePlayer(game).name });
}

export function buildHouse(game, index) {
  const player = activePlayer(game);
  const tile = board[index];
  const land = game.properties[index];
  if (!tile.group || land.owner !== player.id || land.mortgaged || land.houses >= 5 || !ownsGroup(game, player.id, tile.group)) return false;
  const groupLands = board.map((item, i) => item.group === tile.group ? i : -1).filter(i => i >= 0);
  if (groupLands.some(i => game.properties[i].mortgaged)) return false;
  const minHouses = Math.min(...groupLands.map(i => game.properties[i].houses));
  if (land.houses > minHouses || player.money < tile.buildCost) return false;
  land.houses++;
  player.money -= tile.buildCost;
  return true;
}

export function mortgageProperty(game, index) {
  const player = activePlayer(game);
  const tile = board[index];
  const land = game.properties[index];
  if (land.owner !== player.id || land.mortgaged || land.houses !== 0) return false;
  const mortgageValue = Math.floor(tile.price / 2);
  land.mortgaged = true;
  player.money += mortgageValue;
  return true;
}

export function unmortgageProperty(game, index) {
  const player = activePlayer(game);
  const tile = board[index];
  const land = game.properties[index];
  const cost = Math.ceil(tile.price / 2 * 1.1);
  if (land.owner !== player.id || !land.mortgaged || player.money < cost) return false;
  land.mortgaged = false;
  player.money -= cost;
  return true;
}

export function proposePropertySale(game, index, buyerId, price) {
  return proposePropertyTrade(game, index, buyerId, price, "sale");
}

export function proposePropertyPurchase(game, index, buyerId, price) {
  return proposePropertyTrade(game, index, buyerId, price, "purchase");
}

function proposePropertyTrade(game, index, buyerId, price, kind) {
  const tile = Number.isInteger(index) ? board[index] : null;
  const land = tile ? game.properties[index] : null;
  const seller = land && land.owner !== null ? game.players[land.owner] : null;
  const buyer = Number.isInteger(buyerId) ? game.players[buyerId] : null;
  if (
    game.phase === "finished" || game.pendingTrade || !seller || seller.bankrupt ||
    !tile || !["property", "rail", "utility"].includes(tile.type) ||
    !buyer || buyer.id === seller.id || buyer.bankrupt || land.mortgaged ||
    !Number.isSafeInteger(price) || price <= 0
  ) return false;

  game.pendingTrade = { kind, tile: index, sellerId: seller.id, buyerId: buyer.id, price };
  game.message = translate(game.locale, kind === "purchase" ? "trade.purchaseOffered" : "trade.offered", {
    seller: seller.name,
    buyer: buyer.name,
    tile: getTileName(game.locale, board[index].translationKey),
    price
  });
  return true;
}

export function acceptPropertySale(game) {
  const offer = game.pendingTrade;
  if (!offer) return false;
  const buyer = game.players[offer.buyerId];
  const seller = game.players[offer.sellerId];
  const tile = Number.isInteger(offer.tile) ? board[offer.tile] : null;
  const land = tile ? game.properties[offer.tile] : null;
  if (
    !buyer || buyer.bankrupt || !seller || seller.bankrupt ||
    !tile || !["property", "rail", "utility"].includes(tile.type) || !land ||
    land.owner !== seller.id || land.mortgaged ||
    !Number.isSafeInteger(offer.price) || offer.price <= 0 || buyer.money < offer.price
  ) {
    game.message = translate(game.locale, "trade.cannotAccept", { buyer: buyer?.name ?? "" });
    return false;
  }

  buyer.money -= offer.price;
  seller.money += offer.price;
  land.owner = buyer.id;
  game.pendingTrade = null;
  game.message = translate(game.locale, offer.kind === "purchase" ? "trade.purchaseCompleted" : "trade.completed", {
    seller: seller.name,
    buyer: buyer.name,
    tile: getTileName(game.locale, board[offer.tile].translationKey),
    price: offer.price
  });
  return true;
}

export function rejectPropertySale(game) {
  const offer = game.pendingTrade;
  if (!offer) return false;
  game.pendingTrade = null;
  game.message = translate(game.locale, offer.kind === "purchase" ? "trade.purchaseRejected" : "trade.rejected", {
    seller: game.players[offer.sellerId].name,
    buyer: game.players[offer.buyerId].name,
    tile: getTileName(game.locale, board[offer.tile].translationKey)
  });
  return true;
}

export function useJailCard(game) {
  const player = activePlayer(game);
  if (!player.inJail || !player.getOutOfJail) return false;
  const card = cards[player.jailCardDeck].find(item => item.effect.kind === "jailCard");
  if (card) game.cardDecks[player.jailCardDeck].push(card);
  player.getOutOfJail = false;
  player.jailCardDeck = null;
  player.inJail = false;
  player.jailTurns = 0;
  game.phase = "roll";
  game.message = translate(game.locale, "game.jailCardUsed", { name: player.name });
  return true;
}

export function payJailFine(game) {
  const player = activePlayer(game);
  if (!player.inJail || player.money < 50) return false;
  player.money -= 50;
  player.inJail = false;
  player.jailTurns = 0;
  game.phase = "roll";
  game.message = translate(game.locale, "game.jailFinePaid", { name: player.name });
  return true;
}

export function ownedTiles(game, playerId) {
  return game.properties.map((land, index) => land.owner === playerId ? index : -1).filter(index => index >= 0);
}

export function groupComplete(game, playerId, group) {
  return ownsGroup(game, playerId, group);
}

function ownsGroup(game, playerId, group) {
  return board.map((tile, index) => tile.group === group ? index : -1)
    .filter(index => index >= 0)
    .every(index => game.properties[index].owner === playerId);
}

function sendToJail(game, player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  game.doublesCount = 0;
  game.message = translate(game.locale, "game.sentToJail", { name: player.name });
  finishAction(game);
}

export function tileRent(game, index) {
  return rentFor(game, index);
}

export function tileOwner(game, index) {
  const owner = game.properties[index].owner;
  return owner === null ? null : game.players[owner];
}
