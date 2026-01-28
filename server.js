import express from 'express';
import { createServer } from 'https'; // ⚠️ 改用 https
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import axios from 'axios';
import fs from 'fs'; // ⚠️ 引入檔案讀取

const app = express();

// 1. 設定傳輸限制 (50MB)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. 讀取剛剛產生的憑證
const httpsOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
};

// 3. 建立 HTTPS 伺服器
const httpServer = createServer(httpsOptions, app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

// --- AI 辨識 API ---
// server.js 中的 /api/predict 區塊
app.post('/api/predict', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) return res.status(400).json({ error: '沒有收到圖片' });

    // 設定 API 資訊
    const roboflowUrl = "https://detect.roboflow.com/mahjong-baq4s/77";
    const apiKey = "i0NDeTeRyF2TXqfWUpym"; // ⚠️ 注意：正式上線請放入環境變數

    console.log("正在發送圖片至 Roboflow...");

    const response = await axios({
      method: "POST",
      url: roboflowUrl,
      params: {
        api_key: apiKey,
        confidence: 40, // 信心度門檻 (40%)
        overlap: 50     // ✨ 關鍵：允許 50% 重疊 (解決牌靠很近的問題)
      },
      data: image,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    console.log("辨識成功，物件數:", response.data.predictions.length);
    res.json(response.data);

  } catch (error) {
    console.error("AI 辨識失敗:", error.message);
    res.status(500).json({ error: 'AI 服務錯誤' });
  }
});

// --- Socket.io ---
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
  🏠 本機連線: https://localhost:${PORT}
  📡 區域網路: https://${ip}:${PORT}  <-- 前端請連這個 IP
  -----------------------------------------
  `);
});

