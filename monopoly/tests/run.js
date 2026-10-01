import assert from "node:assert/strict";
import { board, cards, groups } from "../js/data.js";
import { createSoundEffects } from "../js/audio.js";
import {
  acceptPropertySale,
  activePlayer,
  buildHouse,
  buyProperty,
  createGame,
  endTurn,
  groupComplete,
  mortgageProperty,
  ownedTiles,
  payJailFine,
  proposePropertyPurchase,
  proposePropertySale,
  rejectPropertySale,
  rollDice,
  skipPurchase,
  tileOwner,
  tileRent,
  unmortgageProperty,
  useJailCard
} from "../js/game.js";
import { animateTokenAlongPath, createMovementPath, tokenCenterInBoard } from "../js/movement.js";
import { renderGame } from "../js/ui.js";
import {
  formatHouseCount, formatMoney, formatPropertiesCount, getCardText, getGroupName, getTileName, supportedLocales, translate
} from "../js/i18n.js";
import { bindActionButtons, handleNewGameAction } from "../js/actions.js";

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function makeGame(names = ["Артур", "Изольда"]) {
  return createGame(names, { random: () => 0 });
}

function randomDice(first, second) {
  const values = [(first - 1) / 6, (second - 1) / 6];
  return () => values.shift() ?? 0;
}

function playDeterministicGame(locale) {
  const game = createGame(locale === "en" ? ["Arthur", "Isolde"] : ["Артур", "Изольда"], {
    random: () => 0.37,
    locale
  });
  const diceSequence = [0.1, 0.6, 0.3, 0.8, 0.2, 0.9, 0.4, 0.7, 0.05, 0.55, 0.25, 0.75];
  let diceIndex = 0;
  let actions = 0;
  const randomDiceValue = () => diceSequence[diceIndex++ % diceSequence.length];
  while (game.phase !== "finished" && actions < 5000) {
    actions++;
    if (game.phase === "roll") rollDice(game, randomDiceValue);
    else if (game.phase === "buy") {
      if (activePlayer(game).money >= board[game.pendingTile].price) buyProperty(game);
      else skipPurchase(game);
    } else if (game.phase === "end") endTurn(game);
    else assert.fail(`Unexpected game phase: ${game.phase}`);
  }
  return { game, actions };
}

test("localization supports Russian and English with safe Russian fallback", () => {
  assert.deepEqual(supportedLocales, ["ru", "en"]);
  assert.equal(translate("en", "setup.missingPlayers"), "Enter names for the first two players.");
  assert.equal(translate("ru", "setup.missingPlayers"), "Введите имена первых двух игроков.");
  assert.equal(getTileName("en", board[39].translationKey), "Royal Palace");
  assert.equal(formatHouseCount("ru", 3), "3 дома");
  assert.equal(formatHouseCount("en", 1), "1 house");
  assert.equal(formatPropertiesCount("en", 1), "1 property");
  assert.equal(formatPropertiesCount("en", 2), "2 properties");
  assert.equal(formatMoney("en", 1500), "1,500 ◈");
  assert.equal(translate("unknown", "setup.missingPlayers"), "Введите имена первых двух игроков.");
  assert.equal(createGame(["Один", "Два"], { locale: "unknown" }).locale, "ru");
});

test("sound effects play dice, movement, and coin cues and can be muted", () => {
  const contexts = [];
  class FakeAudioContext {
    constructor() {
      this.currentTime = 1;
      this.sampleRate = 100;
      this.state = "running";
      this.destination = {};
      this.oscillators = 0;
      this.sources = 0;
      this.gains = [];
      contexts.push(this);
    }
    createGain() {
      const gain = {
        gain: {
          value: 0,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          cancelScheduledValues() {},
          setTargetAtTime(value) { this.value = value; }
        },
        connect() {}
      };
      this.gains.push(gain);
      return gain;
    }
    createOscillator() {
      this.oscillators++;
      return {
        type: "",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {}
      };
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(100) };
    }
    createBufferSource() {
      this.sources++;
      return { connect() {}, start() {}, stop() {} };
    }
    createBiquadFilter() {
      return { type: "", frequency: { value: 0 }, connect() {} };
    }
    resume() { return Promise.resolve(); }
  }

  const sounds = createSoundEffects(FakeAudioContext);
  assert.equal(sounds.supported, true);
  sounds.playDiceRoll();
  sounds.playStep();
  sounds.playCoins();
  const context = contexts[0];
  assert.equal(context.sources, 6);
  assert.equal(context.oscillators, 6);
  sounds.setEnabled(false);
  const oscillatorCount = context.oscillators;
  sounds.playCoins();
  assert.equal(context.oscillators, oscillatorCount);
  assert.equal(context.gains[0].gain.value, 0);
  sounds.setEnabled(true);
  assert.equal(context.gains[0].gain.value, 0.65);
});

