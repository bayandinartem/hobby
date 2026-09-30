const property = (name, group, price, rents, buildCost) => ({
  name,
  type: "property",
  group,
  price,
  rents,
  buildCost
});

export const board = [
  { name: "Городские ворота", type: "start" },
  property("Старый тракт", "brown", 60, [2, 10, 30, 90, 160, 250], 50),
  { name: "Указ короны", type: "chest" },
  property("Яблоневый сад", "brown", 60, [4, 20, 60, 180, 320, 450], 50),
  { name: "Королевская подать", type: "tax", amount: 200 },
  { name: "Северный тракт", type: "rail", price: 200 },
  property("Овсяное поле", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50),
  { name: "Воля судьбы", type: "chance" },
  property("Мельничный холм", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50),
  property("Рыбацкая деревня", "lightblue", 120, [8, 40, 100, 300, 450, 600], 50),
  { name: "Подземелье / визит", type: "jail" },
  property("Шёлковый двор", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
  { name: "Королевская мельница", type: "utility", price: 150 },
  property("Гончарный квартал", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
  property("Виноградный склон", "pink", 160, [12, 60, 180, 500, 700, 900], 100),
  { name: "Восточный тракт", type: "rail", price: 200 },
  property("Каменный мост", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
  { name: "Указ короны", type: "chest" },
  property("Ремесленная слобода", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
  property("Лесная застава", "orange", 200, [16, 80, 220, 600, 800, 1000], 100),
  { name: "Королевский праздник", type: "free" },
  property("Серебряный рудник", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
  { name: "Воля судьбы", type: "chance" },
  property("Красная крепость", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
  property("Королевский порт", "red", 240, [20, 100, 300, 750, 925, 1100], 150),
  { name: "Южный тракт", type: "rail", price: 200 },
  property("Медоварня", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
  { name: "Кузница", type: "utility", price: 150 },
  property("Золотые луга", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
  property("Янтарный замок", "yellow", 280, [24, 120, 360, 850, 1025, 1200], 150),
  { name: "Приказ стражи", type: "goToJail" },
  property("Белый бастион", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
  property("Серебряный базар", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
  { name: "Указ короны", type: "chest" },
  property("Королевские сады", "green", 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { name: "Западный тракт", type: "rail", price: 200 },
  { name: "Воля судьбы", type: "chance" },
  property("Рыцарский двор", "darkblue", 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { name: "Сбор на корону", type: "tax", amount: 100 },
  property("Королевский дворец", "darkblue", 400, [50, 200, 600, 1400, 1700, 2000], 200)
];

export const groups = {
  brown: { label: "Плодородные земли", color: "#8b5a3c", size: 2 },
  lightblue: { label: "Речные владения", color: "#79c8d8", size: 3 },
  pink: { label: "Ремесленные земли", color: "#c77bb8", size: 3 },
  orange: { label: "Торговые земли", color: "#e58a43", size: 3 },
  red: { label: "Крепости короны", color: "#c94d45", size: 3 },
  yellow: { label: "Золотые земли", color: "#e2bd4e", size: 3 },
  green: { label: "Королевские земли", color: "#55956b", size: 3 },
  darkblue: { label: "Владения короны", color: "#4969a4", size: 2 }
};

export const cards = {
  chance: [
    { text: "Корона вручает вам грамоту для освобождения из подземелья.", effect: { kind: "jailCard" } },
    { text: "Король награждает за службу. Получите 150 монет.", effect: { kind: "money", amount: 150 } },
    { text: "Корона вручает вам грамоту для освобождения из подземелья.", effect: { kind: "jailCard" } },
    { text: "Конь привёз вас к городским воротам. Получите 200 монет.", effect: { kind: "move", to: 0, collectStart: true } },
    { text: "Стража требует уплаты штрафа. Заплатите 50 монет.", effect: { kind: "money", amount: -50 } },
    { text: "Срочно отправляйтесь в подземелье.", effect: { kind: "jail" } },
    { text: "Продайте урожай на ярмарке. Получите 100 монет.", effect: { kind: "money", amount: 100 } },
    { text: "Следуйте к Королевскому дворцу.", effect: { kind: "move", to: 39, collectStart: true } },
    { text: "Почините мосты: 25 монет за каждый дом и 100 за каждый замок.", effect: { kind: "repair", house: 25, hotel: 100 } }
  ],
  chest: [
    { text: "Казначей возвращает старый долг. Получите 100 монет.", effect: { kind: "money", amount: 100 } },
    { text: "Сбор на нужды деревни. Заплатите 50 монет.", effect: { kind: "money", amount: -50 } },
    { text: "Наследство от дальнего родственника: получите 200 монет.", effect: { kind: "money", amount: 200 } },
    { text: "Плата лекарю и кузнецу: заплатите 50 монет.", effect: { kind: "money", amount: -50 } },
    { text: "Получите благодарность короны: 20 монет.", effect: { kind: "money", amount: 20 } },
    { text: "Отправляйтесь в подземелье.", effect: { kind: "jail" } }
  ]
};

export const railIndices = [5, 15, 25, 35];

export const tileTypeNames = {
  start: "СТАРТ",
  chest: "КОРОНА",
  chance: "СУДЬБА",
  tax: "ПОДАТЬ",
  rail: "ТРАКТ",
  utility: "ПРЕДПРИЯТИЕ",
  jail: "ПОДЗЕМЕЛЬЕ",
  free: "ПРАЗДНИК",
  goToJail: "СТРАЖА",
  property: "ВЛАДЕНИЕ"
};
