<template>
  <div class="camera-wrapper">
    
    <div v-if="!isReviewing" class="capture-mode">
      <div class="video-container">
        <video ref="video" autoplay playsinline muted class="camera-view"></video>
        <canvas ref="canvas" style="display: none;"></canvas>
        
        <div class="scan-area">
          <div class="scan-line"></div>
          <div class="scan-label">請將麻將放入框內</div>
        </div>
      </div>

      <div class="controls">
        <p class="hint">請保持光線充足，避免反光</p>
        <van-button 
          type="primary" round icon="photograph" size="large" 
          :loading="loading" loading-text="AI 識別中..." 
          @click="captureAndCrop"
        >
          拍照辨識
        </van-button>
        <van-button plain round type="default" size="large" @click="$emit('close')">關閉</van-button>
      </div>
    </div>

    <div v-else class="review-mode">
      <div class="review-header">
        <h3>🧐 請核對牌型</h3>
        <p>AI 可能眼花，請手動增減</p>
      </div>

      <div class="tile-list">
        <div v-for="item in sortedTiles" :key="item.code" class="tile-row">
          <div class="tile-name">{{ getTileName(item.code) }}</div>
          <div class="tile-stepper">
            <van-button size="mini" icon="minus" plain type="warning" @click="updateCount(item.code, -1)" />
            <span class="count-num">{{ item.count }}</span>
            <van-button size="mini" icon="plus" plain type="primary" @click="updateCount(item.code, 1)" />
          </div>
        </div>
        <div v-if="sortedTiles.length === 0" class="empty-msg">
          ⚠️ 沒抓到牌，請按下方按鈕補牌
        </div>
      </div>

      <div class="add-btn-area">
        <van-button icon="plus" block plain type="primary" @click="showPicker = true">
          補一張沒抓到的牌
        </van-button>
      </div>

      <div class="review-actions">
        <van-button size="large" @click="handleRetake">重拍</van-button>
        <van-button type="danger" size="large" @click="confirmResult">
          確認無誤 ({{ totalTiles }}張)
        </van-button>
      </div>
    </div>

    <van-popup v-model:show="showPicker" position="bottom" round>
      <van-picker
        title="選擇麻將"
        :columns="pickerColumns"
        @confirm="onAddTile"
        @cancel="showPicker = false"
      />
    </van-popup>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import axios from 'axios';

const emit = defineEmits(['close', 'on-confirm']);

// --- 變數 ---
const video = ref(null);
const canvas = ref(null);
const stream = ref(null);
const loading = ref(false);
const isReviewing = ref(false);
const showPicker = ref(false);
const detectedTiles = reactive({});

// --- 對照表 (Roboflow Code -> 中文) ---
const TILE_MAP = {
  // --- 萬子 (Characters) - C ---
  '1C': '一萬', '2C': '二萬', '3C': '三萬', '4C': '四萬', '5C': '五萬', 
  '6C': '六萬', '7C': '七萬', '8C': '八萬', '9C': '九萬',

  // --- 筒子 (Dots) - D ---
  '1D': '一筒', '2D': '二筒', '3D': '三筒', '4D': '四筒', '5D': '五筒', 
  '6D': '六筒', '7D': '七筒', '8D': '八筒', '9D': '九筒',

  // --- 索子 (Bamboos) - B ---
  '1B': '一索', '2B': '二索', '3B': '三索', '4B': '四索', '5B': '五索', 
  '6B': '六索', '7B': '七索', '8B': '八索', '9B': '九索',

  // --- 風牌 (Winds) ---
  'EW': '東風', // East Wind
  'SW': '南風', // South Wind
  'WW': '西風', // West Wind
  'NW': '北風', // North Wind

  // --- 三元牌 (Dragons) ---
  'RD': '紅中', // Red Dragon
  'GD': '發財', // Green Dragon
  'WD': '白板', // White Dragon

  // --- 花牌 (Flowers) - F ---
  // 通常順序是：梅(1)、蘭(2)、竹(3)、菊(4)
  '1F': '花牌(梅)', 
  '2F': '花牌(蘭)', 
  '3F': '花牌(竹)', 
  '4F': '花牌(菊)',

  // --- 季節牌 (Seasons) - S ---
  // 通常順序是：春(1)、夏(2)、秋(3)、冬(4)
  '1S': '花牌(春)', 
  '2S': '花牌(夏)', 
  '3S': '花牌(秋)', 
  '4S': '花牌(冬)'
};

const pickerColumns = Object.entries(TILE_MAP).map(([k, v]) => ({ text: v, value: k }));
const getTileName = (c) => TILE_MAP[c] || c;

const TILE_ORDER = [
  '1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C',
  '1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B',
  'EW', 'SW', 'WW', 'NW',
  'RD', 'GD', 'WD',
  '1F', '2F', '3F', '4F', '1S', '2S', '3S', '4S'
];

const sortedTiles = computed(() => {
  return Object.entries(detectedTiles)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => {
      let idxA = TILE_ORDER.indexOf(a.code);
      let idxB = TILE_ORDER.indexOf(b.code);
      // 如果找不到 (可能是舊代號)，放在最後
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB || a.code.localeCompare(b.code);
    });
});

const totalTiles = computed(() => Object.values(detectedTiles).reduce((a, b) => a + b, 0));