test("English catalogs cover every board space, group, and card", () => {
  assert.equal(board.length, 40);
  for (let index = 0; index < board.length; index++) {
    assert.ok(board[index].translationKey, `tile ${index} should have a stable translation key`);
    assert.doesNotMatch(getTileName("en", board[index].translationKey), /[А-Яа-яЁё]/, `tile ${index} should have an English name`);
  }
  for (const group of Object.keys(groups)) {
    assert.doesNotMatch(getGroupName("en", group), /[А-Яа-яЁё]/, `${group} should have an English name`);
  }
  for (const card of [...cards.chance, ...cards.chest]) {
    assert.ok(card.textKey, `card "${card.text}" should have a stable translation key`);
    assert.doesNotMatch(getCardText("en", card), /[А-Яа-яЁё]/, `card "${card.textKey}" should have an English translation`);
  }
});

test("English game rules and board UI use the selected locale", () => {
  const game = createGame(["Arthur", "Isolde"], { random: () => 0, locale: "en" });
  assert.equal(game.message, "Roll the dice to begin your turn.");
  rollDice(game, randomDice(1, 2));
  assert.equal(game.phase, "buy");
  assert.match(game.message, /Apple Orchard/);

  const html = renderGame(game, [], { selectedProperty: 3 });
  assert.match(html, /Kingdom/);
  assert.match(html, /Current turn/);
  assert.match(html, /Buy “Apple Orchard” for 60 coins\?/);
  assert.match(html, /Fertile Lands/);
  assert.match(html, /Buy/);
  assert.doesNotMatch(html, /[А-Яа-яЁё]/);
});

test("sound toggle is localized and exposes its enabled state", () => {
  const russianGame = makeGame();
  const russianHtml = renderGame(russianGame, [], { soundEnabled: false });
  assert.match(russianHtml, /<button[^>]*data-sound-toggle[^>]*aria-pressed="false"[^>]*>Звук: выкл\./);

  const englishGame = createGame(["Arthur", "Isolde"], { random: () => 0, locale: "en" });
  const englishHtml = renderGame(englishGame, [], { soundEnabled: true });
  assert.match(englishHtml, /<button[^>]*data-sound-toggle[^>]*aria-pressed="true"[^>]*>Sound: on/);
});

test("clicking the final screen New game action resets and returns to setup", () => {
  let game = makeGame();
  let setupError = "old validation error";
  const currentLocale = "en";
  let setupShown = false;
  game.phase = "finished";
  game.winner = 0;
  const finalHtml = renderGame(game, [], {});
  assert.match(finalHtml, /data-action="new-game">Новая игра<\/button>/);

  const listeners = new Map();
  const newGameButton = {
    dataset: { action: "new-game" },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    click() {
      listeners.get("click")({ currentTarget: this });
    }
  };
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-action]");
      return [newGameButton];
    }
  };

  bindActionButtons(root, event => {
    handleNewGameAction(event.currentTarget.dataset.action, {
      resetGame() {
        game = null;
        setupError = "";
      },
      showSetup() {
        setupShown = true;
      }
    });
  });
  newGameButton.click();

  assert.equal(game, null);
  assert.equal(setupError, "");
  assert.equal(setupShown, true);
  assert.equal(currentLocale, "en");
});

test("board has forty entries and valid color groups", () => {
  assert.equal(board.length, 40);
  for (const [group, details] of Object.entries(groups)) {
    assert.equal(board.filter(tile => tile.group === group).length, details.size);
  }
  const jailCards = [...cards.chance, ...cards.chest].filter(card => card.effect.kind === "jailCard");
  assert.equal(jailCards.length, 1);
});

