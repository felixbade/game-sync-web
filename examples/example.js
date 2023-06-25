// Import your package's classes or functions
const GameStateManager = GameSync.GameStateManager;

function gameStateUpdateFunction(gameState, unhandledActions, serverPlayers, deltaTime) {
    // console.log("Game state:", gameState);
    // console.log("Unhandled actions:", unhandledActions);
    // console.log("Server players:", serverPlayers);

    if (gameState.time === undefined) {
        gameState.time = 0;
    }

    gameState.time += deltaTime;

    return gameState;
}

// Use your package to demonstrate the functionality
// Replace WebSocket URL and implement gameStateUpdateFunction for your needs
const gameManager = new GameStateManager("ws://localhost:3000", gameStateUpdateFunction);