/**
 * GAME SERVER - Main Entry Point
 *
 * Handles:
 * - HTTP server for health checks
 * - WebSocket connections via Socket.IO
 * - Room management (create/join/leave)
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GameRoom } from './GameRoom.js';
import { MSG } from '../shared/constants.js';

const app = express();
const httpServer = createServer(app);

// Configure CORS for Socket.IO
// In production, replace '*' with your GitHub Pages URL
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// ===================
// ROOM MANAGEMENT
// ===================
const rooms = new Map(); // roomId -> GameRoom instance

/**
 * Creates a new room or returns existing one
 */
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    const room = new GameRoom(roomId, io);
    rooms.set(roomId, room);

    // Clean up when room is done
    room.onDestroy = () => {
      rooms.delete(roomId);
      console.log(`Room ${roomId} destroyed. Active rooms: ${rooms.size}`);
    };
  }
  return rooms.get(roomId);
}

// ===================
// HTTP ENDPOINTS
// ===================

// Health check for deployment platforms
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    uptime: process.uptime()
  });
});

// Create a new room and return its ID
app.post('/api/create-room', (req, res) => {
  const roomId = uuidv4().substring(0, 8); // Short readable ID
  getOrCreateRoom(roomId);
  res.json({ roomId });
});

// Get room info
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    roomId: room.roomId,
    players: room.getPlayerCount(),
    state: room.gameState
  });
});

// ===================
// SOCKET.IO HANDLING
// ===================

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  let currentRoom = null;
  let playerNumber = null;

  // Join a room
  socket.on(MSG.JOIN_ROOM, ({ roomId }) => {
    // Leave current room if any
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      socket.leave(currentRoom.roomId);
    }

    // Get or create the room
    const room = getOrCreateRoom(roomId);

    // Try to add player
    const result = room.addPlayer(socket.id);

    if (result.success) {
      currentRoom = room;
      playerNumber = result.playerNumber;
      socket.join(roomId);

      socket.emit(MSG.ROOM_JOINED, {
        roomId,
        playerNumber,
        playersConnected: room.getPlayerCount()
      });

      console.log(`Player ${socket.id} joined room ${roomId} as Player ${playerNumber}`);
    } else {
      socket.emit(MSG.ERROR, { message: result.error });
    }
  });

  // Deploy a card
  socket.on(MSG.DEPLOY_CARD, (data) => {
    if (!currentRoom || playerNumber === null) {
      socket.emit(MSG.ERROR, { message: 'Not in a game' });
      return;
    }

    // Server validates and processes the deployment
    currentRoom.handleCardDeploy(playerNumber, data);
  });

  // Leave room
  socket.on(MSG.LEAVE_ROOM, () => {
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      socket.leave(currentRoom.roomId);
      currentRoom = null;
      playerNumber = null;
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
    }
  });
});

// ===================
// START SERVER
// ===================

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   CLASH STRATEGY SERVER                ║
║   Running on port ${PORT}                  ║
║   Ready for connections!               ║
╚════════════════════════════════════════╝
  `);
});