test("new games validate players and initialize independent state", () => {
  assert.throws(() => createGame(["Один"]), /от 2 до 4/);
  assert.throws(() => createGame(["Артур", " "]), /должно быть имя/);
  assert.throws(() => createGame(["Артур", "Изольда"], { random: 1 }), /должен быть функцией/);

  const first = makeGame();
  const second = makeGame();
  first.players[0].money = 10;
  assert.equal(second.players[0].money, 1500);
  assert.equal(first.properties.length, 40);
});

test("passing the start tile pays the start bonus", () => {
  const game = makeGame();
  activePlayer(game).position = 38;
  rollDice(game, randomDice(1, 1));
  assert.equal(activePlayer(game).position, 0);
  assert.equal(activePlayer(game).money, 1700);
});

test("landing on an unowned property opens a purchase and buying transfers ownership", () => {
  const game = makeGame();
  rollDice(game, randomDice(1, 2));
  assert.equal(game.phase, "buy");
  assert.equal(game.pendingTile, 3);
  buyProperty(game);
  assert.equal(game.properties[3].owner, 0);
  assert.equal(activePlayer(game).money, 1440);
  assert.equal(game.phase, "end");
});

test("declining an unowned property ends a normal turn", () => {
  const game = makeGame();
  rollDice(game, randomDice(1, 2));
  skipPurchase(game);
  assert.equal(game.phase, "end");
  assert.equal(game.properties[3].owner, null);
});

test("tax spaces charge the configured amount", () => {
  const game = makeGame();
  activePlayer(game).position = 2;
  rollDice(game, randomDice(1, 1));
  assert.equal(activePlayer(game).money, 1300);
  assert.match(game.message, /200 монет/);
});

test("rent is transferred and doubles for a complete color group", () => {
  const game = makeGame();
  game.properties[1].owner = 0;
  game.properties[3].owner = 0;
  assert.equal(groupComplete(game, 0, "brown"), true);
  game.players[1].position = 39;
  game.currentPlayer = 1;
  rollDice(game, randomDice(1, 1));
  assert.equal(game.players[1].money, 1696);
  assert.equal(game.players[0].money, 1504);
});

test("mortgaged properties do not charge rent", () => {
  const game = makeGame();
  game.properties[1] = { owner: 0, houses: 0, mortgaged: true };
  game.players[1].position = 39;
  game.currentPlayer = 1;
  rollDice(game, randomDice(1, 1));
  assert.equal(game.players[1].money, 1700);
  assert.equal(game.players[0].money, 1500);
});

test("rail and utility rent follow ownership counts and the dice total", () => {
  const railGame = makeGame();
  railGame.properties[5].owner = 0;
  railGame.properties[15].owner = 0;
  railGame.players[1].position = 3;
  railGame.currentPlayer = 1;
  rollDice(railGame, randomDice(1, 1));
  assert.equal(railGame.players[1].money, 1450);
  assert.equal(railGame.players[0].money, 1550);

  const utilityGame = makeGame();
  utilityGame.properties[12].owner = 0;
  utilityGame.players[1].position = 10;
  utilityGame.currentPlayer = 1;
  rollDice(utilityGame, randomDice(1, 1));
  assert.equal(utilityGame.players[1].money, 1492);
  assert.equal(utilityGame.players[0].money, 1508);
});

test("a double grants another roll after resolving a purchase", () => {
  const game = makeGame();
  activePlayer(game).position = 1;
  rollDice(game, randomDice(1, 1));
  buyProperty(game);
  assert.equal(game.phase, "roll");
  assert.equal(game.doublesCount, 1);
  assert.match(game.message, /Дубль/);
});

test("a third consecutive double sends the player to jail", () => {
  const game = makeGame();
  for (let attempt = 0; attempt < 2; attempt++) {
    activePlayer(game).position = 20;
    rollDice(game, randomDice(2, 2));
    skipPurchase(game);
    assert.equal(game.phase, "roll");
  }
  activePlayer(game).position = 20;
  rollDice(game, randomDice(2, 2));
  assert.equal(activePlayer(game).position, 10);
  assert.equal(activePlayer(game).inJail, true);
  assert.equal(game.phase, "end");
});

test("a jail double releases the player without granting an extra roll", () => {
  const game = makeGame();
  activePlayer(game).position = 10;
  activePlayer(game).inJail = true;
  activePlayer(game).jailTurns = 1;
  rollDice(game, randomDice(1, 1));
  assert.equal(activePlayer(game).inJail, false);
  assert.equal(activePlayer(game).position, 12);
  assert.equal(game.phase, "buy");
  assert.equal(game.doublesCount, 0);
});

