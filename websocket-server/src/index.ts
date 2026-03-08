/**
 * HookLens WebSocket Server
 * Socket.io + Redis Pub/Sub for real-time webhook updates
 * PRD: FR-2, NFR-1.3 (<500ms), NFR-2.2 (10k connections)
 */
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';

const PORT = parseInt(process.env.PORT || process.env.WS_PORT || '3001');
const REDIS_URL = process.env.WS_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const JWT_SECRET = process.env.WS_JWT_SECRET || 'dev-secret-change-in-production';
const FRONTEND_URL = process.env.WS_FRONTEND_URL || 'http://localhost:3000';

// Create HTTP server
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: io.engine.clientsCount }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// Create Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Redis clients (with retry strategy so it doesn't crash Node instantly on deployment if Redis isn't up yet)
const subscriber = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 50,
  retryStrategy(times) {
    console.warn(`[Redis] Retrying connection (Attempt ${times})...`);
    return Math.min(times * 1000, 5000); // Reconnect after 1s, max 5s
  }
});

// Track stats
let totalMessagesForwarded = 0;

// ==========================================
// Authentication Middleware
// ==========================================
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    socket.data.userId = payload.userId as string;
    socket.data.email = payload.email as string;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

// ==========================================
// Connection Handler
// ==========================================
io.on('connection', (socket) => {
  console.log(`[WS] User connected: ${socket.data.userId} (${socket.id})`);

  // Subscribe to endpoint updates
  socket.on('subscribe', (endpointId: string) => {
    if (!endpointId || typeof endpointId !== 'string') return;
    socket.join(`endpoint:${endpointId}`);
    console.log(`[WS] ${socket.data.userId} subscribed to endpoint:${endpointId}`);
  });

  // Unsubscribe from endpoint
  socket.on('unsubscribe', (endpointId: string) => {
    if (!endpointId || typeof endpointId !== 'string') return;
    socket.leave(`endpoint:${endpointId}`);
    console.log(`[WS] ${socket.data.userId} unsubscribed from endpoint:${endpointId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[WS] User disconnected: ${socket.data.userId} (${reason})`);
  });

  socket.on('error', (err) => {
    console.error(`[WS] Socket error for ${socket.data.userId}:`, err.message);
  });
});

// ==========================================
// Redis Pub/Sub Listener
// ==========================================
subscriber.subscribe('webhooks:new', 'webhooks:analyzed', (err) => {
  if (err) {
    console.error('[Redis] Failed to subscribe to channels:', err.message);
    // Don't exit process, let retryStrategy handle reconnection
  } else {
    console.log('[Redis] Subscribed to channels: webhooks:new, webhooks:analyzed');
  }
});

subscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    totalMessagesForwarded++;

    if (channel === 'webhooks:new') {
      // New webhook received — push to all clients subscribed to this endpoint
      io.to(`endpoint:${data.endpointId}`).emit('webhook_received', {
        id: data.webhookId,
        endpointId: data.endpointId,
        provider: data.provider,
        eventType: data.eventType,
        signatureValid: data.signatureValid,
        timestamp: data.timestamp,
      });
    } else if (channel === 'webhooks:analyzed') {
      // AI analysis complete — push to clients
      io.to(`endpoint:${data.endpointId}`).emit('analysis_complete', {
        webhookId: data.webhookId,
        analysis: data.analysis,
        confidence: data.confidence,
      });
    }
  } catch (err) {
    console.error('[Redis] Failed to parse message:', err);
  }
});

subscriber.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

// ==========================================
// Start Server
// ==========================================
httpServer.listen(PORT, () => {
  console.log(`\n🔌 HookLens WebSocket Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Redis: ${REDIS_URL}`);
  console.log(`   CORS: ${FRONTEND_URL}`);
  console.log(`   Ready for connections!\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WS] Shutting down...');
  io.close();
  subscriber.quit();
  process.exit(0);
});
