export function bindActionButtons(root, handler) {
  root.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", handler));
}

export function handleNewGameAction(action, { resetGame, showSetup }) {
  if (action !== "new-game") return false;
  resetGame();
  showSetup();
  return true;
}