test("the third failed jail roll charges a fine and moves the player", () => {
  const game = makeGame();
  const player = activePlayer(game);
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 2;
  rollDice(game, randomDice(1, 2));
  assert.equal(player.inJail, false);
  assert.equal(player.jailTurns, 0);
  assert.equal(player.money, 1450);
  assert.equal(player.position, 13);
});

test("paying a jail fine and using a release card restore the roll phase", () => {
  const game = makeGame();
  const player = activePlayer(game);
  player.inJail = true;
  assert.equal(payJailFine(game), true);
  assert.equal(player.money, 1450);
  assert.equal(game.phase, "roll");

  player.inJail = true;
  player.getOutOfJail = true;
  player.jailCardDeck = "chance";
  game.cardDecks.chance = [];
  assert.equal(useJailCard(game), true);
  assert.equal(player.inJail, false);
  assert.equal(player.getOutOfJail, false);
  assert.equal(game.cardDecks.chance.length, 1);
});

test("chance card movement resolves its destination and collects the start bonus", () => {
  const game = makeGame();
  game.players[0].position = 5;
  game.cardDecks.chance = [{ text: "К воротам.", effect: { kind: "move", to: 0, collectStart: true } }];
  rollDice(game, randomDice(1, 1));
  assert.equal(game.players[0].position, 0);
  assert.equal(game.players[0].money, 1700);
  assert.equal(game.phase, "roll");
});

test("houses require a complete group, even construction, and enough funds", () => {
  const game = makeGame();
  game.properties[1].owner = 0;
  assert.equal(buildHouse(game, 1), false);
  game.properties[3].owner = 0;
  assert.equal(buildHouse(game, 1), true);
  assert.equal(buildHouse(game, 1), false);
  assert.equal(buildHouse(game, 3), true);
  assert.equal(game.properties[1].houses, 1);
  assert.equal(game.properties[3].houses, 1);
  assert.equal(game.players[0].money, 1400);
});

test("mortgages and redemptions update the owner balance", () => {
  const game = makeGame();
  game.properties[1].owner = 0;
  assert.equal(mortgageProperty(game, 1), true);
  assert.equal(game.players[0].money, 1530);
  assert.equal(mortgageProperty(game, 1), false);
  assert.equal(unmortgageProperty(game, 1), true);
  assert.equal(game.players[0].money, 1497);
  assert.equal(game.properties[1].mortgaged, false);
});

test("players can offer, accept, and reject sales of improved properties", () => {
  const game = makeGame(["Артур", "Изольда", "Борис"]);
  game.currentPlayer = 1;
  game.properties[1] = { owner: 0, houses: 3, mortgaged: false };
  const originalPhase = game.phase;

  assert.equal(proposePropertySale(game, 1, 1, 275), true);
  assert.deepEqual(game.pendingTrade, { kind: "sale", tile: 1, sellerId: 0, buyerId: 1, price: 275 });
  assert.equal(game.phase, originalPhase);
  assert.equal(game.players[0].money, 1500);
  assert.equal(game.players[1].money, 1500);

  assert.equal(acceptPropertySale(game), true);
  assert.equal(game.pendingTrade, null);
  assert.equal(game.properties[1].owner, 1);
  assert.equal(game.properties[1].houses, 3);
  assert.equal(game.players[0].money, 1775);
  assert.equal(game.players[1].money, 1225);
  assert.equal(game.currentPlayer, 1);

  game.properties[3] = { owner: 1, houses: 0, mortgaged: false };
  assert.equal(proposePropertySale(game, 3, 2, 100), true);
  assert.equal(rejectPropertySale(game), true);
  assert.equal(game.properties[3].owner, 1);
  assert.equal(game.players[1].money, 1225);
  assert.equal(game.players[2].money, 1500);
  assert.equal(game.pendingTrade, null);
});

