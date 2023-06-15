// Import your package's classes or functions
const GameStateManager = GameSync.GameStateManager;

function gameStateUpdateFunction(gameState, unhandledActions, serverPlayers, deltaTime) {
    // console.log("Game state:", gameState);
    // console.log("Unhandled actions:", unhandledActions);
    // console.log("Server players:", serverPlayers);

    // Just return the gameState as it is, if you want to modify the gameState, update it here.
    return gameState;
}

// Use your package to demonstrate the functionality
// Replace WebSocket URL and implement gameStateUpdateFunction for your needs
const gameManager = new GameStateManager("ws://karhu.felixbade.fi:3000", gameStateUpdateFunction);