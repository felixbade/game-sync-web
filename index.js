class GameStateManager {
  constructor(webSocketUrl, gameStateUpdateFunction) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.gameStateUpdateFunction = gameStateUpdateFunction;

    this.gameState = {};
    this.unhandledActions = [];
    this.serverPlayers = [];
    this.unverifiedUpdates = [];

    this.balanceSlidingWindow = new Array(2000).fill(0);
    this.balanceSlidingWindowIndex = 0;
    this.serverClientTimeDiff = 0;

    this.webSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'pong') {
        const clientTime = (Date.now() - data.payload.sentTime) / 2;
        this.updateServerClientTimeDifference(data.serverTime, clientTime);
      } else if (data.type === 'gameStateUpdate') {
        this.handleServerGameStateUpdate(data);
      } else if (data.type === 'playerAction') {
        this.unhandledActions.push(data.action);
      } else if (data.type === 'clientJoined') {
        this.serverPlayers.push(data.clientId);
      } else if (data.type === 'clientLeft') {
        this.serverPlayers = this.serverPlayers.filter(
          (client) => client !== data.clientId
        );
      }
    };

    setInterval(() => this.webSocket.send(JSON.stringify({ type: 'ping', payload: { sentTime: Date.now() } })), 10);
    setInterval(() => this.updateGameState(), 1000 / 60); // Optional: configure update frequency.
  }

  updateServerClientTimeDifference(serverTime, clientTime) {
    this.balanceSlidingWindow[this.balanceSlidingWindowIndex] =
      serverTime - clientTime;
    this.balanceSlidingWindowIndex =
      (this.balanceSlidingWindowIndex + 1) % this.balanceSlidingWindow.length;

    this.serverClientTimeDiff = this.median(this.balanceSlidingWindow);
  }

  median(arr) {
    const mid = Math.floor(arr.length / 2),
      nums = [...arr].sort((a, b) => a - b);
    return arr.length % 2 !== 0
      ? nums[mid]
      : (nums[mid - 1] + nums[mid]) / 2;
  }

  handleServerGameStateUpdate(data) {
    if (this.unverifiedUpdates.includes(data.state.id)) {
      this.unverifiedUpdates = this.unverifiedUpdates.filter(
        (id) => id !== data.state.id
      );
    } else {
      this.gameState = data.state;
      this.unverifiedUpdates = [];
      this.updateGameState(
        this.serverTimeEstimate() - data.state.serverTime
      );
    }
  }

  updateGameState(deltaTime = 1000 / 60) {
    const updatedGameState = this.gameStateUpdateFunction(
      this.gameState,
      this.unhandledActions,
      this.serverPlayers,
      deltaTime
    );

    const newStateId = uuidv4();
    this.unverifiedUpdates.push(newStateId);

    this.webSocket.send(
      JSON.stringify({
        type: 'gameStateUpdate',
        state: updatedGameState,
        handledActionIds: this.unhandledActions.map((action) => action.id),
        serverTime: this.serverTimeEstimate(),
        currentStateId: newStateId,
        previousStateId: this.gameState.id,
      })
    );

    this.gameState = updatedGameState;
    this.unhandledActions = [];
  }

  serverTimeEstimate() {
    return Date.now() + this.serverClientTimeDiff;
  }

  addPlayerAction(action) {
    this.unhandledActions.push(action);
  }
}
