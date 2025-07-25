const CUBE_SIZE = 80;
const PLAYGROUND_SIZE = 800;
const SNAP_DISTANCE = 40;

const state = {
  selectedId: null,
  nextGroupId: 1,
  cubes: [
    { id: 'cube1', x: 50, y: 100, color: 'red', groupId: null },
    { id: 'cube2', x: 300, y: 300, color: 'blue', groupId: null },
  ],
};

let dragActive = false;
let dragCubeId = null;
let mouseStart = { x: 0, y: 0 };
let dragStartMap = {};
const playground = document.getElementById('playground');

function render() {
  // showDebugInfo();
  playground.innerHTML = '';
  for (const cube of state.cubes) {
    const div = document.createElement('div');
    div.className = 'cube' + (state.selectedId === cube.id ? ' selected' : '');
    div.id = cube.id;
    div.style.left = cube.x + 'px';
    div.style.top = cube.y + 'px';
    div.style.background = cube.color;
    const selected = state.cubes.find((c) => c.id === state.selectedId);
    if (selected && selected.groupId && selected.groupId === cube.groupId) {
      div.classList.add('grouped');
    }

    div.onclick = (e) => {
      if (!dragActive) {
        state.selectedId = cube.id;
        render();
      }
    };
    div.onmousedown = (e) => startDrag(e, cube.id);
    playground.appendChild(div);
  }
}

function startDrag(e, id) {
  state.selectedId = id;
  render();
  dragCubeId = id;
  dragActive = false;
  mouseStart.x = e.clientX;
  mouseStart.y = e.clientY;
  const cube = state.cubes.find((c) => c.id === id);
  const group = getGroup(cube);
  dragStartMap = {};
  for (const c of group) {
    dragStartMap[c.id] = { x: c.x, y: c.y };
  }
  console.log('startDrag', {
    dragCubeId,
    group: group.map((c) => c.id),
    dragStartMap,
    mouseStart,
  });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function onMove(e) {
  const rawDx = e.clientX - mouseStart.x;
  const rawDy = e.clientY - mouseStart.y;

  if (!dragActive && (Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2))
    dragActive = true;
  if (!dragActive) return;

  const cube = state.cubes.find((c) => c.id === dragCubeId);
  const group = getGroup(cube);

  // Вычисляем границы всей группы
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of group) {
    const start = dragStartMap[c.id];
    minX = Math.min(minX, start.x);
    minY = Math.min(minY, start.y);
    maxX = Math.max(maxX, start.x + CUBE_SIZE);
    maxY = Math.max(maxY, start.y + CUBE_SIZE);
  }

  // Вычисляем максимально допустимые dx, dy
  const maxDxLeft = -minX;
  const maxDxRight = PLAYGROUND_SIZE - maxX;
  const maxDyTop = -minY;
  const maxDyBottom = PLAYGROUND_SIZE - maxY;

  const clampedDx = Math.max(maxDxLeft, Math.min(maxDxRight, rawDx));
  const clampedDy = Math.max(maxDyTop, Math.min(maxDyBottom, rawDy));

  // Применяем ограниченное смещение
  for (const c of group) {
    const start = dragStartMap[c.id];
    c.x = start.x + clampedDx;
    c.y = start.y + clampedDy;
  }

  // Snap logic как есть
  outer: for (const target of state.cubes) {
    if (group.includes(target)) continue;
    for (const moving of group) {
      if (shouldSnap(moving, target)) {
        alignCubes(moving, target);
        mergeGroups(moving, target);

        // Обновляем start map и мышь
        const cube = state.cubes.find((c) => c.id === dragCubeId);
        const group = getGroup(cube);
        for (const c of group) {
          dragStartMap[c.id] = { x: c.x, y: c.y };
        }
        mouseStart.x = e.clientX;
        mouseStart.y = e.clientY;
        break outer;
      }
    }
  }

  render();
}

function onUp() {
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseup', onUp);
  if (dragCubeId) {
    state.selectedId = dragCubeId;
    render();
  }
  setTimeout(() => {
    dragActive = false;
  }, 10);
  dragCubeId = null;
}

function shouldSnap(c1, c2) {
  const dLeft = Math.abs(c1.x + CUBE_SIZE - c2.x);
  const dRight = Math.abs(c1.x - (c2.x + CUBE_SIZE));
  const dTop = Math.abs(c1.y + CUBE_SIZE - c2.y);
  const dBottom = Math.abs(c1.y - (c2.y + CUBE_SIZE));
  const overlapY = Math.abs(c1.y - c2.y) < CUBE_SIZE;
  const overlapX = Math.abs(c1.x - c2.x) < CUBE_SIZE;
  return (
    (dLeft <= SNAP_DISTANCE && overlapY) ||
    (dRight <= SNAP_DISTANCE && overlapY) ||
    (dTop <= SNAP_DISTANCE && overlapX) ||
    (dBottom <= SNAP_DISTANCE && overlapX)
  );
}

function mergeGroups(c1, c2) {
  if (!c1.groupId && !c2.groupId) {
    const newId = state.nextGroupId++;
    c1.groupId = newId;
    c2.groupId = newId;
  } else {
    const mainId = c1.groupId || c2.groupId;
    for (const c of state.cubes) {
      if (c.groupId === c1.groupId || c.groupId === c2.groupId) {
        c.groupId = mainId;
      }
    }
    c1.groupId = mainId;
    c2.groupId = mainId;
  }
}

