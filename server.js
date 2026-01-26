import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // 允許所有來源連線 (開發方便)，正式上線建議改成你的前端網址
    methods: ["GET", "POST"]
  }
});

// 暫存房間資料
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. 加入房間 (Strict Mode)
  socket.on('join_room', (roomId) => {
    if (!rooms[roomId]) {
      // 房間不存在，回傳錯誤
      socket.emit('error', 'Room not found');
      return;
    }

    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

    // 發送最新狀態給該用戶
    socket.emit('init_state', rooms[roomId]);
  });

  // 1.5 建立房間 (Explicit Create)
  socket.on('create_room', (roomId) => {
    if (rooms[roomId]) {
      socket.emit('error', 'Room already exists');
      return;
    }

    socket.join(roomId);

    // 建立預設資料
    rooms[roomId] = {
      settings: { base: 100, tai: 20, bgColor: '#0b6623' },
      players: [
        { id: 0, name: '玩家1', score: 0, avatar: '🀄️' },
        { id: 1, name: '玩家2', score: 0, avatar: '🀄️' },
        { id: 2, name: '玩家3', score: 0, avatar: '🀄️' },
        { id: 3, name: '玩家4', score: 0, avatar: '🀄️' }
      ],
      logs: []
    };

    console.log(`User ${socket.id} created room ${roomId}`);
    socket.emit('init_state', rooms[roomId]);
  });

  // 2. 更新設定 (房主操作)
  socket.on('update_settings', ({ roomId, settings, players }) => {
    if (rooms[roomId]) {
      rooms[roomId].settings = settings;
      rooms[roomId].players = players;
      // 廣播給房間內所有人
      io.to(roomId).emit('state_updated', rooms[roomId]);
    }
  });

  // 3. 記帳動作
  socket.on('record_action', ({ roomId, log, updatedPlayers }) => {
    if (rooms[roomId]) {
      rooms[roomId].players = updatedPlayers;
      rooms[roomId].logs.unshift(log);
      io.to(roomId).emit('state_updated', rooms[roomId]);
    }
  });
});

const PORT = 3001;

// 取得本機區域網路 IP 的 Helper 函式
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 忽略內部 IP (127.0.0.1) 和非 IPv4
      if ('IPv4' === iface.family && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, '0.0.0.0', () => { // 加上 '0.0.0.0' 允許外部連線
  const ip = getLocalIp();
  console.log(`
  🚀 後端伺服器已啟動！
  -----------------------------------------
  🏠 本機連線: http://localhost:${PORT}
  📡 區域網路: http://${ip}:${PORT}  <-- 前端請連這個 IP
  -----------------------------------------
  `);
});