// --- 功能 ---

// 1. 啟動相機
const startCamera = async () => {
  try {
    if (stream.value) {
        stream.value.getTracks().forEach(t => t.stop());
    }
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    // 等待 DOM 更新確保 video 存在
    await nextTick();
    if (video.value) {
        video.value.srcObject = stream.value;
    }
  } catch (e) {
    console.error(e);
    alert("無法啟動相機 (請確認 HTTPS 或 Localhost)");
    emit('close');
  }
};

const stopCamera = () => {
    if (stream.value) {
        stream.value.getTracks().forEach(t => t.stop());
        stream.value = null;
    }
};

// 重拍
const handleRetake = () => {
    isReviewing.value = false;
    startCamera();
};

// 2. 拍照 + 裁切 + 上傳
const captureAndCrop = async () => {
  loading.value = true;
  const ctx = canvas.value.getContext('2d');
  const vw = video.value.videoWidth;
  const vh = video.value.videoHeight;

  // ⚠️ 裁切邏輯：必須對應 CSS 的 .scan-area (寬90%, 高25%, 置中)
  const cropW = vw * 0.9;
  const cropH = vh * 0.25;
  const cropX = (vw - cropW) / 2;
  const cropY = (vh - cropH) / 2;

  canvas.value.width = cropW;
  canvas.value.height = cropH;
  ctx.drawImage(video.value, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const base64 = canvas.value.toDataURL("image/jpeg", 0.8);

  try {
    // 自動抓目前 IP
    const ip = window.location.hostname;
    // 使用當前 protocol，以支援 https
    const protocol = window.location.protocol; 
    const port = '3001';
    
    // 如果是 https，後端應該也要是 https (假設已經設定好)
    const res = await axios.post(`${protocol}//${ip}:${port}/api/predict`, { image: base64 });

    // 清空並填入新資料
    Object.keys(detectedTiles).forEach(k => delete detectedTiles[k]);
    res.data.predictions.forEach(p => {
      // 信心度過濾
      if (p.confidence > 0.4) {
        // Roboflow 回傳的 class 通常對應 TILE_MAP key
        const key = p.class; 
        detectedTiles[key] = (detectedTiles[key] || 0) + 1;
      }
    });
    
    stopCamera(); // 拍照後先關相機省電
    isReviewing.value = true;

  } catch (e) {
    console.error(e);
    alert("辨識失敗，請檢查後端連線");
  } finally {
    loading.value = false;
  }
};

// 3. 增減數量
const updateCount = (code, delta) => {
  if (!detectedTiles[code]) detectedTiles[code] = 0;
  detectedTiles[code] += delta;
  if (detectedTiles[code] <= 0) delete detectedTiles[code];
};

// 4. 補牌
const onAddTile = ({ selectedOptions }) => {
  updateCount(selectedOptions[0].value, 1);
  showPicker.value = false;
};

// 5. 確認回傳
const confirmResult = () => {
  // 轉回陣列 ['1w', '1w', '2t']
  const result = [];
  Object.entries(detectedTiles).forEach(([code, count]) => {
    for(let i=0; i<count; i++) result.push(code);
  });
  emit('on-confirm', result);
  emit('close');
};

onMounted(startCamera);
onUnmounted(stopCamera);
</script>

<style scoped>
.camera-wrapper { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 9999; display: flex; flex-direction: column; }
.capture-mode { height: 100%; display: flex; flex-direction: column; }
.video-container { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.camera-view { width: 100%; height: 100%; object-fit: cover; }

/* 🟩 綠框樣式 */
.scan-area {
  position: absolute;
  width: 90%; height: 25%; /* 這裡要跟 JS 裁切比例一致 */
  border: 2px solid #00ff00;
  box-shadow: 0 0 0 400px rgba(0,0,0,0.6); /* 遮罩效果 */
  border-radius: 8px;
  display: flex; justify-content: center; align-items: flex-end;
}
.scan-label { color: #00ff00; background: rgba(0,0,0,0.6); margin-bottom: -30px; padding: 4px 8px; font-size: 14px; border-radius: 4px; }
.scan-line { position: absolute; top:0; width: 100%; height: 2px; background: #00ff00; animation: scan 2s infinite; }
@keyframes scan { 0% { top: 0; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

.controls { padding: 30px; background: #000; display: flex; flex-direction: column; gap: 15px; }
.hint { color: #999; text-align: center; font-size: 12px; margin-bottom: 5px; }

.review-mode { flex: 1; background: #f7f8fa; padding: 20px; display: flex; flex-direction: column; min-height: 0; /* Important for inner scroll */ }
.review-header { text-align: center; margin-bottom: 20px; color: #333; flex-shrink: 0; }
.tile-list { flex: 1; overflow-y: auto; background: white; border-radius: 12px; padding: 10px; min-height: 0; }
.tile-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
.tile-name { font-size: 18px; font-weight: bold; color: #0b6623; }
.tile-stepper { display: flex; align-items: center; gap: 10px; }
.count-num { font-weight: bold; font-size: 18px; width: 25px; text-align: center; color: #333; /* Explicit color */ }
.empty-msg { text-align: center; padding: 30px 0; color: #999; }
.add-btn-area { margin: 15px 0; }
.review-actions { display: flex; gap: 10px; }
</style>