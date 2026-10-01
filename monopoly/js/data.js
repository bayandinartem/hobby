const property = (name, group, price, rents, buildCost, translationKey) => ({
  name,
  translationKey,
  type: "property",
  group,
  price,
  rents,
  buildCost
});

export const board = [
  { name: "Городские ворота", translationKey: "cityGates", type: "start" },
  property("Старый тракт", "brown", 60, [2, 10, 30, 90, 160, 250], 50, "oldRoad"),
  { name: "Указ короны", translationKey: "royalDecree", type: "chest" },
  property("Яблоневый сад", "brown", 60, [4, 20, 60, 180, 320, 450], 50, "appleOrchard"),
  { name: "Королевская подать", translationKey: "royalTax", type: "tax", amount: 200 },
  { name: "Северный тракт", translationKey: "northernRoad", type: "rail", price: 200 },
  property("Овсяное поле", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50, "oatField"),
  { name: "Воля судьбы", translationKey: "fate", type: "chance" },
  property("Мельничный холм", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50, "millHill"),
  property("Рыбацкая деревня", "lightblue", 120, [8, 40, 100, 300, 450, 600], 50, "fishingVillage"),
  { name: "Подземелье / визит", translationKey: "dungeon", type: "jail" },
  property("Шёлковый двор", "pink", 140, [10, 50, 150, 450, 625, 750], 100, "silkCourt"),
  { name: "Королевская мельница", translationKey: "royalMill", type: "utility", price: 150 },
  property("Гончарный квартал", "pink", 140, [10, 50, 150, 450, 625, 750], 100, "pottersQuarter"),
  property("Виноградный склон", "pink", 160, [12, 60, 180, 500, 700, 900], 100, "vineyard"),
  { name: "Восточный тракт", translationKey: "easternRoad", type: "rail", price: 200 },
  property("Каменный мост", "orange", 180, [14, 70, 200, 550, 750, 950], 100, "stoneBridge"),
  { name: "Указ короны", translationKey: "royalDecree", type: "chest" },
  property("Ремесленная слобода", "orange", 180, [14, 70, 200, 550, 750, 950], 100, "craftsmenQuarter"),
  property("Лесная застава", "orange", 200, [16, 80, 220, 600, 800, 1000], 100, "forestOutpost"),
  { name: "Королевский праздник", translationKey: "royalFestival", type: "free" },
  property("Серебряный рудник", "red", 220, [18, 90, 250, 700, 875, 1050], 150, "silverMine"),
  { name: "Воля судьбы", translationKey: "fate", type: "chance" },
  property("Красная крепость", "red", 220, [18, 90, 250, 700, 875, 1050], 150, "redFortress"),
  property("Королевский порт", "red", 240, [20, 100, 300, 750, 925, 1100], 150, "royalHarbor"),
  { name: "Южный тракт", translationKey: "southernRoad", type: "rail", price: 200 },
  property("Медоварня", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150, "meadery"),
  { name: "Кузница", translationKey: "forge", type: "utility", price: 150 },
  property("Золотые луга", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150, "goldenMeadows"),
  property("Янтарный замок", "yellow", 280, [24, 120, 360, 850, 1025, 1200], 150, "amberCastle"),
  { name: "Приказ стражи", translationKey: "guardsOrder", type: "goToJail" },
  property("Белый бастион", "green", 300, [26, 130, 390, 900, 1100, 1275], 200, "whiteBastion"),
  property("Серебряный базар", "green", 300, [26, 130, 390, 900, 1100, 1275], 200, "silverMarket"),
  { name: "Указ короны", translationKey: "royalDecree", type: "chest" },
  property("Королевские сады", "green", 320, [28, 150, 450, 1000, 1200, 1400], 200, "royalGardens"),
  { name: "Западный тракт", translationKey: "westernRoad", type: "rail", price: 200 },
  { name: "Воля судьбы", translationKey: "fate", type: "chance" },
  property("Рыцарский двор", "darkblue", 350, [35, 175, 500, 1100, 1300, 1500], 200, "knightsCourt"),
  { name: "Сбор на корону", translationKey: "crownLevy", type: "tax", amount: 100 },
  property("Королевский дворец", "darkblue", 400, [50, 200, 600, 1400, 1700, 2000], 200, "royalPalace")
];

export const groups = {
  brown: { color: "#8b5a3c", size: 2 },
  lightblue: { color: "#79c8d8", size: 3 },
  pink: { color: "#c77bb8", size: 3 },
  orange: { color: "#e58a43", size: 3 },
  red: { color: "#c94d45", size: 3 },
  yellow: { color: "#e2bd4e", size: 3 },
  green: { color: "#55956b", size: 3 },
  darkblue: { color: "#4969a4", size: 2 }
};

export const cards = {
  chance: [
    { textKey: "chance.jailCard", text: "Корона вручает вам грамоту для освобождения из подземелья.", effect: { kind: "jailCard" } },
    { textKey: "chance.reward", text: "Король награждает за службу. Получите 150 монет.", effect: { kind: "money", amount: 150 } },
    { textKey: "chance.gates", text: "Конь привёз вас к городским воротам. Получите 200 монет.", effect: { kind: "move", to: 0, collectStart: true } },
    { textKey: "chance.fine", text: "Стража требует уплаты штрафа. Заплатите 50 монет.", effect: { kind: "money", amount: -50 } },
    { textKey: "chance.jail", text: "Срочно отправляйтесь в подземелье.", effect: { kind: "jail" } },
    { textKey: "chance.market", text: "Продайте урожай на ярмарке. Получите 100 монет.", effect: { kind: "money", amount: 100 } },
    { textKey: "chance.palace", text: "Следуйте к Королевскому дворцу.", effect: { kind: "move", to: 39, collectStart: true } },
    { textKey: "chance.repairs", text: "Почините мосты: 25 монет за каждый дом и 100 за каждый замок.", effect: { kind: "repair", house: 25, hotel: 100 } }
  ],
  chest: [
    { textKey: "chest.debt", text: "Казначей возвращает старый долг. Получите 100 монет.", effect: { kind: "money", amount: 100 } },
    { textKey: "chest.village", text: "Сбор на нужды деревни. Заплатите 50 монет.", effect: { kind: "money", amount: -50 } },
    { textKey: "chest.inheritance", text: "Наследство от дальнего родственника: получите 200 монет.", effect: { kind: "money", amount: 200 } },
    { textKey: "chest.doctor", text: "Плата лекарю и кузнецу: заплатите 50 монет.", effect: { kind: "money", amount: -50 } },
    { textKey: "chest.thanks", text: "Получите благодарность короны: 20 монет.", effect: { kind: "money", amount: 20 } },
    { textKey: "chest.jail", text: "Отправляйтесь в подземелье.", effect: { kind: "jail" } }
  ]
};

export const railIndices = [5, 15, 25, 35];