test("sales reject invalid buyers, prices, pledged property, and unaffordable acceptance", () => {
  const game = makeGame(["Артур", "Изольда", "Борис"]);
  game.properties[1] = { owner: 0, houses: 0, mortgaged: true };
  assert.equal(proposePropertySale(game, 1, 1, 100), false);
  game.properties[1].mortgaged = false;
  assert.equal(proposePropertySale(game, 1, 0, 100), false);
  assert.equal(proposePropertySale(game, 1, "1", 100), false);
  assert.equal(proposePropertySale(game, 1, 1, 0), false);
  assert.equal(proposePropertySale(game, 1, 1, 100.5), false);
  game.properties[4].owner = 0;
  assert.equal(proposePropertySale(game, 4, 1, 100), false);
  assert.equal(proposePropertySale(game, 1, 1, 2000), true);
  game.players[1].money = 1999;
  assert.equal(acceptPropertySale(game), false);
  assert.notEqual(game.pendingTrade, null);
  assert.equal(game.properties[1].owner, 0);
  assert.equal(game.players[0].money, 1500);
});

test("a player can offer a chosen price to buy another player's improved property", () => {
  const game = makeGame(["Артур", "Изольда", "Борис"]);
  game.currentPlayer = 2;
  game.properties[3] = { owner: 0, houses: 4, mortgaged: false };

  assert.equal(proposePropertyPurchase(game, 3, game.currentPlayer, 450), true);
  assert.deepEqual(game.pendingTrade, { kind: "purchase", tile: 3, sellerId: 0, buyerId: 2, price: 450 });
  assert.equal(game.players[0].money, 1500);
  assert.equal(game.players[2].money, 1500);
  assert.equal(acceptPropertySale(game), true);
  assert.equal(game.properties[3].owner, 2);
  assert.equal(game.properties[3].houses, 4);
  assert.equal(game.players[0].money, 1950);
  assert.equal(game.players[2].money, 1050);
  assert.match(game.message, /выкупает/);

  game.properties[5] = { owner: 1, houses: 0, mortgaged: false };
  assert.equal(proposePropertyPurchase(game, 5, 2, 200), true);
  assert.equal(rejectPropertySale(game), true);
  assert.equal(game.properties[5].owner, 1);
  assert.match(game.message, /отклоняет предложение/);
});

test("purchase offers reject self-purchases, unowned and mortgaged property", () => {
  const game = makeGame(["Артур", "Изольда", "Борис"]);
  game.properties[1] = { owner: 0, houses: 0, mortgaged: true };
  assert.equal(proposePropertyPurchase(game, 1, 1, 100), false);
  game.properties[1].mortgaged = false;
  assert.equal(proposePropertyPurchase(game, 1, 0, 100), false);
  assert.equal(proposePropertyPurchase(game, 3, 1, 100), false);
  assert.equal(proposePropertyPurchase(game, 1, 1, 100), true);
});

test("sale UI shows the form, localized offer, and insufficient-funds state", () => {
  const game = makeGame(["Arthur", "Isolde"]);
  game.locale = "en";
  game.properties[1] = { owner: 0, houses: 2, mortgaged: false };
  const propertyHtml = renderGame(game, [], { selectedProperty: 1 });
  assert.match(propertyHtml, /data-trade-toggle="sale" data-property-index="1">Offer for sale/);
  assert.match(propertyHtml, /data-property-trade-form="sale-1"[^>]*hidden/);
  assert.match(propertyHtml, /name="buyerId"/);
  assert.match(propertyHtml, /name="price" type="number"/);

  game.pendingTrade = { tile: 1, sellerId: 0, buyerId: 1, price: 1600 };
  const offerHtml = renderGame(game, [], {});
  assert.match(offerHtml, /Arthur offers “Old Road” to Isolde for 1,600\s+◈\./);
  assert.match(offerHtml, /The buyer does not have enough coins/);
  assert.match(offerHtml, /data-action="accept-sale" disabled/);
  assert.match(offerHtml, /data-action="reject-sale"/);

  game.pendingTrade = null;
  game.currentPlayer = 1;
  const purchaseHtml = renderGame(game, [], { selectedProperty: 1 });
  assert.match(purchaseHtml, /data-trade-toggle="purchase" data-property-index="1">Offer to buy/);
  assert.match(purchaseHtml, /data-property-trade-form="purchase-1"[^>]*hidden/);
  assert.doesNotMatch(purchaseHtml, /name="buyerId" type="hidden"/);
  assert.match(purchaseHtml, /Offered purchase price/);
  assert.match(purchaseHtml, /Send purchase offer/);

  game.pendingTrade = { kind: "purchase", tile: 1, sellerId: 0, buyerId: 1, price: 100 };
  const purchaseOfferHtml = renderGame(game, [], {});
  assert.match(purchaseOfferHtml, /Purchase offer/);
  assert.match(purchaseOfferHtml, /Isolde offers Arthur 100\s+◈ to buy “Old Road”/);
});

