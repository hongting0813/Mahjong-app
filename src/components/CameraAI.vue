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

      <!-- 🀄️ 麻將手牌預覽區 (Hand View) -->
      <div class="hand-view-container">
        <div class="hand-row">
          <div v-for="(code, idx) in flattenedHand" :key="idx" class="hand-tile">
             <img 
               :src="`/tiles/${code}.webp`" 
               class="hand-tile-img"
               @error="(e) => e.target.style.display='none'"
             />
             <span class="hand-tile-name">{{ getTileName(code) }}</span>
             <!-- Fallback text handled by css/structure if img fails? 
                  With new design, img missing -> alt text? 
                  Actually let's keep name always visible as requested. 
             -->
          </div>
        </div>
        <div class="hand-count">共 {{ totalTiles }} 張</div>
      </div>

      <div class="tile-list">
        <div v-for="item in sortedTiles" :key="item.code" class="tile-row">
          <div class="tile-info">
             <img 
               :src="`/tiles/${item.code}.webp`" 
               class="list-tile-img"
               @error="(e) => e.target.style.display='none'"
             />
             <span class="tile-name">{{ getTileName(item.code) }}</span>
          </div>
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
          確認無誤
        </van-button>
      </div>
    </div>

    <!-- 🀄️ 補牌選擇器 (Grid Selector) -->
    <van-popup v-model:show="showPicker" position="bottom" round safe-area-inset-bottom style="height: 70%">
      <div class="picker-header">
        <h3>補牌</h3>
        <span class="close-btn" @click="showPicker = false">✕</span>
      </div>
      
      <div class="picker-content">
        <div v-for="(group, label) in TILE_GROUPS" :key="label" class="tile-group">
          <div class="group-label">{{ label }}</div>
          <div class="group-grid">
            <div 
              v-for="code in group" 
              :key="code" 
              class="grid-tile"
              @click="addTileFromPicker(code)"
            >
              <img :src="`/tiles/${code}.webp`" class="grid-img" loading="lazy" />
              <div class="grid-name">{{ getTileName(code) }}</div>
            </div>
          </div>
        </div>
      </div>
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

// --- 對照表 ---
const TILE_MAP = {
  '1C': '一萬', '2C': '二萬', '3C': '三萬', '4C': '四萬', '5C': '五萬', '6C': '六萬', '7C': '七萬', '8C': '八萬', '9C': '九萬',
  '1D': '一筒', '2D': '二筒', '3D': '三筒', '4D': '四筒', '5D': '五筒', '6D': '六筒', '7D': '七筒', '8D': '八筒', '9D': '九筒',
  '1B': '一索', '2B': '二索', '3B': '三索', '4B': '四索', '5B': '五索', '6B': '六索', '7B': '七索', '8B': '八索', '9B': '九索',
  'EW': '東風', 'SW': '南風', 'WW': '西風', 'NW': '北風',
  'RD': '紅中', 'GD': '發財', 'WD': '白板',
  '1F': '梅', '2F': '蘭', '3F': '竹', '4F': '菊',
  '1S': '春', '2S': '夏', '3S': '秋', '4S': '冬'
};

const getTileName = (c) => TILE_MAP[c] || c;

const TILE_ORDER = [
  '1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C',
  '1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B',
  'EW', 'SW', 'WW', 'NW',
  'RD', 'GD', 'WD',
  '1F', '2F', '3F', '4F', '1S', '2S', '3S', '4S'
];

// Grouping for the picker
const TILE_GROUPS = {
  '萬子': ['1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C'],
  '筒子': ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D'],
  '索子': ['1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B'],
  '字牌': ['EW', 'SW', 'WW', 'NW', 'RD', 'GD', 'WD'],
  '花牌': ['1F', '2F', '3F', '4F', '1S', '2S', '3S', '4S']
};

// --- Computed ---

// 1. Array of {code, count} sorted by standard Mahjong order
const sortedTiles = computed(() => {
  return Object.entries(detectedTiles)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => {
      let idxA = TILE_ORDER.indexOf(a.code);
      let idxB = TILE_ORDER.indexOf(b.code);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB || a.code.localeCompare(b.code);
    });
});

// 2. Flattened array containing every single tile code (e.g. ['1C', '1C', '2C'...]) for the "Hand View"
const flattenedHand = computed(() => {
  const result = [];
  sortedTiles.value.forEach(item => {
    for (let i = 0; i < item.count; i++) {
      result.push(item.code);
    }
  });
  return result;
});

const totalTiles = computed(() => flattenedHand.value.length);

// --- Methods ---

