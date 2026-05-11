import './env.js';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { handleConnection } from './handler.js';

const wss = new WebSocketServer({ port: config.port });

wss.on('connection', (ws, req) => {
  console.log(`New ConversationRelay connection from ${req.socket.remoteAddress}`);
  handleConnection(ws);
});

wss.on('listening', () => {
  console.log(`ConversationRelay server running on ws://localhost:${config.port}`);
});
