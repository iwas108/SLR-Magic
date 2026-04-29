const { WebSocketServer, WebSocket } = require('ws');
const { streamBroadcaster } = require('../di');

function initWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('[WS] New client connected');

        ws.on('close', () => {
            console.log('[WS] Client disconnected');
        });

        ws.on('error', (err) => {
            console.error('[WS] Client error:', err);
        });
    });

    // Listen to StreamBroadcaster events and relay to all connected WebSocket clients
    streamBroadcaster.on('message', (messageStr) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                } catch (e) {
                    console.error('[WS] Error sending message to client:', e);
                }
            }
        });
    });

    console.log('[WS] WebSocket server initialized');
    return wss;
}

module.exports = { initWebSocket };