test("bankruptcy removes the player and detects the last remaining winner", () => {
  const game = makeGame();
  game.properties[39].owner = 1;
  game.properties[3] = { owner: 0, houses: 2, mortgaged: false };
  game.players[0].money = 1;
  game.players[0].position = 37;
  game.currentPlayer = 0;
  rollDice(game, randomDice(1, 1));
  assert.equal(game.players[0].bankrupt, true);
  assert.equal(game.properties[39].owner, 1);
  assert.equal(game.properties[3].owner, null);
  assert.equal(game.properties[3].houses, 0);
  assert.equal(game.winner, 1);
  assert.equal(game.phase, "finished");
});

test("turn order skips bankrupt players", () => {
  const game = makeGame(["Артур", "Изольда", "Борис"]);
  game.players[1].bankrupt = true;
  game.phase = "end";
  endTurn(game);
  assert.equal(game.currentPlayer, 2);
  assert.equal(activePlayer(game).name, "Борис");
});

test("a complete deterministic game ends with a rendered winner and final balances", () => {
  const { game, actions } = playDeterministicGame("ru");

  assert.equal(game.phase, "finished", "the game should finish before the action limit");
  assert.equal(game.players.filter(player => !player.bankrupt).length, 1);
  assert.equal(game.winner, 1);
  assert.equal(game.players[0].bankrupt, true);
  assert.equal(game.players[1].money, 657);

  const html = renderGame(game, [game.message], {});
  assert.match(html, /class="final-screen"/);
  assert.match(html, /<h1 id="final-title">Победитель — Изольда!<\/h1>/);
  assert.match(html, /<p class="final-summary">Итоговая казна: <strong>657 ◈<\/strong><\/p>/);
  assert.match(html, /<h2 id="results-title">Результаты остальных игроков<\/h2>/);
  assert.match(html, /class="final-player-name">Артур · выбыл<\/span>/);
  assert.doesNotMatch(html, /class="final-player-name">Изольда<\/span>/);
  assert.equal((html.match(/class="final-player-name"/g) ?? []).length, 1);
  assert.ok(html.includes(new Intl.NumberFormat("ru-RU").format(game.players[game.winner].money)));
  assert.match(html, /Победитель — Изольда!/);
  assert.match(html, /data-action="new-game">Новая игра<\/button>/);
  assert.doesNotMatch(html, /class="game-layout"/);
  console.log(`FULL GAME RESULT: player ${game.winner + 1} wins after ${actions} actions with ${game.players[game.winner].money} coins.`);

  const englishRun = playDeterministicGame("en");
  assert.equal(englishRun.game.phase, "finished");
  assert.equal(englishRun.game.winner, 1);
  assert.equal(englishRun.game.players[1].money, 657);
  assert.match(englishRun.game.message, /Isolde is the winner!/);
  const englishHtml = renderGame(englishRun.game, [], {});
  assert.match(englishHtml, /Isolde is the winner!/);
  assert.match(englishHtml, /Final treasury: <strong>657 ◈<\/strong>/);
  assert.match(englishHtml, /Other players/);
  assert.match(englishHtml, /Arthur · bankrupt/);
  assert.match(englishHtml, /New game/);
  assert.doesNotMatch(englishHtml, /[А-Яа-яЁё]/);
});

test("rendering outputs all tiles and escapes untrusted player names", () => {
  const game = makeGame(['<img src=x onerror="alert(1)">', "Изольда"]);
  game.properties[1].owner = 0;
  const html = renderGame(game, [], {});
  assert.equal((html.match(/data-property="\d+"/g) ?? []).length, 40);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /title="Владелец: <img/);
});

