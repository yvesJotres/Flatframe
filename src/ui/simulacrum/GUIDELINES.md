# Simulacrum Development Guidelines

## 1. Philosophy
The Simulacrum is a sandbox environment. All systems designed for it must prioritize **decoupling** and **extensibility**. It should never require manual code changes in the UI or Spawner when adding new entities.

## 2. Architecture
*   **Decoupling**: The UI/Spawner must never know the internals of an entity. They only know the interface (`takeDamage`, `draw`, etc.) and the path in the registry.
*   **Registry-Driven**: All spawnable entities must be registered in `src/entities/registry.js`. 
    *   *Rule:* If it is not in the registry, it does not exist to the Simulacrum.
*   **Lazy Loading**: Always use dynamic `import()` in the `Spawner` to prevent bloating the initial game bundle. Entities should only load into memory when spawned.

## 3. Workflow for Adding New Entities
1.  **Define**: Create the entity file in `src/entities/factions/[faction]/[name].js`.
2.  **Register**: Add the file path to `src/entities/registry.js` under the appropriate faction.
3.  **Verify**: The `SimulacrumMenu` will automatically detect the change on the next load.

## 4. Code Standards
*   **Spawner**: Methods must remain `async` to support dynamic loading.
*   **Menu**: UI components should be strictly separated from game logic. They communicate with the `Spawner` through standard promises.
*   **Entities**: Every entity added to the Simulacrum must inherit from `BaseEnemy` and conform to the standard `(x, y, options)` constructor signature.
*   **Console**: If adding a new interaction point, ensure it is instantiated within the `game.js` loop and utilizes the `SimulacrumMenu` toggle.

## 5. Directory Structure
*   `src/ui/simulacrum/core/` (Logic: Menu, Spawner)
*   `src/ui/simulacrum/entities/` (World Objects: Console)

*Any deviation from this structure requires a review of imports in `src/game.js`.*
