import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. 設定傳輸限制 (50MB)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. 讀取憑證
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

// --- 儲存 Debug 圖片 ---
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

app.post('/api/log-result', (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const name = filename || `prediction_${Date.now()}.jpg`;
    const filePath = path.join(LOG_DIR, name);

    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        console.error('Failed to save log image:', err);
        return res.status(500).json({ error: 'Failed to save image' });
      }
      console.log('Saved debug image to:', filePath);
      res.json({ success: true, path: filePath });
    });
  } catch (error) {
    console.error('Log endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// --- 儲存錯誤回報 (JSON) ---
app.post('/api/report-error', (req, res) => {
  try {
    const reportData = req.body;
    if (!reportData) return res.status(400).json({ error: 'No data provided' });

    const name = `report_${Date.now()}.json`;
    const filePath = path.join(LOG_DIR, name);

    fs.writeFile(filePath, JSON.stringify(reportData, null, 2), (err) => {
      if (err) {
        console.error('Failed to save report:', err);
        return res.status(500).json({ error: 'Failed to save report' });
      }
      console.log('Saved error report to:', filePath);
      res.json({ success: true, path: filePath });
    });
  } catch (error) {
    console.error('Report endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- 取得錯誤回報列表 (含摘要) ---
app.get('/api/reports', async (req, res) => {
  try {
    const files = await fs.promises.readdir(LOG_DIR);

    // Filter for json reports
    const reportFiles = files
      .filter(f => f.startsWith('report_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Descending name

    const reports = await Promise.all(reportFiles.map(async (f) => {
      try {
        const content = await fs.promises.readFile(path.join(LOG_DIR, f), 'utf-8');
        const json = JSON.parse(content);
        return {
          filename: f,
          timestamp: json.timestamp,
          note: json.userFeedback?.note || '',
          correctTai: json.userFeedback?.correctTai || ''
        };
      } catch (e) {
        return { filename: f, error: 'Read failed' };
      }
    }));

    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list logs' });
  }
});

// --- 讀取單一錯誤回報 ---
app.get('/api/report/:filename', (req, res) => {
  const { filename } = req.params;
  // Sanitize filename to prevent directory traversal
  if (!filename.match(/^report_\d+\.json$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(LOG_DIR, filename);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'Report not found' });
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON file' });
    }
  });
});

// --- AI 辨識 API ---
app.post('/api/predict', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) return res.status(400).json({ error: '沒有收到圖片' });

    // 設定 API 資訊
    const roboflowUrl = "https://detect.roboflow.com/mahjong-baq4s/77";
    const apiKey = "i0NDeTeRyF2TXqfWUpym";

    console.log("正在發送圖片至 Roboflow...");

    const response = await axios({
      method: "POST",
      url: roboflowUrl,
      params: {
        api_key: apiKey,
        confidence: 40,
        overlap: 50
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
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    if (!rooms[roomId]) {
      socket.emit('error', 'Room not found');
      return;
    }
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.emit('init_state', rooms[roomId]);
  });

  socket.on('create_room', (roomId) => {
    if (rooms[roomId]) {
      socket.emit('error', 'Room already exists');
      return;
    }
    socket.join(roomId);
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

  socket.on('update_settings', ({ roomId, settings, players }) => {
    if (rooms[roomId]) {
      rooms[roomId].settings = settings;
      rooms[roomId].players = players;
      io.to(roomId).emit('state_updated', rooms[roomId]);
    }
  });

  socket.on('record_action', ({ roomId, log, updatedPlayers }) => {
    if (rooms[roomId]) {
      rooms[roomId].players = updatedPlayers;
      rooms[roomId].logs.unshift(log);
      io.to(roomId).emit('state_updated', rooms[roomId]);
    }
  });
});

const PORT = 3001;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if ('IPv4' === iface.family && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log(`
  🚀 後端伺服器已啟動！
  -----------------------------------------
  🏠 本機連線: https://localhost:${PORT}
  📡 區域網路: https://${ip}:${PORT}
  -----------------------------------------
  `);
});
