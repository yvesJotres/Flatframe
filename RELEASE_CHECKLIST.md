# Flatframe release checklist

Run the automated tests first (`npm test`). Everything below is played by hand, on keyboard and mouse, and again on a
controller. For each item, note anything that freezes, throws an error in the console (F12), shows "undefined", or
looks wrong.

## Before you play
- [ ] Dev server is running (`npx live-server --port=8080 --no-browser`), and the game loads to the main menu.
- [ ] The console has no errors on load.

## Exterminate (E Prime, and the other Earth Exterminate nodes)
- [ ] Map is a generated layout: rooms, walls, gates, and a spawn room. No black empty map.
- [ ] Enemies come only from the spawn room, six at a time at most.
- [ ] Gates open when you walk up to them and close after you leave. Enemies can't see you through a closed gate.
- [ ] Extraction opens after the kill quota. Reaching the exit ends the mission with a result screen.

## Defense (Lith, Coba, and Dark Sector Defense on the star chart)
- [ ] Map is the open arena with the cryopod in the middle.
- [ ] Enemies come from every side and rush the cryopod. The pod's health bar drops when it's hit.
- [ ] The wave number goes up after each wave is cleared.
- [ ] Enemy level stays inside the node's level range (for example 1–6 on Lith).
- [ ] After wave 3, 6, and so on, the rotation screen appears. EXTRACT (Y / A) ends the mission and pays the reward.
      CONTINUE (N / B) starts the next wave. Failing after continuing gives no reward.

## Survival (if reachable)
- [ ] Life support drains and capsules appear. Extraction is available after 5 minutes.

## Other Earth nodes (Interception, Mobile Defense, Excavation, Capture, Spy, Rescue, Sabotage, Shrine Defense,
## Dark Sector Excavation, Open World, Assassination)
- [ ] Each node launches. Each uses the Exterminate rules as a placeholder. Note any node whose rules you expected to differ.

## Combat
- [ ] Heavy attack (middle mouse / heavy button) doesn't freeze the game.
- [ ] Radial Javelin, Exalted Blade (summon, waves), and Slash Dash each run, with their visuals and sounds.
- [ ] Bullet jump: crouch (Ctrl / RB), then jump (Shift / A). It flies toward the aim and blasts on landing.
- [ ] Melee: the blade swings and the Skana sword sits upright when idle.

## Results screen (mission complete)
- [ ] Time, enemies killed, melee kills, damage dealt, damage received, XP, and loot all show numbers, not "undefined".
- [ ] Retry (Enter / A) and mission select (M) work.

## Controller
- [ ] Every mission can be started and finished with the controller alone.
- [ ] The rotation screen works with A and B.

## Known placeholders (see the code comments for each)
- Wave sizes, enemy level growth, rotation reward, gate timing, blade range, patrol timings, the arena layout.
- Eleven node types use Exterminate's rules until their own rules are written.
- No door sound: gates use the loot sound.
