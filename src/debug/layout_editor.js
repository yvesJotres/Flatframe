/**
 * Dev only: edit the Navigation map's layout. Turn it on in the browser console:
 *   editlayout.on()      turn on
 *   editlayout.dump()    print the mission positions and routes as JSON
 *   editlayout.reset()   forget the saved edits and reload the defaults
 *   editlayout.off()     turn off
 *
 * With it on:
 *   drag a mission     moves it
 *   click a mission    links it to the previously clicked mission (the route is drawn between them)
 *   click empty space  forgets the selected mission, so the next link starts fresh
 *   Delete             removes every link of the selected mission (the last one clicked)
 *   right click        deselects the selected mission
 *   Ctrl+Z             undoes the last drag, link or delete
 *
 * Edits are saved in this browser's local storage and applied at startup.
 * To put them in the game for everyone, copy the dump() output into star_chart.js.
 *
 * Kept in release builds on purpose, with the other debug tools.
 * The Navigation screen only has the small hooks (editor.isOn, click, move, release, drawLabel).
 */
import { STAR_CHART, EARTH_ROUTES, SKY_NODES } from '../ui/menus/star_chart.js';

const POS_KEY = 'flatframe.missionLayout';
const ROUTE_KEY = 'flatframe.missionRoutes';
const DRAG_DISTANCE = 4; // pixels a press must move before it counts as a drag rather than a click

function readJson(key) {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the edit lasts until the page reloads
  }
}

// Current positions of every mission and sky node, rounded to 2 decimals
function positions() {
  const out = {};
  for (const planet of STAR_CHART) {
    for (const mission of planet.nodes) {
      out[mission.name] = { x: Number(mission.pos.x.toFixed(2)), y: Number(mission.pos.y.toFixed(2)) };
    }
  }
  for (const node of SKY_NODES) {
    out[node.label] = { x: Number(node.x.toFixed(3)), y: Number(node.y.toFixed(3)) };
  }
  return out;
}

// Moves each mission to its saved position, and restores the saved routes
function applySaved() {
  const savedPos = readJson(POS_KEY);
  if (savedPos) {
    for (const planet of STAR_CHART) {
      for (const mission of planet.nodes) {
        if (savedPos[mission.name]) mission.pos = { ...savedPos[mission.name] };
      }
    }
    for (const node of SKY_NODES) {
      if (savedPos[node.label]) Object.assign(node, { x: savedPos[node.label].x, y: savedPos[node.label].y });
    }
  }
  const savedRoutes = readJson(ROUTE_KEY);
  if (Array.isArray(savedRoutes)) {
    EARTH_ROUTES.length = 0;
    for (const route of savedRoutes) EARTH_ROUTES.push(route);
  }
}

// Adds a link from one mission to another. A route that ends at the first mission is extended.
function link(fromName, toName) {
  const route = EARTH_ROUTES.find((r) => r[r.length - 1] === fromName);
  if (route) route.push(toName);
  else EARTH_ROUTES.push([fromName, toName]);
  writeJson(ROUTE_KEY, EARTH_ROUTES);
}

// Undo history: a snapshot of the positions and routes before each change
const history = [];
const HISTORY_LIMIT = 100;

function snapshot() {
  return { pos: positions(), routes: EARTH_ROUTES.map((route) => [...route]) };
}

function record() {
  history.push(snapshot());
  if (history.length > HISTORY_LIMIT) history.shift();
}

function restore(snap) {
  for (const planet of STAR_CHART) {
    for (const mission of planet.nodes) {
      if (snap.pos[mission.name]) mission.pos = { ...snap.pos[mission.name] };
    }
  }
  for (const node of SKY_NODES) {
    if (snap.pos[node.label]) Object.assign(node, { x: snap.pos[node.label].x, y: snap.pos[node.label].y });
  }
  EARTH_ROUTES.length = 0;
  for (const route of snap.routes) EARTH_ROUTES.push([...route]);
  writeJson(POS_KEY, positions());
  writeJson(ROUTE_KEY, EARTH_ROUTES);
}

// Removes every link to or from a mission: the curves that meet it are cut there, and the rest are rebuilt
function removeLinks(name) {
  record();
  const pairs = [];
  for (const route of EARTH_ROUTES) {
    for (let i = 0; i < route.length - 1; i++) pairs.push([route[i], route[i + 1]]);
  }
  EARTH_ROUTES.length = 0;
  for (const [a, b] of pairs) {
    if (a !== name && b !== name) link(a, b);
  }
  writeJson(ROUTE_KEY, EARTH_ROUTES);
}

