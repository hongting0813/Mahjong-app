import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io } from 'socket.io-client';

export const useGameStore = defineStore('game', () => {
  // --- State (資料狀態) ---
  const socket = ref(null);
  const roomId = ref(null);
  const myPlayerId = ref(null); // 我選擇的座位 ID (0~3)
  const isConnected = ref(false); // 連線狀態亮燈用
  const errorMsg = ref('');

  // 遊戲資料 (會從後端同步)
  const settings = ref({ base: 0, tai: 0, bgColor: '#0b6623' });
  const players = ref([]); // 原始順序的玩家列表
  const logs = ref([]);

  // 內部變數
  let isCreating = false;
  let pendingRoomId = null;

  // --- Actions (動作) ---

  // 同步資料的輔助函式
  const syncData = (data) => {
    if (!data) return;
    if (data.settings) settings.value = data.settings;
    if (data.players) players.value = data.players;
    if (data.logs) logs.value = data.logs;
  };

  const setupSocketListeners = () => {
    // 移除舊的監聽器，避免重複
    if (socket.value) {
      socket.value.off('connect');
      socket.value.off('connect_error');
      socket.value.off('error');
      socket.value.off('init_state');
      socket.value.off('state_updated');
      socket.value.off('disconnect');
    }

    // A. 連線成功
    socket.value.on('connect', () => {
      console.log(`✅ Socket 連線成功！ID: ${socket.value.id}`);
      isConnected.value = true;

      const targetRoom = pendingRoomId || roomId.value;

      // 連線後執行動作
      if (isCreating) {
        console.log(`正在建立房間: ${targetRoom}`);
        socket.value.emit('create_room', targetRoom);
      } else {
        console.log(`正在加入房間: ${targetRoom}`);
        socket.value.emit('join_room', targetRoom);
      }
    });

    // B. 連線錯誤
    socket.value.on('connect_error', (err) => {
      console.error(`❌ 連線失敗: ${err.message}`);
      isConnected.value = false;
      errorMsg.value = `連線失敗: ${err.message}`;
      pendingRoomId = null;
    });

    // B2. 業務邏輯錯誤 (如房間不存在)
    socket.value.on('error', (msg) => {
      console.error(`❌ 伺服器錯誤: ${msg}`);
      errorMsg.value = msg;

      // 如果是房間不存在，清空 roomId 以便 UI 處理
      if (msg === 'Room not found') {
        roomId.value = null;
        pendingRoomId = null;
      }
    });

    // C. 接收初始化資料 (剛進房時)
    socket.value.on('init_state', (data) => {
      console.log('📦 收到房間資料:', data);
      syncData(data);
      errorMsg.value = ''; // 清除錯誤

      // 確認加入成功，更新 roomId
      if (pendingRoomId) {
        roomId.value = pendingRoomId;
        pendingRoomId = null;
      }
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

  const _connect = (room, creating = false) => {
    isCreating = creating;
    pendingRoomId = room;
    errorMsg.value = ''; // 重置錯誤訊息

    // 如果已經連線過且 Socket 活著，且是同一個房間 (或沒有換房)
    if (socket.value && socket.value.connected) {
      if (creating) {
        socket.value.emit('create_room', room);
      } else {
        socket.value.emit('join_room', room);
      }
      return;
    }

    // ✨ 自動判斷連線網址
    const currentDomain = window.location.hostname;
    const socketUrl = `https://${currentDomain}:3001`;

    console.log(`🚀 準備連線到後端: ${socketUrl}`);

    // 建立 Socket 連線
    if (!socket.value) {
      socket.value = io(socketUrl, {
        transports: ['websocket'], // 強制使用 WebSocket，減少 CORS 問題
        reconnectionAttempts: 5    // 斷線重試 5 次
      });
    } else {
      socket.value.connect();
    }

    // --- 監聽 Socket 事件 ---
    setupSocketListeners();
  };

  /**
   * 1. 連線並加入房間
   * @param {string} room - 房號
   */
  const connectAndJoin = (room) => {
    _connect(room, false);
  };

  /**
   * 1.5 連線並建立房間
   * @param {string} room - 房號
   */
  const createRoom = (room) => {
    _connect(room, true);
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
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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

  // 4. 重置狀態 (離開房間回到首頁時)
  const resetState = () => {
    roomId.value = null;
    myPlayerId.value = null;
    players.value = [];
    logs.value = [];
    errorMsg.value = '';
    isConnected.value = false;
    // 如果需要斷開 socket，也可以在這裡做，或保持連線
    // socket.value?.disconnect(); 
    // 通常保持連線沒關係，但業務邏輯要清空
  };

  return {
    socket,
    roomId,
    myPlayerId,
    isConnected,
    errorMsg,
    settings,
    players,
    logs,
    rotatedPlayers,
    connectAndJoin,
    createRoom,
    updateSettings,
    settleRound,
    resetState
  };
});