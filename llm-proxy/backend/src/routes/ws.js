const logger = require("../utils/logger");
const { WebSocketServer, WebSocket } = require('ws');
const { streamBroadcaster } = require('../di');

function initWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        logger.info('[WS] New client connected');

        ws.on('close', () => {
            logger.info('[WS] Client disconnected');
        });

        ws.on('error', (err) => {
            logger.error('[WS] Client error:', err);
        });
    });

    // Listen to StreamBroadcaster events and relay to all connected WebSocket clients
    streamBroadcaster.on('message', (messageStr) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                } catch (e) {
                    logger.error('[WS] Error sending message to client:', e);
                }
            }
        });
    });

    logger.info('[WS] WebSocket server initialized');
    return wss;
}

module.exports = { initWebSocket };