export function installLayoutEditor(navigation) {
  applySaved();

  let on = false;
  let down = false; // the left button is held
  let press = null; // { mission, x, y, moved } from the last press on a mission
  let pendingFrom = null; // the last mission clicked, the start of the next link

  navigation.editor = {
    isOn: () => on,

    // A press on a mission starts a drag, or a link if it is released without moving
    click(nav, x, y) {
      // Sky nodes (such as Simulacrum) are dragged only: they take no part in linking
      const sky = nav.skyNodeAt(x, y);
      if (sky) {
        press = { sky, x, y, moved: false };
        if (!down) navigation.editor.release(); // already let go: a click, not a drag
        return true;
      }
      let hit = null;
      for (const planet of STAR_CHART) {
        const mission = nav.missionAt(planet, x, y);
        if (mission) {
          hit = mission;
          break;
        }
      }
      if (hit) {
        press = { mission: hit, x, y, moved: false };
        if (!down) navigation.editor.release(); // already let go: a click, not a drag
      } else {
        pendingFrom = null;
      }
      return true;
    },

    // A press that moves becomes a drag: the mission follows the pointer, stored as a fraction of the planet radius.
    // Returns true while a drag is running, so the screen skips its own hover handling.
    move(nav, x, y) {
      if (!press) return false;
      if (!press.moved && Math.hypot(x - press.x, y - press.y) > DRAG_DISTANCE) {
        press.moved = true;
        record(); // the drag is one step in the undo history
      }
      if (!press.moved) return true;
      if (press.sky) {
        // Sky nodes are stored as fractions of the screen
        press.sky.x = x / nav.canvas.width;
        press.sky.y = y / nav.canvas.height;
        return true;
      }
      const { cx, cy, r } = nav.planetLayout();
      press.mission.pos = { x: (x - cx) / r, y: (y - cy) / r };
      return true;
    },

    // Releasing ends a drag (saved), or links the mission if the press did not move
    release() {
      if (!press) return;
      if (press.moved) {
        writeJson(POS_KEY, positions());
      } else if (press.sky) {
        // A click on a sky node does nothing while editing
      } else {
        if (pendingFrom && pendingFrom !== press.mission) {
          record();
          link(pendingFrom.name, press.mission.name);
        }
        pendingFrom = press.mission;
      }
      press = null;
    },

    drawLabel(ctx, h) {
      if (!on) return;
      ctx.font = '12px "Segoe UI", Roboto, system-ui, sans-serif';
      ctx.fillStyle = '#ff6b35';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('LAYOUT EDIT: drag to move, click two missions to link, then editlayout.dump()', 16, h - 12);
    },
  };

  window.addEventListener('mousedown', (e) => { if (e.button === 0) down = true; });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) down = false;
    navigation.editor.release();
  });

  // Delete (or Backspace) removes the links of the selected mission, the last one clicked
  // Right click deselects the selected mission, so the next click does not link to it
  window.addEventListener('mousedown', (e) => {
    if (on && e.button === 2) pendingFrom = null;
  });

  // Ctrl+Z (Cmd+Z on Mac) steps back one change
  window.addEventListener('keydown', (e) => {
    if (on && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const snap = history.pop();
      if (snap) restore(snap);
      return;
    }
    if (!on || !pendingFrom) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeLinks(pendingFrom.name);
      pendingFrom = null; // the next click selects a mission without linking it to this one
    }
  });

  window.editlayout = {
    nav: navigation, // for debugging in the console
    on() {
      on = true;
      console.info('Layout edit on: drag to move, click two missions to link, Delete removes the selected mission links, then editlayout.dump()');
    },
    off() {
      on = false;
      press = null;
      pendingFrom = null;
    },
    dump() {
      const out = { missions: positions(), routes: EARTH_ROUTES };
      console.log(JSON.stringify(out, null, 2));
      return out;
    },
    reset() {
      try {
        globalThis.localStorage?.removeItem(POS_KEY);
        globalThis.localStorage?.removeItem(ROUTE_KEY);
      } catch {
        // Nothing saved to remove
      }
      location.reload();
    },
  };
}
