class GameStateManager {
    constructor(webSocketUrl, gameStateUpdateFunction) {
        this.webSocket = new WebSocket(webSocketUrl);
        this.gameStateUpdateFunction = gameStateUpdateFunction;

        this.gameState = {};
        this.unhandledActions = [];
        this.serverPlayers = [];
        this.unverifiedUpdates = [];

        this.balanceSlidingWindow = new MedianFilter(2000);
        this.serverClientTimeDiff = 0;

        this.webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'pong') {
                const clientTime = (Date.now() - data.payload.sentTime) / 2;
                this.balanceSlidingWindow.addValue(serverTime - clientTime);
                this.serverClientTimeDiff = this.median(this.balanceSlidingWindow);

            } else if (data.type === 'gameStateUpdate') {
                if (this.unverifiedUpdates.includes(data.state.id)) {
                    // This client is leading
                    this.unverifiedUpdates = this.unverifiedUpdates.filter(
                        (id) => id !== data.state.id
                    );
                } else {
                    // This client is following
                    this.gameState = data.state;
                    this.unverifiedUpdates = [];
                    const deltaT = this.serverTimeEstimate() - data.state.serverTime;
                    this.updateGameState(deltaT);
                }

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
        setInterval(() => this.updateGameState(), 1000 / 60);
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

class MedianFilter {
    constructor(windowSize) {
        this.windowSize = windowSize
        this.values = []
    }

    addValue(value) {
        this.values.push(value)
        if (this.values.length > this.windowSize) {
            this.values.shift()
        }
    }

    getMedian() {
        const sortedValues = this.values.slice().sort((a, b) => a - b)
        const medianIndex = Math.floor(sortedValues.length / 2)
        if (sortedValues.length % 2 === 0) {
            return (sortedValues[medianIndex - 1] + sortedValues[medianIndex]) / 2
        } else {
            return sortedValues[medianIndex]
        }
    }

    reset() {
        this.values = []
    }
}
