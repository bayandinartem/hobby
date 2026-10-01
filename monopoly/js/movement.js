export function createMovementPath(startPosition, steps, destination, boardSize = 40) {
  if (!Number.isInteger(boardSize) || boardSize <= 0) {
    throw new RangeError("Размер игрового поля должен быть положительным целым числом.");
  }
  if (!Number.isInteger(startPosition) || startPosition < 0 || startPosition >= boardSize) {
    throw new RangeError("Стартовая позиция должна находиться на игровом поле.");
  }
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError("Число шагов должно быть неотрицательным целым числом.");
  }
  if (!Number.isInteger(destination) || destination < 0 || destination >= boardSize) {
    throw new RangeError("Позиция назначения должна находиться на игровом поле.");
  }

  const path = [startPosition];
  for (let step = 1; step <= steps; step++) {
    path.push((startPosition + step) % boardSize);
  }
  const rolledDestination = path[path.length - 1];
  if (destination !== rolledDestination) path.push(destination);
  return { path, rolledDestination, hasSpecialMove: destination !== rolledDestination };
}

export function tokenCenterInBoard(tile, board) {
  const tokenContainer = tile.querySelector(".tile-tokens");
  if (!tokenContainer) throw new Error("На клетке не найден контейнер фишек.");
  const tokenRect = tokenContainer.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  return {
    left: tokenRect.left + tokenRect.width / 2 - boardRect.left - board.clientLeft,
    top: tokenRect.top + tokenRect.height / 2 - boardRect.top - board.clientTop
  };
}

export function animateTokenAlongPath(token, path, pointFor, { stepDuration = 125, extraDuration = 0 } = {}) {
  if (!Number.isFinite(stepDuration) || stepDuration < 0 || !Number.isFinite(extraDuration) || extraDuration < 0) {
    throw new RangeError("Длительность анимации должна быть неотрицательным конечным числом.");
  }
  if (path.length < 2) return Promise.resolve();

  const points = path.map(pointFor);
  token.style.left = `${points[0].left}px`;
  token.style.top = `${points[0].top}px`;
  const keyframes = points.map((point, index) => ({
    left: `${point.left}px`,
    top: `${point.top}px`,
    offset: index / (points.length - 1)
  }));
  const duration = (path.length - 1) * stepDuration + extraDuration;
  return token.animate(keyframes, {
    duration,
    easing: "ease-in-out",
    fill: "forwards"
  }).finished;
}
