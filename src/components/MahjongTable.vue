<template>
  <div class="table-view" :style="{ background: store.settings.bgColor }">
    <div class="header">
      <div class="room-info">底{{ store.settings.base }} / 台{{ store.settings.tai }}</div>
      <van-button icon="qr" size="small" round @click="showQr = true">邀請</van-button>
    </div>

    <!-- 上半部：麻將桌 (固定高度/比例，佔 60%) -->
    <div class="table-area">
      <div class="mahjong-table" :style="{ transform: `scale(${tableScale})` }">
        <div class="center-zone" @click="showActionModal = true">
          <div class="center-content">
            <div class="logo">🀄️</div>
            <div>記帳</div>
          </div>
        </div>

        <div 
          v-for="(p, index) in store.rotatedPlayers" 
          :key="p.id"
          class="player-seat"
          :class="getPositionClass(index)"
        >
          <div class="avatar-wrapper" :class="{ 'winner': p.score > 0, 'loser': p.score < 0 }">
            {{ p.avatar }}
            <div class="score-badge">{{ p.score }}</div>
          </div>
          <div class="p-name">{{ p.name }}</div>
        </div>
      </div>
    </div>

    <!-- 中間：操作區 (佔 10%) -->
    <div class="action-area">
      <div class="action-btn" @click="showCamera = true">
        <van-icon name="photograph" size="20" />
        <span>AI 算台</span>
      </div>
      <div class="action-btn" @click="quickTestWin">
        <van-icon name="fire-o" size="20" />
        <span>自摸測試</span>
      </div>
    </div>

    <!-- 下半部：戰況 (佔 30%) -->
    <div class="logs-panel">
      <div class="logs-title">戰況速報</div>
      <div class="logs-list">
        <div v-for="log in store.logs" :key="log.id" class="log-item">
          <span class="time">{{ log.time }}</span>
          <span class="desc">{{ log.winner }} {{ log.desc }}</span>
          <span class="amt">+{{ log.amount }}</span>
        </div>
        <div v-if="store.logs.length === 0" class="no-logs">暫無戰況</div>
      </div>
    </div>

    <van-dialog 
      v-model:show="showQr" 
      title="掃描加入房間" 
      :show-confirm-button="false"
      close-on-click-overlay
    >
      <div class="qr-container">
        <qrcode-vue :value="joinUrl" :size="200" level="H" />
        <p style="margin: 15px 0; color: #666;">請讓朋友掃描此碼</p>
        <van-button icon="link" round size="small" @click="copyLink">複製連結</van-button>
      </div>
    </van-dialog>

    <van-action-sheet v-model:show="showActionModal" title="戰績輸入">
       <div style="padding: 20px;">
          <van-form @submit="submitScore">
            <van-cell-group inset>
                <!-- 贏家 -->
                <van-field name="winner" label="贏家">
                    <template #input>
                        <van-radio-group v-model="scoreForm.winner" direction="horizontal">
                            <van-radio v-for="p in store.players" :key="p.id" :name="p.id">{{ p.name }}</van-radio>
                        </van-radio-group>
                    </template>
                </van-field>

                <!-- 方式 -->
                <van-field name="type" label="方式">
                    <template #input>
                        <van-radio-group v-model="scoreForm.type" direction="horizontal">
                            <van-radio name="zimo">自摸</van-radio>
                            <van-radio name="ron">胡牌</van-radio>
                        </van-radio-group>
                    </template>
                </van-field>

                <!-- 放槍者 (胡牌時顯示) -->
                <van-field v-if="scoreForm.type === 'ron'" name="loser" label="放槍者" :rules="[{ required: true, message: '請選擇放槍者' }]">
                     <template #input>
                        <van-radio-group v-model="scoreForm.loser" direction="horizontal">
                            <van-radio v-for="p in loserOptions" :key="p.id" :name="p.id">{{ p.name }}</van-radio>
                        </van-radio-group>
                    </template>
                </van-field>

                <!-- 台數 -->
                <van-field v-model="scoreForm.tai" type="number" name="tai" label="台數" placeholder="輸入台數" :rules="[{ required: true, message: '請輸入台數' }]" />
                
                <!-- 詳細說明 -->
                <div v-if="scoreForm.details" style="font-size: 12px; color: #666; padding: 0 16px 10px 16px;">
                    紀錄: {{ scoreForm.details }}
                </div>
            </van-cell-group>
            
            <div style="margin: 16px;">
                <van-button round block type="primary" native-type="submit">
                確認記帳
                </van-button>
            </div>
          </van-form>
       </div>
    </van-action-sheet>

    <CameraAI 
      v-if="showCamera" 
      @close="showCamera = false" 
      @on-confirm="handleAiResult" 
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import QrcodeVue from 'qrcode.vue';
import { showToast } from 'vant';
import CameraAI from './CameraAI.vue';

const store = useGameStore();
const showQr = ref(false);
const showActionModal = ref(false);
const tableScale = ref(1);
const showCamera = ref(false);

// 產生連結 (假設跑在 Localhost)
const joinUrl = computed(() => `${window.location.origin}/?room=${store.roomId}`);

// 強化版複製功能 (支援 HTTP/IP 環境)
const copyLink = async () => {
  const text = joinUrl.value;
  
  // 1. 嘗試使用現代 API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: '已複製連結', type: 'success' });
      return;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback...');
    }
  }
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
    document.body.appendChild(textArea); textArea.focus(); textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) showToast({ message: '已複製連結', type: 'success' });
    else throw new Error('execCommand failed');
  } catch (err) {
    console.error('Copy failed', err);
    showToast({ message: '複製失敗，請手動複製', type: 'fail' });
  }
};

