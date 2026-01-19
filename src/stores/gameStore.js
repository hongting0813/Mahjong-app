import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io } from 'socket.io-client';

export const useGameStore = defineStore('game', () => {
  // --- State (資料狀態) ---
  const socket = ref(null);
  const roomId = ref(null);
  const myPlayerId = ref(null); // 我選擇的座位 ID (0~3)
  const isConnected = ref(false); // 連線狀態亮燈用

  // 遊戲資料 (會從後端同步)
  const settings = ref({ base: 0, tai: 0, bgColor: '#0b6623' });
  const players = ref([]); // 原始順序的玩家列表
  const logs = ref([]);

  // --- Actions (動作) ---

  /**
   * 1. 連線並加入房間
   * @param {string} room - 房號
   */
  const connectAndJoin = (room) => {
    // 如果已經連線過，不要重複連線
    if (socket.value && socket.value.connected) {
        console.log('Socket 已經連線，跳過重連');
        socket.value.emit('join_room', room);
        return;
    }

    roomId.value = room;

    // ✨ 自動判斷連線網址
    // 如果瀏覽器網址是 http://localhost:5173，就連 http://localhost:3001
    // 如果瀏覽器網址是 http://192.168.1.5:5173，就連 http://192.168.1.5:3001
    const currentDomain = window.location.hostname;
    const socketUrl = `http://${currentDomain}:3001`;

    console.log(`🚀 準備連線到後端: ${socketUrl}`);

    // 建立 Socket 連線
    socket.value = io(socketUrl, {
      transports: ['websocket'], // 強制使用 WebSocket，減少 CORS 問題
      reconnectionAttempts: 5    // 斷線重試 5 次
    });

    // --- 監聽 Socket 事件 ---

    // A. 連線成功
    socket.value.on('connect', () => {
      console.log(`✅ Socket 連線成功！ID: ${socket.value.id}`);
      isConnected.value = true;
      
      // 連線後馬上加入房間
      console.log(`正在加入房間: ${roomId.value}`);
      socket.value.emit('join_room', roomId.value);
    });

    // B. 連線錯誤
    socket.value.on('connect_error', (err) => {
      console.error(`❌ 連線失敗: ${err.message}`);
      isConnected.value = false;
    });

    // C. 接收初始化資料 (剛進房時)
    socket.value.on('init_state', (data) => {
      console.log('📦 收到房間資料:', data);
      syncData(data);
    });

    // D. 接收更新資料 (有人記帳或改設定時)
    socket.value.on('state_updated', (data) => {
      console.log('🔄 房間狀態更新');
      syncData(data);
    });

    // E. 斷線
    socket.value.on('disconnect', () => {
      console.warn('⚠️ 與伺服器斷線');
      isConnected.value = false;
    });
  };

  // 同步資料的輔助函式
  const syncData = (data) => {
    if (!data) return;
    if (data.settings) settings.value = data.settings;
    if (data.players) players.value = data.players;
    if (data.logs) logs.value = data.logs;
  };

  /**
   * 2. 更新房間設定 (房主用)
   */
  const updateSettings = (newSettings, newPlayers) => {
    if (!socket.value) return;
    socket.value.emit('update_settings', {
      roomId: roomId.value,
      settings: newSettings,
      players: newPlayers
    });
  };

  /**
   * 3. 結算/記帳
   */
  const settleRound = (winnerId, loserId, taiCount) => {
    if (!socket.value) return;

    const amount = Number(settings.value.base) + (taiCount * Number(settings.value.tai));
    // 深拷貝一份玩家資料來計算，避免直接修改現有畫面導致閃爍，等待後端回傳才是最準的
    const newPlayers = JSON.parse(JSON.stringify(players.value));
    
    let logDesc = '';
    let logAmount = 0;
    const winnerName = newPlayers.find(p => p.id === winnerId)?.name || '未知';

    if (loserId === null) {
      // 自摸
      newPlayers.forEach(p => {
        if (p.id === winnerId) p.score += amount * 3;
        else p.score -= amount;
      });
      logDesc = `自摸 ${taiCount}台`;
      logAmount = amount * 3;
    } else {
      // 放槍
      const winner = newPlayers.find(p => p.id === winnerId);
      const loser = newPlayers.find(p => p.id === loserId);
      if (winner && loser) {
        winner.score += amount;
        loser.score -= amount;
        logDesc = `${loser.name} 放槍 ${taiCount}台`;
        logAmount = amount;
      }
    }

    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' }),
      winner: winnerName,
      desc: logDesc,
      amount: logAmount
    };

    // 發送給後端
    socket.value.emit('record_action', {
      roomId: roomId.value,
      log: newLog,
      updatedPlayers: newPlayers
    });
  };

  // --- Getters (計算屬性) ---

  /**
   * 視角旋轉邏輯
   * 確保「我 (myPlayerId)」永遠顯示在陣列的第一個位置 (畫面下方)
   */
  const rotatedPlayers = computed(() => {
    // 如果還沒選座位，或是資料還沒載入，就直接回傳原始列表
    if (myPlayerId.value === null || players.value.length === 0) {
      return players.value;
    }

    const myId = myPlayerId.value;
    const p = players.value;

    // 依序回傳：[自己, 下家, 對家, 上家]
    // 使用餘數運算 (%) 來處理陣列循環
    return [
      p.find(player => player.id === myId),           // 下方 (自己)
      p.find(player => player.id === (myId + 1) % 4), // 右方 (下家)
      p.find(player => player.id === (myId + 2) % 4), // 上方 (對家)
      p.find(player => player.id === (myId + 3) % 4)  // 左方 (上家)
    ];
  });

  return { 
    socket, 
    roomId, 
    myPlayerId, 
    isConnected, 
    settings, 
    players, 
    logs, 
    rotatedPlayers,
    connectAndJoin, 
    updateSettings, 
    settleRound 
  };
});