const startCamera = async () => {
  try {
    if (stream.value) stream.value.getTracks().forEach(t => t.stop());
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    await nextTick();
    if (video.value) video.value.srcObject = stream.value;
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

const handleRetake = () => {
  isReviewing.value = false;
  startCamera();
};

const captureAndCrop = async () => {
  loading.value = true;
  if (!video.value || !canvas.value) return;

  const ctx = canvas.value.getContext('2d');
  const vw = video.value.videoWidth;
  const vh = video.value.videoHeight;

  // Crop logic matching CSS .scan-area
  const cropW = vw * 0.9;
  const cropH = vh * 0.25;
  const cropX = (vw - cropW) / 2;
  const cropY = (vh - cropH) / 2;

  canvas.value.width = cropW;
  canvas.value.height = cropH;
  ctx.drawImage(video.value, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const base64 = canvas.value.toDataURL("image/jpeg", 0.8);

  try {
    const ip = window.location.hostname;
    const protocol = window.location.protocol; 
    const port = '3001';
    
    const res = await axios.post(`${protocol}//${ip}:${port}/api/predict`, { image: base64 });

    // Reset and populate
    Object.keys(detectedTiles).forEach(k => delete detectedTiles[k]);
    res.data.predictions.forEach(p => {
      if (p.confidence > 0.4) {
        const key = p.class; 
        detectedTiles[key] = (detectedTiles[key] || 0) + 1;
      }
    });
    
    stopCamera();
    isReviewing.value = true;

  } catch (e) {
    console.error(e);
    alert("辨識失敗，請檢查後端連線");
  } finally {
    loading.value = false;
  }
};

const updateCount = (code, delta) => {
  if (!detectedTiles[code]) detectedTiles[code] = 0;
  detectedTiles[code] += delta;
  if (detectedTiles[code] <= 0) delete detectedTiles[code];
};

const addTileFromPicker = (code) => {
  updateCount(code, 1);
  showPicker.value = false;
};

const confirmResult = () => {
  emit('on-confirm', flattenedHand.value); // Just emit the flattened array directly
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
  width: 90%; height: 25%;
  border: 2px solid #00ff00;
  box-shadow: 0 0 0 400px rgba(0,0,0,0.6);
  border-radius: 8px;
  display: flex; justify-content: center; align-items: flex-end;
}
.scan-label { color: #00ff00; background: rgba(0,0,0,0.6); margin-bottom: -30px; padding: 4px 8px; font-size: 14px; border-radius: 4px; }
.scan-line { position: absolute; top:0; width: 100%; height: 2px; background: #00ff00; animation: scan 2s infinite; }
@keyframes scan { 0% { top: 0; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

.controls { padding: 30px; background: #000; display: flex; flex-direction: column; gap: 15px; }
.hint { color: #999; text-align: center; font-size: 12px; margin-bottom: 5px; }

/* --- Review Mode Styles --- */
.review-mode { flex: 1; background: #f7f8fa; display: flex; flex-direction: column; min-height: 0; }
.review-header { text-align: center; padding: 10px 0 5px; color: #333; flex-shrink: 0; background: #fff; }
.review-header h3 { margin: 0; font-size: 16px; }
.review-header p { margin: 2px 0 0; font-size: 12px; color: #999; }

/* Hand View */
.hand-view-container { 
  background: #35654d; /* 傳統麻將桌綠色 */
  padding: 10px 5px;
  flex-shrink: 0;
  text-align: center;
  max-height: 30vh; /* Limit height if too many */
  overflow-y: auto;
}
.hand-row { 
  display: flex; 
  flex-wrap: wrap; 
  justify-content: center; 
  align-items: flex-start; 
  gap: 4px;
}
.hand-tile { 
  width: 36px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
}
.hand-tile-img { 
  width: 100%; 
  height: 48px; /* Fixed height for image */
  object-fit: contain; 
  filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.5)); 
  display: block;
}
.hand-tile-name {
  color: #fff;
  font-size: 10px;
  margin-top: 2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
.hand-tile-fallback { color: white; font-size: 10px; line-height: 48px; }
.hand-count { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 5px; width: 100%; }

/* List View */
.tile-list { flex: 1; overflow-y: auto; background: white; padding: 10px; }
.tile-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
.tile-info { display: flex; align-items: center; gap: 10px; }
.list-tile-img { height: 40px; width: auto; object-fit: contain; }
.tile-name { font-size: 16px; font-weight: bold; color: #333; }

.tile-stepper { display: flex; align-items: center; gap: 10px; }
.count-num { font-weight: bold; font-size: 18px; width: 25px; text-align: center; color: #333; }
.empty-msg { text-align: center; padding: 30px 0; color: #999; }
.add-btn-area { padding: 10px 20px; background: #fff; }
.review-actions { padding: 10px 20px 20px; background: #fff; display: flex; gap: 10px; }

/* Picker (Popup) Styles */
.picker-header { display: flex; justify-content: center; align-items: center; padding: 15px; border-bottom: 1px solid #eee; position: relative; }
.close-btn { position: absolute; right: 15px; font-size: 20px; color: #999; cursor: pointer; padding: 5px; }
.picker-content { padding: 10px; overflow-y: auto; height: calc(100% - 60px); }

.tile-group { margin-bottom: 20px; }
.group-label { font-size: 14px; color: #666; margin-bottom: 8px; font-weight: bold; padding-left: 5px; border-left: 3px solid #1989fa; }
.group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 10px; }
.grid-tile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 5px; border-radius: 4px; border: 1px solid #eee; background: #fafafa; cursor: pointer; }
.grid-tile:active { background: #e0e0e0; }
.grid-img { width: 100%; height: auto; object-fit: contain; }
.grid-name { font-size: 10px; color: #666; }
</style>