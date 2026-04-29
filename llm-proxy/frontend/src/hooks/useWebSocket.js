import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (url) => {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('connecting');
    const ws = useRef(null);

    useEffect(() => {
        const connect = () => {
            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                setStatus('connected');
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setMessages((prev) => [...prev, data]);
                } catch (e) {
                    console.error('Failed to parse WS message:', e);
                }
            };

            ws.current.onclose = () => {
                setStatus('disconnected');
                // Optional reconnect logic
                setTimeout(connect, 3000);
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket Error:', error);
                setStatus('error');
            };
        };

        connect();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [url]);

    const clearMessages = () => setMessages([]);

    return { messages, status, clearMessages };
};