function getGroup(cube) {
  if (!cube.groupId) return [cube];
  return state.cubes.filter((c) => c.groupId === cube.groupId);
}

// Корректировка dragged-куба «грань-в-грань» к target
function alignCubes(moving, target) {
  const dxRight = Math.abs(moving.x + CUBE_SIZE - target.x);
  const dxLeft = Math.abs(moving.x - (target.x + CUBE_SIZE));
  const dyBottom = Math.abs(moving.y + CUBE_SIZE - target.y);
  const dyTop = Math.abs(moving.y - (target.y + CUBE_SIZE));

  if (dxRight <= SNAP_DISTANCE && Math.abs(moving.y - target.y) < CUBE_SIZE) {
    moving.x = target.x - CUBE_SIZE;
  } else if (
    dxLeft <= SNAP_DISTANCE &&
    Math.abs(moving.y - target.y) < CUBE_SIZE
  ) {
    moving.x = target.x + CUBE_SIZE;
  } else if (
    dyBottom <= SNAP_DISTANCE &&
    Math.abs(moving.x - target.x) < CUBE_SIZE
  ) {
    moving.y = target.y - CUBE_SIZE;
  } else if (
    dyTop <= SNAP_DISTANCE &&
    Math.abs(moving.x - target.x) < CUBE_SIZE
  ) {
    moving.y = target.y + CUBE_SIZE;
  }
}

function setColor(color) {
  const cube = state.cubes.find((c) => c.id === state.selectedId);
  if (cube) {
    cube.color = color;
    render();
  }
}

render();
// function showDebugInfo() {
//   const infoDiv = document.getElementById('debug-info');
//   infoDiv.textContent =
//     state.cubes
//       .map(
//         (c) =>
//           `id:${c.id} x:${c.x.toFixed(1).padStart(5)} y:${c.y
//             .toFixed(1)
//             .padStart(5)} groupId:${String(c.groupId).padStart(5)}`
//       )
//       .join('\n') +
//     '\n\n' +
//     Object.entries(dragStartMap)
//       .map(
//         ([id, v]) =>
//           `dragStartMap[${id}]: x:${v.x.toFixed(1)} y:${v.y.toFixed(1)}`
//       )
//       .join('\n');
// }

function ungroup() {
  const selected = state.cubes.find((c) => c.id === state.selectedId);
  if (!selected) return;

  const group = getGroup(selected);
  if (group.length !== 2) return;

  const [a, b] =
    group[0].id === selected.id ? [group[0], group[1]] : [group[1], group[0]];

  a.groupId = null;
  b.groupId = null;

  const C = CUBE_SIZE;
  const W = PLAYGROUND_SIZE;
  const margin = 50; // зазор между зонами
  const minOffset = 30; // безопасный отступ от краёв

  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;

  const randomInRange = (min, max) =>
    Math.max(min, Math.min(max, min + Math.random() * (max - min)));

  // Координатные границы зон
  const zones = {
    Q1: {
      // ↖
      xMin: minOffset,
      xMax: Math.max(minOffset, cx - margin - C),
      yMin: minOffset,
      yMax: Math.max(minOffset, cy - margin - C),
    },
    Q2: {
      // ↗
      xMin: Math.min(W - C - minOffset, cx + margin),
      xMax: W - C - minOffset,
      yMin: minOffset,
      yMax: Math.max(minOffset, cy - margin - C),
    },
    Q3: {
      // ↘
      xMin: Math.min(W - C - minOffset, cx + margin),
      xMax: W - C - minOffset,
      yMin: Math.min(W - C - minOffset, cy + margin),
      yMax: W - C - minOffset,
    },
    Q4: {
      // ↙
      xMin: minOffset,
      xMax: Math.max(minOffset, cx - margin - C),
      yMin: Math.min(W - C - minOffset, cy + margin),
      yMax: W - C - minOffset,
    },
  };

  // Расчёт относительного положения второго куба
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  let qa, qb;
  if (dx >= 0 && dy >= 0) {
    qa = 'Q1';
    qb = 'Q3'; // b правее и ниже → a ↖, b ↘
  } else if (dx < 0 && dy >= 0) {
    qa = 'Q2';
    qb = 'Q4'; // b левее и ниже → a ↗, b ↙
  } else if (dx >= 0 && dy < 0) {
    qa = 'Q4';
    qb = 'Q2'; // b правее и выше → a ↙, b ↗
  } else {
    qa = 'Q3';
    qb = 'Q1'; // b левее и выше → a ↘, b ↖
  }

  function randomPointIn(zone) {
    return {
      x: randomInRange(zones[zone].xMin, zones[zone].xMax),
      y: randomInRange(zones[zone].yMin, zones[zone].yMax),
    };
  }

  const aTarget = randomPointIn(qa);
  const bTarget = randomPointIn(qb);

  animateUngroup(a, b, aTarget.x, aTarget.y, bTarget.x, bTarget.y);
}

function animateUngroup(
  a,
  b,
  targetAX,
  targetAY,
  targetBX,
  targetBY,
  duration = 300
) {
  const startTime = performance.now();
  const startAX = a.x;
  const startAY = a.y;
  const startBX = b.x;
  const startBY = b.y;

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut

    a.x = startAX + (targetAX - startAX) * ease;
    a.y = startAY + (targetAY - startAY) * ease;
    b.x = startBX + (targetBX - startBX) * ease;
    b.y = startBY + (targetBY - startBY) * ease;

    render();
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
