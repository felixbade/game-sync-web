import { v4 as uuidv4 } from 'uuid';

export class GameStateManager {
    constructor(webSocketUrl, gameStateUpdateFunction) {
        this.webSocket = new WebSocket(webSocketUrl);
        this.gameStateUpdateFunction = gameStateUpdateFunction;

        this.gameState = {};
        this.gameStateId = null;
        this.unhandledActions = [];
        this.serverPlayers = [];
        this.unverifiedUpdateIds = [];

        this.balanceSlidingWindow = new MedianFilter(2000);
        this.serverClientTimeDiff = 0;
        this.gameStateUpdateRefreshId = null;

        this.webSocket.onopen = () => {
            setInterval(
                () => this.webSocket.send(JSON.stringify({ type: 'ping', payload: { sentTime: Date.now() } })),
                1000 / 100
            );
            this.setGameStateUpdateLoop()
        };

        this.webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type !== 'pong') {
                console.log(data)
            }

            if (data.type === 'pong') {
                const clientTime = Date.now()
                const RTT = clientTime - data.payload.sentTime;
                this.balanceSlidingWindow.addValue(data.serverTime + RTT/2 - clientTime);
                this.serverClientTimeDiff = this.balanceSlidingWindow.getMedian();

            } else if (data.type === 'gameStateUpdate') {
                if (this.unverifiedUpdateIds.includes(data.id)) {
                    console.log('leading')
                    // This client is leading
                    this.unverifiedUpdateIds = this.unverifiedUpdateIds.filter(
                        (id) => id !== data.id
                    );
                } else {
                    console.log('following')
                    // This client is following
                    this.gameState = data.state;
                    this.gameStateId = data.id;
                    this.unverifiedUpdateIds = [];
                    const deltaT = this.serverTimeEstimate() - data.serverTimeEstimate;
                    clearInterval(this.gameStateUpdateRefreshId)
                    this.updateGameState(deltaT);
                    this.setGameStateUpdateLoop()
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
    }

    setGameStateUpdateLoop() {
        this.gameStateUpdateRefreshId = setInterval(
            () => this.updateGameState(),
            1000 / 2
        );
    }

    updateGameState(deltaTime = 1000 / 60) {
        const oldGameStateId = this.gameStateId;
        this.gameState = this.gameStateUpdateFunction(
            this.gameState,
            this.unhandledActions,
            this.serverPlayers,
            deltaTime
        );
        this.gameStateId = uuidv4();
        this.unhandledActions = [];

        this.unverifiedUpdateIds.push(this.gameStateId);

        this.webSocket.send(
            JSON.stringify({
                type: 'gameStateUpdate',
                state: this.gameState,
                handledActionIds: this.unhandledActions.map((action) => action.id),
                serverTimeEstimate: this.serverTimeEstimate(),
                id: this.gameStateId,
                basedOnId: oldGameStateId,
            })
        );
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