test("turn card always reserves the same feedback area below its controls", () => {
  const game = makeGame();
  assert.match(renderGame(game, [], {}), /class="turn-feedback">Выпадет дубль — получите дополнительный ход\.<\/p>/);

  game.phase = "end";
  assert.match(renderGame(game, [], {}), /class="turn-feedback">&nbsp;<\/p>/);

  game.phase = "buy";
  game.pendingTile = 3;
  const purchaseHtml = renderGame(game, [], {});
  assert.match(purchaseHtml, /class="turn-feedback">Купить «/);
  assert.doesNotMatch(purchaseHtml, /class="action-hint"/);
});

test("property detail modal includes full name and all rent tiers", () => {
  const game = makeGame();
  const html = renderGame(game, [], { selectedProperty: 39 });
  assert.match(html, /Королевский дворец/);
  assert.equal((html.match(/class="rent-list"/g) ?? []).length, 2);
  assert.match(html, /2\s?000/);
});

test("movement paths wrap around the board and include special card moves", () => {
  assert.deepEqual(createMovementPath(38, 4, 2), {
    path: [38, 39, 0, 1, 2],
    rolledDestination: 2,
    hasSpecialMove: false
  });
  assert.deepEqual(createMovementPath(5, 4, 0), {
    path: [5, 6, 7, 8, 9, 0],
    rolledDestination: 9,
    hasSpecialMove: true
  });
  assert.throws(() => createMovementPath(40, 1, 1), RangeError);
});

test("movement animation starts at the first tile and follows measured positions", async () => {
  let capturedKeyframes;
  let capturedOptions;
  const token = {
    style: {},
    animate(keyframes, options) {
      capturedKeyframes = keyframes;
      capturedOptions = options;
      return { finished: Promise.resolve() };
    }
  };
  const points = new Map([
    [4, { left: 10, top: 20 }],
    [5, { left: 30, top: 20 }],
    [6, { left: 50, top: 40 }]
  ]);
  await animateTokenAlongPath(token, [4, 5, 6], position => points.get(position), {
    stepDuration: 100,
    extraDuration: 50
  });
  assert.equal(token.style.left, "10px");
  assert.equal(token.style.top, "20px");
  assert.deepEqual(capturedKeyframes, [
    { left: "10px", top: "20px", offset: 0 },
    { left: "30px", top: "20px", offset: 0.5 },
    { left: "50px", top: "40px", offset: 1 }
  ]);
  assert.equal(capturedOptions.duration, 250);
  assert.equal(capturedOptions.fill, "forwards");
});

test("movement points follow the rendered token gutter, not the tile text", () => {
  const tile = {
    querySelector(selector) {
      assert.equal(selector, ".tile-tokens");
      return { getBoundingClientRect: () => ({ left: 120, top: 80, width: 62, height: 30 }) };
    }
  };
  const board = {
    clientLeft: 2,
    clientTop: 3,
    getBoundingClientRect: () => ({ left: 10, top: 20 })
  };
  assert.deepEqual(tokenCenterInBoard(tile, board), { left: 139, top: 72 });
});

test("single-position movement does not start a browser animation", async () => {
  let animateCalled = false;
  const token = { animate() { animateCalled = true; } };
  await animateTokenAlongPath(token, [5], () => ({ left: 0, top: 0 }));
  assert.equal(animateCalled, false);
});

test("UI-only movement state stays outside the game model", () => {
  const game = makeGame();
  const html = renderGame(game, [], {
    isMoving: true,
    visualMovement: { playerId: 0, position: 0 }
  });
  assert.match(html, /class="mini-token moving-token"/);
  assert.doesNotMatch(html, /data-action="roll"/);
  assert.equal(Object.hasOwn(game, "visualMovement"), false);
});

test("players on edge tiles use the inner gutter while corner tokens stay inside", () => {
  const game = makeGame(["Артур", "Изольда", "Борис", "Мира"]);
  game.players.forEach((player, index) => {
    player.position = [0, 15, 25, 1][index];
  });
  const html = renderGame(game, [], {});
  for (const [index, placement] of [[0, "center"], [15, "left"], [25, "top"], [1, "bottom"]]) {
    const tile = html.match(new RegExp(`<button class="([^"]*)"[^>]*data-property="${index}"`));
    assert.ok(tile, `tile ${index} should be rendered`);
    assert.ok(tile[1].split(" ").includes(`tile-tokens-${placement}`), `tile ${index} uses ${placement} token placement`);
  }
});

let failures = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} tests passed.`);
if (failures) process.exitCode = 1;