const getPositionClass = (index) => {
  const positions = ['seat-bottom', 'seat-right', 'seat-top', 'seat-left'];
  return positions[index];
};

const quickTestWin = () => {
  store.settleRound(store.myPlayerId, null, 1); // 測試用
  // showActionModal.value = false; // No longer needed
};

const updateScale = () => {
  const requiredWidth = 420;
  const availableWidth = window.innerWidth;
  // Reduce scale slightly to ensure bottom panel has space if screen is short
  let scale = availableWidth < requiredWidth ? availableWidth / requiredWidth : 1;
  tableScale.value = scale;
};

import { calculateTai } from '../utils/mahjongScoring.js';

const scoreForm = reactive({
  winner: null,
  type: 'zimo', // 'zimo' | 'ron'
  loser: null,
  tai: 0,
  details: '' // Store scoring breakdown
});

const loserOptions = computed(() => {
  if (!scoreForm.winner) return [];
  return store.players.filter(p => p.id !== scoreForm.winner);
});

const handleAiResult = (result) => {
  // result = { concealed: [...], exposed: [...], tai: ..., desc: [...], isZimo: bool }
  console.log("AI 結果:", result);
  
  // Pre-fill form
  scoreForm.winner = store.myPlayerId !== null ? store.myPlayerId : (store.players[0]?.id || 0);
  scoreForm.type = result.isZimo ? 'zimo' : 'ron'; // Auto-detect Zimo
  scoreForm.loser = null;
  scoreForm.tai = typeof result.tai === 'number' ? result.tai : 0;
  
  // Format details
  if (result.desc && Array.isArray(result.desc)) {
    scoreForm.details = result.desc.map(d => `${d.name}(${d.tai})`).join(', ');
  } else {
    scoreForm.details = '';
  }
  
  // Show Modal
  showActionModal.value = true;
};

const submitScore = () => {
  const winner = scoreForm.winner;
  const loser = scoreForm.type === 'zimo' ? null : scoreForm.loser;
  const tai = Number(scoreForm.tai);
  const details = scoreForm.details;
  
  if (scoreForm.type === 'ron' && loser === null) {
    showToast('請選擇放槍者');
    return;
  }
  
  store.settleRound(winner, loser, tai, details); // Pass details
  showActionModal.value = false;
  showToast('戰績已更新');
};

onMounted(() => {
  updateScale();
  window.addEventListener('resize', updateScale);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateScale);
});
</script>

<style lang="scss" scoped>
.table-view { 
  height: 100%; /* Fill parent (room-content) */
  overflow: hidden; /* Prevent page scroll */
  display: flex; 
  flex-direction: column; 
  color: white; 
  transition: background 0.3s;
}
.header { 
  flex-shrink: 0;
  padding: 10px 15px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  background: rgba(0,0,0,0.2); 
}

/* CSS Updates */
.table-area { 
  flex: 6; /* 60% height */
  position: relative; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  overflow: hidden; 
  min-height: 0; /* Important for flex scaling */
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.mahjong-table { 
  width: 320px; height: 320px; 
  background: rgba(255,255,255,0.1); 
  border: 6px solid rgba(0,0,0,0.3);
  border-radius: 20px;
  position: relative; 
  transform-origin: center center;
}

/* ... (Seat styles unchanged) ... */
.center-zone { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100px; height: 100px; border: 2px dashed rgba(255,255,255,0.4); border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; .logo { font-size: 40px; } }
.player-seat { position: absolute; display: flex; flex-direction: column; align-items: center; width: 80px; .avatar-wrapper { font-size: 40px; width: 60px; height: 60px; background: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 3px solid white; &.winner { border-color: #ee0a24; animation: pop 0.3s; } &.loser { border-color: #07c160; } .score-badge { position: absolute; bottom: -5px; right: -10px; background: #333; color: white; font-size: 12px; padding: 2px 6px; border-radius: 10px; font-weight: bold; } } .p-name { margin-top: 5px; font-size: 12px; text-shadow: 0 1px 2px black; } }
.seat-bottom { bottom: -40px; left: 50%; transform: translateX(-50%); }
.seat-top { top: -40px; left: 50%; transform: translateX(-50%); }
.seat-right { right: -40px; top: 50%; transform: translateY(-50%); }
.seat-left { left: -40px; top: 50%; transform: translateY(-50%); }

/* Middle Action Area (10%) */
.action-area {
  flex: 1; /* 10% approx */
  display: flex;
  align-items: center;
  justify-content: space-around; /* Distribute buttons */
  background: rgba(0,0,0,0.2);
  padding: 0 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255,255,255,0.15); /* Semi-transparent */
  border-radius: 20px;
  cursor: pointer;
  
  &:active { background: rgba(255,255,255,0.3); }
  
  span { font-size: 14px; font-weight: bold; }
}

/* Bottom logs panel (30%) */
.logs-panel {
  flex: 3; /* 30% height */
  display: flex;
  flex-direction: column;
  background: rgba(0,0,0,0.3);
  overflow: hidden;
  min-height: 0;
}

.logs-title {
  padding: 10px 15px;
  font-weight: bold;
  font-size: 14px;
  background: rgba(0,0,0,0.2);
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 15px;
}

.log-item { display: flex; justify-content: space-between; font-size: 13px; margin: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
.amt { color: #f1c40f; font-weight: bold; }
.no-logs { text-align: center; color: rgba(255,255,255,0.5); padding: 20px; font-size: 12px; }

.qr-container { text-align: center; padding: 20px; }
</style>