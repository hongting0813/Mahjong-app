import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io } from 'socket.io-client';
import axios from 'axios';

export const useGameStore = defineStore('game', () => {
  // --- State (資料狀態) ---
  const socket = ref(null);
  const roomId = ref(null);
  const sessionId = ref(null); // Unique Session ID (timestamp)
  const myPlayerId = ref(null); // 我選擇的座位 ID (0~3)
  // Dealer State
  const dealerId = ref(null); // ID of the current dealer
  const dealerStreak = ref(0); // Current streak count (Lian N)
  const isConnected = ref(false); // 連線狀態亮燈用
  const errorMsg = ref('');

  // 遊戲資料 (會從後端同步)
  const settings = ref({
    base: 0,
    tai: 0,
    bgColor: '#0b6623',
    // ⬇️ 新增圈風設定
    wind: {
      mode: 'auto',   // 'auto' | 'manual'
      manualValue: 'EW',
      roundsPerCircle: 16 // 預設 16 局一圈 (不含連莊的粗略估計)
    }
  });
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
    if (data.settings) settings.value = data.settings;
    if (data.players) players.value = data.players;
    if (data.logs) logs.value = data.logs;
    if (data.sessionId) sessionId.value = data.sessionId;
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

    // F. 房間被刪除
    socket.value.on('room_deleted', () => {
      alert('⚠️ 此房間已被房主刪除，將返回首頁。');
      roomId.value = null;
      window.location.href = '/'; // Force reload/redirect
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

    // ✨ 自動判斷連線網址 (支援雲端與本機切換)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const protocol = window.location.protocol; // http: 或 https:

    // 如果是本機開發，連線到 3001 埠
    // 如果是雲端部署，直接使用當前 Origin (連線到標準 443 埠)
    const socketUrl = isLocal
      ? `${protocol}//${window.location.hostname}:3001`
      : window.location.origin;

    console.log(`🚀 準備連線到後端: ${socketUrl}`);

    // 建立 Socket 連線
    if (!socket.value) {
      socket.value = io(socketUrl, {
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
   * 2.5 刪除房間
   */
  const deleteRoom = () => {
    if (!socket.value || !roomId.value) return;
    socket.value.emit('delete_room', roomId.value);
  };

  /**
   * 3. 結算/記帳
   */
  /**
   * 3. 結算/記帳
   */
  const settleRound = async (winnerId, loserId, taiCount, details, tiles) => {
    if (!socket.value) return;

    const amount = Number(settings.value.base) + (taiCount * Number(settings.value.tai));
    // 深拷貝一份玩家資料來計算，避免直接修改現有畫面導致閃爍，等待後端回傳才是最準的
    const newPlayers = JSON.parse(JSON.stringify(players.value));

    let logDesc = '';
    let logAmount = 0;
    const winnerName = newPlayers.find(p => p.id === winnerId)?.name || '未知';

    const baseAmount = amount; // 傳入的 amount 已經是 (底 + 牌型台) 的總和
    const taiAmount = Number(settings.value.tai); // 一台的金額
    const extraTai = (dealerStreak.value * 2) + 1; // 莊家加台數 (2n+1)
    const extraAmount = taiAmount * extraTai; // 莊家加台的金額

    const payments = {}; // 記錄各玩家的具體金額

    if (loserId === null) {
      // 自摸
      const isWinnerDealer = (winnerId === dealerId.value);

      newPlayers.forEach(p => {
        if (p.id === winnerId) return; // 贏家最後算

        let pPay = 0;
        if (isWinnerDealer) {
          // 1. 莊家自摸：閒家（p）都要多付一加台
          pPay = baseAmount + extraAmount;
        } else {
          // 2. 閒家自摸：只有莊家（dealerId）要多付
          pPay = (p.id === dealerId.value) ? (baseAmount + extraAmount) : baseAmount;
        }

        p.score -= pPay;
        logAmount += pPay;
        payments[p.id] = { isPaid: false, amount: -pPay };
      });

      // 贏家加總
      newPlayers.find(p => p.id === winnerId).score += logAmount;
      payments[winnerId] = { isPaid: true, amount: logAmount };
      logDesc = `自摸 ${taiCount} 台`;
    } else {
      // 放槍
      const isWinnerDealer = (winnerId === dealerId.value);
      const isLoserDealer = (loserId === dealerId.value);

      // 只要贏家或輸家中有一方是莊家，就要加台
      const pPay = (isWinnerDealer || isLoserDealer) ? (baseAmount + extraAmount) : baseAmount;

      const winner = newPlayers.find(p => p.id === winnerId);
      const loser = newPlayers.find(p => p.id === loserId);

      if (winner && loser) {
        winner.score += pPay;
        loser.score -= pPay;
        logAmount = pPay;

        payments[winnerId] = { isPaid: true, amount: pPay };
        payments[loserId] = { isPaid: false, amount: -pPay };

        // 其他玩家 0 元
        newPlayers.forEach(p => {
          if (p.id !== winnerId && p.id !== loserId) {
            payments[p.id] = { isPaid: true, amount: 0 };
          }
        });

        logDesc = `胡了 ${loser.name} ${taiCount} 台`;
      }
    }

    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      winner: winnerName,
      winnerId: winnerId, // Added for stats
      loserId: loserId,   // Added for stats
      desc: logDesc,
      amount: logAmount,
      details: details || '', // Store raw details
      tai: taiCount,
      tiles: tiles || null,    // Store tile state
      dealerId: dealerId.value,  // 儲存當時的莊家 ID
      dealerStreak: dealerStreak.value,  // 儲存當時的連莊次數
      payments: payments // 使用詳細計算後的支付記錄
    };

    // 發送給後端 Socket 同步
    socket.value.emit('record_action', {
      roomId: roomId.value,
      log: newLog,
      updatedPlayers: newPlayers
    });

    // 儲存完整戰績記錄檔 (保存為 JSON)
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrlBase = isLocal
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : window.location.origin;

      await axios.post(`${apiUrlBase}/api/save-game`, {
        roomId: roomId.value, // Added roomId
        sessionId: sessionId.value, // Added sessionId
        timestamp: new Date().toISOString(),
        winnerId,
        loserId,
        tai: taiCount,
        details,
        log: newLog,
        playersSnapshot: newPlayers
      });
      console.log("Game record saved to server.");
    } catch (e) {
      console.error("Failed to save game record", e);
    }

    // Update Dealer State for next round logic
    updateDealerLogic(winnerId);
  };

  /**
   * Dealer Logic: Determine next dealer and streak
   */
  const updateDealerLogic = (winnerId) => {
    // If no dealer set, default to player 0
    if (dealerId.value === null && players.value.length > 0) {
      dealerId.value = players.value[0].id;
      dealerStreak.value = 0;
    }

    if (winnerId === dealerId.value) {
      // Dealer wins: Streak continues
      dealerStreak.value++;
    } else {
      // Dealer loses: Next player, Reset streak
      // Find current dealer index
      const currentIdx = players.value.findIndex(p => p.id === dealerId.value);
      if (currentIdx !== -1) {
        const nextIdx = (currentIdx + 1) % players.value.length;
        dealerId.value = players.value[nextIdx].id;
      }
      dealerStreak.value = 0;
    }
  };

  const setDealer = (id, streak) => {
    dealerId.value = id;
    dealerStreak.value = streak;
  };

  /**
   * Calculate Lian/La bonus Tai for a given winner/loser
   */
  const calculateLianTai = (winnerId, loserId) => {
    if (dealerId.value === null) return 0;

    // 判斷莊家是否參與此次計分變動：
    // 1. 贏家是莊家
    // 2. 輸家是莊家 (放槍)
    // 3. 局勢為自摸 (loserId === null)，則莊家必然作為輸家之一參與
    const isDealerInvolved = (winnerId === dealerId.value) || (loserId === dealerId.value) || (loserId === null);

    if (isDealerInvolved) {
      // 連 N -> 2*N + 1
      return (dealerStreak.value * 2) + 1;
    }
    return 0;
  };

  // --- Getters (計算屬性) ---

  /**
   * 圈風判斷
   */
  const currentWind = computed(() => {
    // 1. 手動模式：直接回傳設定值
    if (settings.value.wind?.mode === 'manual') {
      return settings.value.wind.manualValue || 'EW';
    }

    // 2. 自動模式：根據 logs 數量推算
    const threshold = settings.value.wind?.roundsPerCircle || 16;
    const roundCount = logs.value.length;

    // 簡單邏輯：每 N 局換一圈
    const circleIndex = Math.floor(roundCount / threshold) % 4; // 0=E, 1=S, 2=W, 3=N
    const winds = ['EW', 'SW', 'WW', 'NW'];

    return winds[circleIndex];
  });

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

  /**
   * 切換個別玩家在某局的支付狀態 (已付現/未付現)
   */
  const togglePayment = (logId, playerId) => {
    if (!socket.value || !roomId.value) return;

    // 雖然我們可以本地先改，但為了確保狀態一致，
    // 還是發一個事件讓後端處理並廣播更新 rooms 資料。
    socket.value.emit('toggle_payment', {
      roomId: roomId.value,
      logId: logId,
      playerId: playerId
    });
  };

  /**
   * 刪除某一局歷史記錄
   */
  const deleteLog = (logId) => {
    if (!socket.value || !roomId.value) return;

    // 發送刪除事件給後端
    socket.value.emit('delete_log', {
      roomId: roomId.value,
      logId: logId
    });
  };

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
    currentWind,
    rotatedPlayers,
    connectAndJoin,
    createRoom,
    deleteRoom, // Export deleteRoom
    updateSettings,
    settleRound,
    resetState,
    dealerId,
    dealerStreak,
    setDealer,
    calculateLianTai,
    updateDealerLogic,
    togglePayment,
    deleteLog
  };
});