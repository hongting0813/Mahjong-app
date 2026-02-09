<template>
  <div class="camera-wrapper">
    
    <canvas ref="canvas" style="display: none;"></canvas>
    <div v-if="!isReviewing && !isCropping" class="capture-mode"
      @mousemove="handleScanResizeMove"
      @mouseup="handleScanResizeEnd"
      @mouseleave="handleScanResizeEnd"
      @touchmove="handleScanResizeMove"
      @touchend="handleScanResizeEnd"
    >
      <div class="video-container" ref="videoContainer">
        <video ref="video" autoplay playsinline muted class="camera-view"></video>
        <input type="file" ref="fileInput" accept="image/*" style="display: none" @change="handleFileUpload">
        
        <!-- Adjustable Scan Area -->
        <div class="scan-area" :style="{ height: scanHeightPercent + '%' }">
          <div class="scan-line"></div>
          <div class="scan-label">請將麻將放入框內</div>
          
          <!-- Resize Handle -->
          <div class="resize-handle" 
            @mousedown.stop="startScanResize" 
            @touchstart.stop="startScanResize"
          ></div>
        </div>
      </div>

      <div class="controls">
        <p class="hint">拖曳下方白條調整掃描範圍</p>
        <van-button 
          round icon="photograph" size="large" color="#4cb944"
          :loading="loading" loading-text="AI 識別中..." 
          @click="captureAndCrop"
        >
          拍照辨識
        </van-button>
        <van-button 
          round icon="photo" size="large" color="#6b9ac4"
          :disabled="loading"
          @click="triggerFileInput"
          style="font-weight: bold;"
        >
          相簿選取
        </van-button>
        <van-button 
            round size="large" icon="edit" color="#7a7978"
            @click="enterManualMode"
            style="font-weight: bold;"
        >
            手動輸入
        </van-button>
        <van-button plain round type="default" size="large" @click="$emit('close')">關閉</van-button>
        <div style="text-align: center; margin-top: 5px;">
           <span @click="showLogImport = true" style="font-size: 12px; color: #666; text-decoration: underline; cursor: pointer;">匯入除錯紀錄</span>
        </div>
      </div>
    </div>

    <!-- Cropping Mode -->
    <div v-else-if="isCropping" class="crop-mode" 
      @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd"
      @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
    >
      <div class="crop-container" ref="cropContainer">
        <img :src="cropImgSrc" class="crop-image" :style="cropStyle" ref="cropImg" @load="initCropState" />
        <div class="scan-area overlay-guide" :style="{ height: boxHeight + 'px' }">
          <div class="scan-label">拖曳與縮放圖片 / 拖曳白條調整框高</div>
          <div class="resize-handle" 
            @mousedown.stop="startResize" @touchstart.stop="startResize"
          ></div>
        </div>
      </div>
      <div class="controls">
        <p class="hint">雙指縮放，單指拖曳</p>
        <van-button type="primary" round size="large" @click="confirmCrop">確認裁切</van-button>
        <van-button plain type="default" round size="large" @click="cancelCrop">取消</van-button>
      </div>
    </div>

    <!-- Review Mode -->
    <div v-else class="review-mode">
      <div class="review-header">
        <h3 v-if="isManualMode">🛠 手動算台模式</h3>
        <h3 v-else>🧐 請核對牌型</h3>
        <p>點擊切換區域 • 上滑丟棄刪除</p>
      </div>

      <!-- 🀄️ 麻將手牌預覽區 (Hand View) -->
      <div class="hand-view-section">
        
        <!-- 明牌區 (Exposed) - Top -->
        <div class="section-container exposed-container">
          <div class="section-label">📢 明牌 / 鳴牌區 - {{ exposedTiles.length }}張</div>
          <div class="hand-view-area exposed-area">
             <div class="hand-row">
              <div 
                v-for="(tile, idx) in exposedTiles" 
                :key="tile.id" 
                class="hand-tile exposed-tile"
                @click="toggleTileStatus(tile.id)"
                @touchstart="(e) => handleTileTouchStart(e, tile.id)"
                @touchmove="(e) => handleTileTouchMove(e, tile.id)"
                @touchend="handleTileTouchEnd"
              >
                 <img 
                   :src="`/tiles/${tile.code}.webp`" 
                   class="hand-tile-img"
                   @error="(e) => e.target.style.display='none'"
                 />
                 <span class="hand-tile-name">{{ getTileName(tile.code) }}</span>
              </div>
            </div>
            <div v-if="exposedTiles.length === 0" class="empty-hint">無明牌</div>
            
            <van-button 
               icon="plus" 
               round 
               size="mini" 
               class="add-btn-corner"
               @click="openPicker('exposed')"
            />
          </div>
        </div>

        <!-- 暗牌區 (Concealed) - Bottom -->
        <div class="section-container concealed-container">
          <div class="section-label">👋 手牌 (暗牌) - {{ concealedTiles.length }}張</div>
          <div class="hand-view-area concealed-area">
            <div class="hand-row">
              <div 
                v-for="(tile, idx) in concealedTiles" 
                :key="tile.id" 
                class="hand-tile"
                @click="toggleTileStatus(tile.id)"
                @touchstart="(e) => handleTileTouchStart(e, tile.id)"
                @touchmove="(e) => handleTileTouchMove(e, tile.id)"
                @touchend="handleTileTouchEnd"
              >
                 <img 
                   :src="`/tiles/${tile.code}.webp`" 
                   class="hand-tile-img"
                   @error="(e) => e.target.style.display='none'"
                 />
                 <span class="hand-tile-name">{{ getTileName(tile.code) }}</span>
              </div>
            </div>
            <div v-if="concealedTiles.length === 0" class="empty-hint">無暗牌</div>

             <van-button 
               icon="plus" 
               round 
               size="mini" 
               type="success"
               class="add-btn-corner"
               @click="openPicker('concealed')"
            />
          </div>
        </div>

      </div>

      <div class="review-actions">
        <van-button size="large" @click="handleRetake">
            {{ isManualMode ? '清空' : '重拍' }}
        </van-button>
        <van-button v-if="isManualMode" size="large" @click="exitManualMode">離開模式</van-button>
        <van-button type="danger" size="large" @click="confirmResult">
          {{ isManualMode ? '計算台數' : '確認無誤' }}
        </van-button>
      </div>
    </div>

    <!-- 🀄️ 補牌選擇器 (Grid Selector) -->
    <van-popup v-model:show="showPicker" position="bottom" round safe-area-inset-bottom style="height: 70%">
      <div class="picker-header">
        <h3>補牌 (加入{{ targetSection === 'concealed' ? '暗牌' : '明牌' }})</h3>
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

    <!-- 📊 台數計算預覽 Popup (Full Page) -->
    <van-popup v-model:show="showResultPreview" position="bottom" style="height: 100%; width: 100%; padding: 0;">
      <div class="preview-container">
        
        <!-- Header -->
        <div class="preview-header">
           <div class="header-left">
             <van-icon name="arrow-left" size="20" @click="showResultPreview = false" />
             <h2>台數計算預覽</h2>
           </div>
        </div>

        <!-- Scrollable Content -->
        <div class="preview-content">
            
            <!-- 牌型檢視 (新增) -->
            <div class="preview-tiles-section">
                <div class="preview-label">明牌 / 鳴牌</div>
                <div class="preview-tiles-row">
                    <div v-for="t in exposedTiles" :key="t.id" class="mini-tile">
                        <img :src="`/tiles/${t.code}.webp`" />
                    </div>
                </div>
                <div class="preview-label">
                    手牌 (請點擊 <span style="color: #ee0a24; font-weight: bold;">胡的那張</span> 以精確計算獨聽台數)
                </div>
                <div class="preview-tiles-row">
                    <div 
                        v-for="t in concealedTiles" 
                        :key="t.id" 
                        class="mini-tile clickable-tile"
                        :class="{ 'winning-tile': winningTileId === t.id }"
                        @click="setWinningTile(t.id)"
                    >
                        <img :src="`/tiles/${t.code}.webp`" />
                        <div v-if="winningTileId === t.id" class="winning-badge">胡</div>
                    </div>
                </div>
            </div>

            <div class="divider"></div>

            <!-- 計算結果 -->
            <div class="score-display">
                <span class="total-tai">{{ calculationResult.tai }} 台</span>
                <span class="valid-status" :class="{ invalid: !calculationResult.isValid }">
                    {{ calculationResult.isValid ? '胡牌' : '未胡牌' }}
                </span>
            </div>

            <div class="preview-settings">
                <!-- Winds Side-by-Side (4x1 Grid) -->
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <!-- Round Wind -->
                    <div style="flex: 1; background: #f8f8f8; padding: 10px; border-radius: 8px; text-align: center;">
                        <div @click="showWindHelp('round')" style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px; cursor: pointer;">
                            <span style="font-weight: bold; font-size: 15px; color: #333;">圈風</span>
                            <van-icon name="question-o" style="margin-left: 4px; color: #999;" />
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.roundWind === 'EW' ? 'primary' : 'default'" @click="previewSettings.roundWind = 'EW'; runCalculation()">東</van-button>
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.roundWind === 'SW' ? 'primary' : 'default'" @click="previewSettings.roundWind = 'SW'; runCalculation()">南</van-button>
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.roundWind === 'WW' ? 'primary' : 'default'" @click="previewSettings.roundWind = 'WW'; runCalculation()">西</van-button>
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.roundWind === 'NW' ? 'primary' : 'default'" @click="previewSettings.roundWind = 'NW'; runCalculation()">北</van-button>
                        </div>
                    </div>

                    <!-- Seat Wind -->
                    <div style="flex: 1; background: #f8f8f8; padding: 10px; border-radius: 8px; text-align: center;">
                        <div @click="showWindHelp('seat')" style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px; cursor: pointer;">
                            <span style="font-weight: bold; font-size: 15px; color: #333;">門風</span>
                            <van-icon name="question-o" style="margin-left: 4px; color: #999;" />
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.seatWind === 'EW' ? 'primary' : 'default'" @click="previewSettings.seatWind = 'EW'; runCalculation()">東</van-button>
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.seatWind === 'SW' ? 'primary' : 'default'" @click="previewSettings.seatWind = 'SW'; runCalculation()">南</van-button>
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.seatWind === 'WW' ? 'primary' : 'default'" @click="previewSettings.seatWind = 'WW'; runCalculation()">西</van-button>
                            <van-button size="small" style="padding: 0 4px;" :type="previewSettings.seatWind === 'NW' ? 'primary' : 'default'" @click="previewSettings.seatWind = 'NW'; runCalculation()">北</van-button>
                        </div>
                    </div>
                </div>

                <!-- 情境 (Vertical Layout) -->
                <div class="setting-row" style="flex-direction: column; align-items: flex-start;">
                    <div @click="showScenarioHelp" style="display: flex; align-items: center; margin-bottom: 10px; width: 100%;">
                        <span style="font-weight: bold; font-size: 16px; color: #333;">情境</span>
                        <van-icon name="question-o" style="margin-left: 6px; color: #999;" />
                    </div>
                    
                    <!-- Common Scenarios Grid (Full Width) -->
                    <div style="width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                        <van-button size="small" :type="previewSettings.isZimo ? 'danger' : 'default'" @click="previewSettings.isZimo = !previewSettings.isZimo; runCalculation()">自摸</van-button>
                        <van-button size="small" :type="previewSettings.isGangShang ? 'danger' : 'default'" @click="previewSettings.isGangShang = !previewSettings.isGangShang; runCalculation()">槓上</van-button>
                        <van-button size="small" :type="previewSettings.isLastTile ? 'danger' : 'default'" @click="previewSettings.isLastTile = !previewSettings.isLastTile; runCalculation()">海底</van-button>
                        <van-button size="small" :type="previewSettings.isTianTing ? 'danger' : 'default'" @click="handleTianTingToggle">天聽</van-button>
                        <van-button size="small" :type="previewSettings.isTianHu ? 'danger' : 'default'" @click="handleTianHuToggle">天胡</van-button>
                         <van-button size="small" :type="previewSettings.isDiHu ? 'danger' : 'default'" @click="handleDiHuToggle">地胡</van-button>
                    </div>
                    <!-- Wizard Button -->
                    <van-button icon="question-o" plain size="small" type="primary" @click="startWizard" round block>
                       問答小幫手
                    </van-button>
                </div>
            </div>

            <!-- 計算依據 -->
            <!-- 計算依據 -->
            <div class="desc-section">
                <h3>計算依據 (點擊可看說明)</h3>
                <div class="desc-list">
                    <div v-for="(d, i) in calculationResult.desc" :key="i" class="desc-item" @click="showRuleDesc(d)">
                        <span class="desc-name">
                             <van-icon name="info-o" style="margin-right: 4px; color: #1989fa; vertical-align: middle;" />
                             {{ d.name }}
                        </span>
                        <span class="desc-tai">{{ d.tai }} 台</span>
                    </div>
                    <div v-if="calculationResult.desc.length === 0" class="desc-empty">無特定台數</div>
                    <div v-if="!calculationResult.isValid" class="desc-error">⚠️ 牌型未胡牌 ({{ calculationResult.reason }})</div>
                </div>
            </div>

            <div class="action-footer">
                <van-button block round type="danger" @click="finalizeResult" style="margin-bottom: 10px;">
                    確認送出
                </van-button>
                <van-button block round plain type="primary" @click="showResultPreview = false" class="return-btn">
                    返回修改
                </van-button>
                <div style="text-align: center; margin-top: 10px;">
                    <span @click="reportIssue" style="font-size: 12px; color: #999; text-decoration: underline; cursor: pointer;">
                        回報牌型問題
                    </span>
                </div>
            </div>
        </div>
      </div>
    </van-popup>

    <!-- Rule Description Dialog -->
    <van-dialog v-model:show="showDescDialog" :title="currentDesc.name">
        <div style="padding: 20px; text-align: left; font-size: 16px; color: #333; line-height: 1.6; white-space: pre-wrap;">
            {{ currentDesc.text }}
        </div>
    </van-dialog>
    <!-- Wizard Dialog -->
    <van-dialog v-model:show="wizardState.show" :title="wizardState.title" :show-cancel-button="false" :show-confirm-button="false">
        <div style="padding: 24px; text-align: center;">
            <p style="font-size: 18px; margin-bottom: 24px; color: #333; font-weight: bold;">{{ wizardState.question }}</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <van-button round block type="danger" @click="handleWizardAnswer(true)">是</van-button>
                <van-button round block type="default" @click="handleWizardAnswer(false)">否</van-button>
            </div>
        </div>
    </van-dialog>

    <!-- Report Issue Dialog -->
    <van-dialog v-model:show="showReportDialog" title="回報牌型問題" show-cancel-button @confirm="submitReport">
        <div style="padding: 20px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">請告訴我們正確的台數，協助我們改進演算法。</p>
            <van-field v-model="reportForm.correctTai" label="正確台數" type="digit" placeholder="例如: 8" border style="margin-bottom: 10px; border: 1px solid #eee; border-radius: 4px;" />
            <van-field v-model="reportForm.note" label="備註說明" type="textarea" placeholder="描述問題 (例如: 應該是碰碰胡...)" rows="2" autosize border style="border: 1px solid #eee; border-radius: 4px;" />
        </div>
    </van-dialog>

    <!-- Import Log Dialog -->
    <van-dialog v-model:show="showLogImport" title="匯入除錯紀錄" :show-confirm-button="false" show-cancel-button close-on-click-overlay>
        <div style="padding: 20px; max-height: 400px; overflow-y: auto;">
            <div v-if="reportList.length === 0" style="text-align: center; color: #999; padding: 20px;">
                無回報紀錄 <br>
                <van-button size="small" type="primary" @click="fetchReports" style="margin-top: 10px;">重新整理</van-button>
            </div>
            <van-cell-group v-else title="點擊選擇紀錄還原">
                <van-cell 
                    v-for="item in reportList" 
                    :key="item.filename" 
                    is-link 
                    center
                    @click="loadReportFromServer(item.filename)"
                >
                    <template #title>
                        <div style="font-weight: bold; font-size: 15px; color: #333; display: flex; align-items: center; gap: 8px;">
                            <span>{{ item.note || '無備註說明' }}</span>
                            <van-tag v-if="item.correctTai" type="danger" plain size="mini">{{ item.correctTai }}台</van-tag>
                        </div>
                    </template>
                    <template #label>
                        <div style="font-size: 12px; color: #999; margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
                            <span>📄 {{ item.filename }}</span>
                            <span>🕒 {{ formatTime(item.timestamp) }}</span>
                        </div>
                    </template>
                </van-cell>
            </van-cell-group>
            
            <van-divider>或手動貼上</van-divider>
            <van-field v-model="logJsonInput" type="textarea" placeholder="JSON 內容..." rows="2" border style="border: 1px solid #eee;" />
            <van-button block type="default" size="small" @click="handleLogImport" :disabled="!logJsonInput" style="margin-top: 5px;">手動匯入</van-button>
        </div>
    </van-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import axios from 'axios';
import { useGameStore } from '../stores/gameStore';
import { calculateTai, RULE_DESCRIPTIONS } from '../utils/mahjongScoring';

const props = defineProps(['initialData']);
const emit = defineEmits(['close', 'on-confirm']);
const store = useGameStore();

// --- 變數 ---
const video = ref(null);
const videoContainer = ref(null); 
const canvas = ref(null);
const fileInput = ref(null);
const stream = ref(null);
const loading = ref(false);
const isReviewing = ref(false);
const showPicker = ref(false);
const targetSection = ref('concealed'); // Tracks where to add new tiles

const tiles = ref([]); 

// --- Manual Mode & Scoring State ---
const isManualMode = ref(false);



// Scan Height State
const scanHeightPercent = ref(25); // Default 25%
const isResizingScan = ref(false);
let startScanY = 0;
let initialScanHeight = 0;

const isCropping = ref(false);
const cropImgSrc = ref('');
const cropTransform = reactive({ x: 0, y: 0, scale: 1 });
const cropContainer = ref(null);
const cropImg = ref(null);
const boxHeight = ref(200); // Default height

// Interaction state (Crop)
let startX = 0, startY = 0, initialX = 0, initialY = 0;
let initialDist = 0, initialScale = 1;
let isDragging = false;
let isResizing = false;
let startResizeY = 0;
let initialHeight = 0;

// Interaction state (Tile Swipe)
let tileStartX = 0, tileStartY = 0;
let activeTileId = null;
let isSwipingTile = false;

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

// --- Computed ---

const concealedTiles = computed(() => smartSort(tiles.value.filter(t => t.status === 'concealed'), false));
const exposedTiles = computed(() => smartSort(tiles.value.filter(t => t.status === 'exposed'), true));

// Identify the "Suit" or "Type"
const getSuit = (code) => {
  if (code.endsWith('C')) return 'C'; // Characters (萬)
  if (code.endsWith('D')) return 'D'; // Dots (筒)
  if (code.endsWith('B')) return 'B'; // Bamboo (索)
  if (['EW', 'SW', 'WW', 'NW', 'RD', 'GD', 'WD'].includes(code)) return 'Zi'; // Honors (字)
  return 'Hua'; // Flowers (花)
};

// Smart Sort: Preserves group order (X-axis), but sorts within the group (same suit)
const smartSort = (list, preserveMelds = false) => {
  if (!list.length) return [];
  
  // 1. Ensure sorted by X (Spatial)
  const xSorted = [...list].sort((a, b) => {
     if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
     return a.x - b.x;
  });

  const result = [];
  let currentRun = [];
  let currentSuit = null;

  for (const t of xSorted) {
    const suit = getSuit(t.code);
    
    let shouldBreak = false;
    if (currentSuit !== null && suit !== currentSuit) {
      shouldBreak = true;
    } else if (preserveMelds && currentRun.length >= 2) {
      // Check if currentRun is a "Perfect Meld" (all identical)
      const firstCode = currentRun[0].code;
      const isAllIdentical = currentRun.every(item => item.code === firstCode);
      
      // If we have a block of identical tiles, and the new one is different (even if same suit)
      // We should break to preserve the meld structure (e.g. 999 | 666)
      if (isAllIdentical && t.code !== firstCode) {
        shouldBreak = true;
      }
    }

    if (!shouldBreak) {
       // Join current run
       if (currentRun.length === 0) currentSuit = suit;
       currentRun.push(t);
    } else {
       // Flush
       if (currentRun.length > 0) {
         currentRun.sort((a, b) => TILE_ORDER.indexOf(a.code) - TILE_ORDER.indexOf(b.code));
         result.push(...currentRun);
       }
       // Start new
       currentRun = [t];
       currentSuit = suit;
    }
  }

  // Flush final
  if (currentRun.length > 0) {
    currentRun.sort((a, b) => TILE_ORDER.indexOf(a.code) - TILE_ORDER.indexOf(b.code));
    result.push(...currentRun);
  }

  return result;
};

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
    if (location.hostname !== 'localhost' && location.protocol !== 'https:') {
      console.warn("Camera access usually requires HTTPS or localhost");
    }
  }
};

const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(t => t.stop());
    stream.value = null;
  }
};

const handleRetake = () => {
  if (isManualMode.value) {
    tiles.value = [];
  } else {
    isReviewing.value = false;
    startCamera();
  }
};

// --- Scan Resize Methods ---
const startScanResize = (e) => {
  isResizingScan.value = true;
  const clientY = e.type.includes('touch') ? e.touches[0].pageY : e.pageY;
  startScanY = clientY;
  initialScanHeight = scanHeightPercent.value;
};

const handleScanResizeMove = (e) => {
  if (!isResizingScan.value || !videoContainer.value) return;
  e.preventDefault(); // Prevent scroll

  const clientY = e.type.includes('touch') ? e.touches[0].pageY : e.pageY;
  const dy = clientY - startScanY;
  
  // Calculate percentage change
  const vh = videoContainer.value.clientHeight;
  const percentChange = (dy / vh) * 100;
  
  // Update state (clamp between 10% and 80%)
  scanHeightPercent.value = Math.min(80, Math.max(10, initialScanHeight + percentChange));
};

const handleScanResizeEnd = () => {
  isResizingScan.value = false;
};

const captureAndCrop = async () => {
  if (!video.value || !canvas.value || !videoContainer.value) return;

  const ctx = canvas.value.getContext('2d');
  
  // 1. Get dimensions
  const vw = video.value.videoWidth;   // Source Video Width (e.g., 1920)
  const vh = video.value.videoHeight;  // Source Video Height (e.g., 1080)
  const cw = videoContainer.value.clientWidth;  // Container Width (Screen width)
  const ch = videoContainer.value.clientHeight; // Container Height (Screen height)

  // 2. Calculate displayed video scale & offsets (simulate object-fit: cover)
  const sourceRatio = vw / vh;
  const containerRatio = cw / ch;
  
  let scale, renderW, renderH, offsetX, offsetY;

  if (containerRatio > sourceRatio) {
    // Container is wider -> Width matches, Height overflows (cropped top/bottom)
    scale = cw / vw;
    renderW = cw;
    renderH = vh * scale;
    offsetX = 0;
    offsetY = (renderH - ch) / 2;
  } else {
    // Container is taller -> Height matches, Width overflows (cropped left/right)
    scale = ch / vh;
    renderH = ch;
    renderW = vw * scale;
    offsetX = (renderW - cw) / 2;
    offsetY = 0;
  }

  // 3. Define the Green Box in Container Coordinates (Visual)
  const boxW = cw * 0.9;  // 90% of screen width
  const boxH = ch * (scanHeightPercent.value / 100); // Dynamic height %
  const boxX = (cw - boxW) / 2; // Centered X
  const boxY = (ch - boxH) / 2; // Centered Y

  // 4. Map Green Box to Source Video Coordinates
  // The pixel at (boxX, boxY) on screen corresponds to:
  // (boxX + offsetX) / scale  in the source video
  const sourceX = (boxX + offsetX) / scale;
  const sourceY = (boxY + offsetY) / scale;
  const sourceW = boxW / scale;
  const sourceH = boxH / scale;

  // 5. Draw to Canvas
  canvas.value.width = boxW;  // Use visual resolution (or sourceW for higher res, let's keep visual for W/H ratio)
  // Actually, let's use a higher resolution (source resolution) for better AI detection
  // But strictly, we should capture the 'sourceW/sourceH' area.
  // To keep it simple and high-res, let's set canvas size proportional to the crop area of the source.
  canvas.value.width = sourceW;
  canvas.value.height = sourceH;

  ctx.drawImage(video.value, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

  const base64 = canvas.value.toDataURL("image/jpeg", 0.8);
  await processPrediction(base64);
};

const triggerFileInput = () => {
  fileInput.value.click();
};

const processPrediction = async (base64) => {
  loading.value = true;
  try {
    const ip = window.location.hostname;
    const protocol = 'https:'; 
    const port = '3001';
    
    // Call server API which calls Roboflow
    const res = await axios.post(`${protocol}//${ip}:${port}/api/predict`, { image: base64 });

    const predictions = res.data.predictions || [];

    // Filter by confidence
    const validPreds = predictions.filter(p => p.confidence > 0.4);

    if (validPreds.length === 0) {
      alert("未偵測到麻將牌");
      isCropping.value = false;
      startCamera();
      return;  
    }

    // 1. Sort by Y first to easily group rows
    validPreds.sort((a, b) => a.y - b.y);

    // --- LOGGING START ---
    // Draw debug image with bounding boxes and upload in background
    uploadDebugImage(base64, validPreds).catch(err => console.error("Log upload failed", err));
    // --- LOGGING END ---

    // 2. Cluster into Rows
    // Threshold: if y diff > height * 0.5 (approx), new row
    const rows = [];
    let currentRow = [validPreds[0]];
    
    // Estimate tile height from the first prediction (assuming uniform size)
    const avgHeight = validPreds[0].height || 40; 
    const rowThreshold = avgHeight * 0.6; 

    for (let i = 1; i < validPreds.length; i++) {
       const prev = validPreds[i-1];
       const curr = validPreds[i];
       
       if (Math.abs(curr.y - prev.y) > rowThreshold) {
         rows.push(currentRow);
         currentRow = [curr];
       } else {
         currentRow.push(curr);
       }
    }
    rows.push(currentRow);

    // 3. Classify Rows
    // Logic: Bottom-most row is Concealed (Hand). All upper rows are Exposed.
    // However, if there's only 1 row, it's all Concealed.
    const classifiedTiles = [];
    
    rows.forEach((row, rowIndex) => {
       // Sort tiles within the row by X (Left to Right)
       row.sort((a, b) => a.x - b.x);

       const isBottomRow = rowIndex === rows.length - 1;
       const status = isBottomRow ? 'concealed' : 'exposed';

       row.forEach(p => {
         classifiedTiles.push({
            id: Math.random().toString(36).substr(2, 9),
            code: p.class,
            status: status, // Auto-detected status
            x: p.x,
            y: p.y
         });
       });
    });

    tiles.value = classifiedTiles;

    isCropping.value = false;
    stopCamera();
    isReviewing.value = true;

  } catch (e) {
    console.error(e);
    alert("辨識失敗，請檢查後端連線");
  } finally {
    loading.value = false;
  }
};

const uploadDebugImage = async (originalBase64, predictions) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const dbgCanvas = document.createElement('canvas');
      dbgCanvas.width = img.width;
      dbgCanvas.height = img.height;
      const ctx = dbgCanvas.getContext('2d');
      
      // Draw original
      ctx.drawImage(img, 0, 0);

      // Draw boxes
      ctx.lineWidth = 3;
      ctx.font = "16px Arial";
      
      predictions.forEach(p => {
        // Roboflow usually returns center x/y and width/height, verify if p.x is center or top-left?
        // Based on typical Roboflow JSON: x, y are center, width, height.
        // BUT standard implementation often converts to box. 
        // Let's assume the previous logic didn't need conversion because it just used x/y for sorting.
        // We will assume x, y is the CENTER (standard Roboflow).
        const x = p.x - p.width / 2;
        const y = p.y - p.height / 2;
        const w = p.width;
        const h = p.height;
        
        ctx.strokeStyle = "red";
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = "red";
        ctx.fillText(`${p.class} ${(p.confidence*100).toFixed(0)}%`, x, y - 5);
      });

      const debugBase64 = dbgCanvas.toDataURL("image/jpeg", 0.8);
      
      // Send to server
      const ip = window.location.hostname;
      const protocol = 'https:';
      axios.post(`${protocol}//${ip}:3001/api/log-result`, {
        image: debugBase64,
        filename: `pred_${Date.now()}.jpg`
      }).then(resolve).catch(reject);
    };
    img.onerror = reject;
    img.src = originalBase64;
  });
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    cropImgSrc.value = e.target.result;
    isCropping.value = true;
    stopCamera(); // Pause camera while cropping
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

const cancelCrop = () => {
  isCropping.value = false;
  cropImgSrc.value = '';
  if (!isManualMode.value) startCamera();
};

const showResultPreview = ref(false);
const previewSettings = reactive({
  isZimo: false,
  isGangShang: false,
  isLastTile: false,
  isTianHu: false,
  isDiHu: false,
  isTianTing: false,
  roundWind: 'EW',
  seatWind: 'EW'
});
const winningTileId = ref(null); // ID of the winning tile

// Calculation Result
const calculationResult = reactive({
  tai: 0,
  desc: [],
  isValid: false,
  reason: ''
});

const setWinningTile = (id) => {
    // Toggle
    winningTileId.value = winningTileId.value === id ? null : id;
    runCalculation();
};

const runCalculation = () => {
    const concealed = tiles.value.filter(t => t.status === 'concealed');
    const exposed = tiles.value.filter(t => t.status === 'exposed');
    
    const context = {
        isZimo: previewSettings.isZimo,
        isGangShang: previewSettings.isGangShang,
        isLastTile: previewSettings.isLastTile,
        isTianHu: previewSettings.isTianHu,
        isDiHu: previewSettings.isDiHu,
        isTianTing: previewSettings.isTianTing,
        isMenQing: exposed.length === 0, // Simplified MenQing (or use filter)
        roundWind: previewSettings.roundWind,
        seatWind: previewSettings.seatWind
    };

    // Prepare tile codes
    const cCodes = concealed.map(t => t.code);
    const eCodes = exposed.map(t => t.code);
    
    // Find Winning Tile Object if selected
    // We need to pass the full object or code? 
    // The scoring util expects `extraContext.winningTile`.
    // Let's pass the tile object.
    const winningTileObj = winningTileId.value ? concealed.find(t => t.id === winningTileId.value) : null;
    const winningTileCode = winningTileObj ? { code: winningTileObj.code } : null; // Minimal obj for parser

    // Logic requires valid 'analysis' structure.
    import('../utils/mahjongScoring.js').then(mod => {
        // We need to calculateTai. 
        // Note: calculateTai needs raw codes.
        
        // Pass winningTile in context explicitly for Exclusive Wait check
        const res = mod.calculateTai(cCodes, eCodes, { ...context, winningTile: winningTileCode });
        
        calculationResult.tai = res.tai;
        calculationResult.desc = res.desc;
        calculationResult.isValid = res.isValid;
        calculationResult.reason = res.reason;
    });
};

const reportForm = reactive({
    correctTai: '',
    note: ''
});
const showReportDialog = ref(false); // Restored
const showLogImport = ref(false);
const logJsonInput = ref('');
const reportList = ref([]);

watch(showLogImport, (val) => {
    if (val) fetchReports();
});

const fetchReports = async () => {
    try {
        const ip = window.location.hostname;
        const protocol = 'https:';
        const port = '3001';
        const res = await axios.get(`${protocol}//${ip}:${port}/api/reports`);
        reportList.value = res.data || [];
    } catch (e) {
        console.error("Failed to fetch reports", e);
    }
};

const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
};

const loadReportFromServer = async (filename) => {
    try {
        const ip = window.location.hostname;
        const protocol = 'https:';
        const port = '3001';
        const res = await axios.get(`${protocol}//${ip}:${port}/api/report/${filename}`);
        restoreState(res.data);
    } catch (e) {
        alert("讀取失敗");
    }
};

const restoreState = (data) => {
    // Enter Manual Mode first (which clears tiles)
    enterManualMode();
    
    // Restore State
    if (data.tiles) tiles.value = data.tiles;
    if (data.winningTileId) winningTileId.value = data.winningTileId;
    if (data.settings) Object.assign(previewSettings, data.settings);
    
    showLogImport.value = false; // Close dialog
    alert("匯入成功！請檢查牌型後按下計算。");
};

const handleLogImport = () => {
    try {
        if (!logJsonInput.value) return;
        const data = JSON.parse(logJsonInput.value);
        restoreState(data);
        logJsonInput.value = ''; // Reset
    } catch (e) {
        console.error(e);
        alert("匯入失敗：格式錯誤");
    }
};

const reportIssue = () => {
    // Open Dialog
    reportForm.correctTai = '';
    reportForm.note = '';
    showReportDialog.value = true;
};

const submitReport = async () => {
  try {
    const ip = window.location.hostname;
    const protocol = 'https:';
    const port = '3001';
    
    // Gather all context
    const reportPayload = {
        timestamp: new Date().toISOString(),
        userFeedback: {
            correctTai: reportForm.correctTai,
            note: reportForm.note
        },
        tiles: tiles.value,
        winningTileId: winningTileId.value,
        settings: previewSettings,
        result: calculationResult,
    };
    
    console.log("Sending report...", reportPayload);

    await axios.post(`${protocol}//${ip}:${port}/api/report-error`, reportPayload);
    alert("感謝您的回報！我們已紀錄此問題。");
  } catch (e) {
    console.error(e);
    alert(`回報失敗: ${e.message || '未知錯誤'}`);
  }
};

const enterManualMode = () => {
    isManualMode.value = true;
    isReviewing.value = true;
    stopCamera();
    tiles.value = [];
};

const exitManualMode = () => {
    isManualMode.value = false;
    isReviewing.value = false;
    tiles.value = []; // Clear manual tiles
    startCamera();
};

// --- Scoring Calculation ---

// The original `runCalculation` was here, but it has been moved and updated above.

const finalizeResult = () => {
    const result = {
        concealed: concealedTiles.value.map(t => t.code),
        exposed: exposedTiles.value.map(t => t.code),
        tai: calculationResult.tai, 
        desc: calculationResult.desc,
        isZimo: previewSettings.isZimo, 
        winningTile: winningTileId.value ? tiles.value.find(t => t.id === winningTileId.value)?.code : null, // Pass winning tile
        settings: { ...previewSettings } // Emit full settings for restore
    };

    emit('on-confirm', result); 
    emit('close');
    showResultPreview.value = false; // Close preview
};

// Crop Logic
const cropStyle = computed(() => ({
  transform: `translate(${cropTransform.x}px, ${cropTransform.y}px) scale(${cropTransform.scale})`,
  transformOrigin: 'top left' // Handled manually
}));

const initCropState = () => {
  // Center image initially
  if (!cropContainer.value || !cropImg.value) return;
  const cw = cropContainer.value.clientWidth;
  const ch = cropContainer.value.clientHeight;
  const iw = cropImg.value.naturalWidth;
  const ih = cropImg.value.naturalHeight;
  
  // Fit width
  const scale = cw / iw;
  cropTransform.scale = scale;
  cropTransform.x = 0;
  cropTransform.y = (ch - ih * scale) / 2;

  // Init box height relative to container
  boxHeight.value = ch * 0.25;
};

// Touch/Mouse Handlers
const getDist = (t1, t2) => Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);

const startResize = (e) => {
  isResizing = true;
  const clientY = e.type.includes('touch') ? e.touches[0].pageY : e.pageY;
  startResizeY = clientY;
  initialHeight = boxHeight.value;
};

const handleTouchStart = (e) => {
  if (isResizing) return; 
  if (e.touches.length === 1) {
    isDragging = true;
    startX = e.touches[0].pageX;
    startY = e.touches[0].pageY;
    initialX = cropTransform.x;
    initialY = cropTransform.y;
  } else if (e.touches.length === 2) {
    isDragging = false;
    initialDist = getDist(e.touches[0], e.touches[1]);
    initialScale = cropTransform.scale;
  }
};

const handleTouchMove = (e) => {
  e.preventDefault(); 
  
  if (isResizing) {
     const clientY = e.touches[0].pageY;
     const dy = clientY - startResizeY;
     boxHeight.value = Math.max(50, initialHeight + dy);
     return;
  }

  if (e.touches.length === 1 && isDragging) {
    const dx = e.touches[0].pageX - startX;
    const dy = e.touches[0].pageY - startY;
    cropTransform.x = initialX + dx;
    cropTransform.y = initialY + dy;
  } else if (e.touches.length === 2) {
    const dist = getDist(e.touches[0], e.touches[1]);
    const scaleFactor = dist / initialDist;
    cropTransform.scale = Math.max(0.1, initialScale * scaleFactor);
  }
};

const handleTouchEnd = () => {
  isDragging = false;
  isResizing = false;
};

// Mouse support for desktop testing
const handleMouseDown = (e) => {
  if (isResizing) return;
  isDragging = true;
  startX = e.pageX;
  startY = e.pageY;
  initialX = cropTransform.x;
  initialY = cropTransform.y;
};
const handleMouseMove = (e) => {
  if (isResizing) {
    e.preventDefault();
    const dy = e.pageY - startResizeY;
    boxHeight.value = Math.max(50, initialHeight + dy);
    return;
  }
  if (!isDragging) return;
  e.preventDefault();
  const dx = e.pageX - startX;
  const dy = e.pageY - startY;
  cropTransform.x = initialX + dx;
  cropTransform.y = initialY + dy;
};
const handleMouseUp = () => {
  isDragging = false;
  isResizing = false;
};

const confirmCrop = () => {
  if (!cropImg.value || !canvas.value || !cropContainer.value) return;

  const ctx = canvas.value.getContext('2d');
  const cw = cropContainer.value.clientWidth;
  const ch = cropContainer.value.clientHeight;
  
  const cropW = cw * 0.9;
  const cropH = boxHeight.value; 
  const cropX = (cw - cropW) / 2;
  const cropY = (ch - cropH) / 2;

  const tx = cropTransform.x;
  const ty = cropTransform.y;
  const s = cropTransform.scale;
  
  const srcX = (cropX - tx) / s;
  const srcY = (cropY - ty) / s;
  const srcW = cropW / s;
  const srcH = cropH / s;
  
  canvas.value.width = cropW;
  canvas.value.height = cropH;
  ctx.drawImage(cropImg.value, srcX, srcY, srcW, srcH, 0, 0, cropW, cropH);
  
  const base64 = canvas.value.toDataURL("image/jpeg", 0.8);
  processPrediction(base64);
};

// --- Smart Positioning Helper ---
const findSmartPosition = (targetCode, targetStatus) => {
  // 1. Get all tiles in the target section
  const targetTiles = tiles.value.filter(t => t.status === targetStatus);
  
  // Default positions if section is empty
  // Exposed usually top (small Y), Concealed bottom (large Y)
  // We use extreme values to ensure sort order if completely empty, 
  // but better to use a "safe" default like top/bottom of screen
  const defaultY = targetStatus === 'exposed' ? 100 : 800;
  
  if (targetTiles.length === 0) return { x: 100, y: defaultY }; 

  // 2. Priority 1: Find identical tile (Dual)
  const identical = targetTiles.find(t => t.code === targetCode);
  if (identical) {
    return { x: identical.x, y: identical.y }; // Cling to twin (same row!)
  }

  // 3. Priority 2: Find same suit (Group)
  const targetSuit = getSuit(targetCode);
  const neighbor = targetTiles.find(t => getSuit(t.code) === targetSuit);
  if (neighbor) {
    return { x: neighbor.x, y: neighbor.y }; // Cling to family (same row!)
  }

  // 4. Default: Append to end (Find max X, use average Y of the section)
  // We should carry the Y of the main row so it doesn't float as a new row
  const maxX = Math.max(...targetTiles.map(t => t.x));
  const avgY = targetTiles.reduce((sum, t) => sum + t.y, 0) / targetTiles.length;
  
  return { x: maxX + 100, y: avgY }; 
};

const removeTile = (id) => {
  activeTileId = null;
  tiles.value = tiles.value.filter(t => t.id !== id);
};

const toggleTileStatus = (id) => {
  if (isSwipingTile) return; 
  const t = tiles.value.find(t => t.id === id);
  if (t) {
    const newStatus = t.status === 'concealed' ? 'exposed' : 'concealed';
    // Update X AND Y to fit into the new section intelligently
    // Crucial: Must update Y to prevent it being treated as a separate vertical row
    const pos = findSmartPosition(t.code, newStatus);
    t.x = pos.x;
    t.y = pos.y;
    t.status = newStatus;
  }
};

// ... (Rest of swipe logic, omitted for brevity if unchanged, but I must preserve it if I'm replacing the block) ...
// To be safe, I'm replacing the whole block of functions I touched previously to be sure.

// --- Tile Swipe Logic ---
const handleTileTouchStart = (e, id) => {
  activeTileId = id;
  isSwipingTile = false;
  if (e.touches.length === 1) {
    tileStartX = e.touches[0].pageX;
    tileStartY = e.touches[0].pageY;
  }
};

const handleTileTouchMove = (e, id) => {
  if (activeTileId !== id) return;
  if (e.touches.length === 1) {
    const dy = e.touches[0].pageY - tileStartY;
    if (dy < -15) { 
      isSwipingTile = true;
      const el = e.target.closest('.hand-tile');
      if (el) {
        el.style.transform = `translateY(${dy}px) scale(0.9)`;
        el.style.opacity = Math.max(0.3, 1 + dy / 100); 
      }
    }
  }
};

const handleTileTouchEnd = (e) => {
  const el = e.target.closest('.hand-tile');
  
  if (isSwipingTile && activeTileId) {
     const dy = e.changedTouches[0].pageY - tileStartY;
     if (dy < -60) {
       removeTile(activeTileId);
     } else {
       if (el) {
         el.style.transform = '';
         el.style.opacity = '';
       }
     }
  } else if (el) {
    el.style.transform = '';
    el.style.opacity = '';
  }
  
  activeTileId = null;
  setTimeout(() => isSwipingTile = false, 100);
};


const openPicker = (section) => {
  targetSection.value = section;
  showPicker.value = true;
}

const addTileFromPicker = (code) => {
  const pos = findSmartPosition(code, targetSection.value);

  tiles.value.push({
    id: Math.random().toString(36).substr(2, 9),
    code,
    status: targetSection.value, 
    x: pos.x, 
    y: pos.y 
  });
  showPicker.value = false;
};

const confirmResult = () => {
  // Instead of emitting directly, show preview
  runCalculation();
  showResultPreview.value = true;
};

// Rule Description Logic
const showDescDialog = ref(false);
const currentDesc = reactive({ name: '', text: '' });

// Computed Men Qing status for UI constraints (Ignore flowers)
const isMenQing = computed(() => exposedTiles.value.filter(t => getSuit(t.code) !== 'Hua').length === 0);

// Handlers to prevent toggle if disabled (though :disabled handles click usually, safety check)
// Handlers (Simplified: Allow toggle always, but maybe warn? For now just allow)
const handleTianTingToggle = () => { previewSettings.isTianTing = !previewSettings.isTianTing; runCalculation(); };
const handleTianHuToggle = () => { previewSettings.isTianHu = !previewSettings.isTianHu; runCalculation(); };
const handleDiHuToggle = () => { previewSettings.isDiHu = !previewSettings.isDiHu; runCalculation(); };

const showRuleDesc = (descItem) => {
    const key = descItem.descKey || descItem.name;
    const text = RULE_DESCRIPTIONS[key] || '暫無說明';
    currentDesc.name = descItem.name.split(' (')[0]; // Simple clean name
    currentDesc.text = text;
    showDescDialog.value = true;
    showDescDialog.value = true;
};

// Scenario Help Logic
const showScenarioHelp = () => {
    const scenarioKeys = ['自摸', '槓上開花', '海底撈月', '天聽', '天胡', '地胡'];
    const helpText = scenarioKeys.map(k => `【${k}】\n${RULE_DESCRIPTIONS[k] || ''}`).join('\n\n');
    
    currentDesc.name = '情境說明';
    currentDesc.text = helpText;
    showDescDialog.value = true;
};

const showWindHelp = (type) => {
    if (type === 'round') {
        currentDesc.name = '圈風說明';
        currentDesc.text = '「圈風」代表目前打到第幾圈。\n\n• 通常一開始是「東風圈」，大家都做過一次莊家後換「南風圈」，以此類推。\n• 如果您的刻子/槓牌與圈風相同，可得 1 台 (圈風台)。';
    } else {
        currentDesc.name = '門風說明';
        currentDesc.text = '「門風」代表您目前座位的方位。\n\n• 莊家為「東」，下家為「南」，對家為「西」，上家為「北」。\n• 如果您的刻子/槓牌與門風相同，可得 1 台 (門風台)。\n• 正花 (花牌) 的判定也依賴門風。';
    }
    showDescDialog.value = true;
};

// Wizard Logic
const wizardState = reactive({
    show: false,
    step: 0,
    title: '情境判斷',
    question: ''
});

const startWizard = () => {
    // Reset all
    previewSettings.isZimo = false;
    previewSettings.isGangShang = false;
    previewSettings.isLastTile = false;
    previewSettings.isTianHu = false;
    previewSettings.isDiHu = false;
    previewSettings.isTianTing = false;
    
    wizardState.step = 0;
    wizardState.title = '情境判斷 (1/4)';
    // Q1: Win Type
    wizardState.question = '請問是「自摸」還是「別人打的牌」？';
    // Logic needs to handle choice: True=Zimo, False=Discard. 
    // Usually Yes/No button. Let's make Yes = Self Draw, No = Discard.
    // Need to change button labels? 
    // The dialog uses Yes/No buttons hardcoded.
    // I will use "Yes" for Self Draw description, "No" for Discard description.
    // Better: change question to "是否為自己摸到的牌(自摸)？"
    wizardState.question = '這張胡的牌，是否為你自己摸到的 (自摸)？';
    wizardState.show = true;
};

const handleWizardAnswer = (ans) => {
    const step = wizardState.step;

    if (step === 0) { // Q1: Zimo Check
        if (ans) {
            previewSettings.isZimo = true;
            // Go to Self Draw path
            wizardState.step = 10;
            wizardState.title = '自摸詳細判斷';
            wizardState.question = '是否為「補花」或「槓牌」後摸到的牌 (槓上開花)？';
        } else {
            previewSettings.isZimo = false;
            // Go to Discard path
            wizardState.step = 20;
            wizardState.title = '胡牌詳細判斷';
            wizardState.question = '這是否為莊家打出的「第一張」牌 (地胡)？';
        }
    }
    // Zimo Path
    else if (step === 10) { // Gang Shang
        if (ans) { previewSettings.isGangShang = true; finishWizard(); }
        else { 
             wizardState.step = 11; 
             wizardState.question = '是否為牌牆上的「最後一張」牌 (海底撈月)？'; 
        }
    }
    else if (step === 11) { // Last Tile
        if (ans) { previewSettings.isLastTile = true; finishWizard(); }
        else {
             // Check Tian Hu (Only if Zimo = True, which it is)
             wizardState.step = 12;
             wizardState.question = '是否為莊家開局配完牌後「隨即胡牌」 (天胡)？';
        }
    }
    else if (step === 12) { // Tian Hu
        if (ans) { previewSettings.isTianHu = true; }
        // End of Zimo path, check common
        checkCommonSpecials();
    }
    
    // Discard Path
    else if (step === 20) { // Di Hu
        if (ans) { previewSettings.isDiHu = true; finishWizard(); }
        else { checkCommonSpecials(); }
    }
    
    // Common
    else if (step === 30) { // Tian Ting
        if (ans) { previewSettings.isTianTing = true; }
        finishWizard();
    }
};

const checkCommonSpecials = () => {
    wizardState.step = 30;
    wizardState.title = '其他宣告';
    wizardState.question = '開局時是否有宣告「聽牌」 (天聽/MIGI)？';
}

const finishWizard = () => {
    wizardState.show = false;
    runCalculation();
};

onMounted(() => {
    if (!isManualMode.value) startCamera();
    // Sync initial wind from store
    previewSettings.roundWind = store.currentWind;

    // Restore from initialData if present
    if (props.initialData) {
        console.log("Restoring initial data:", props.initialData);
        enterManualMode(); // Prepare mode
        
        // Restore tiles logic (need to map codes back to detailed objects if simplified)
        // initialData.exposed/concealed are arrays of CODES or OBJECTS? 
        // handleAiResult stores `result.concealed` which are Tile Objects usually?
        // Let's check handleAiResult in MahjongTable.
        // It stores: concealed: result.concealed || []
        // CameraAI emit sends: concealed: concealedTiles.value.map(t => t.code) -> CODES!
        // So we need to reconstruct tile objects from codes.
        
        const makeTiles = (codes, status) => codes.map(code => ({
            id: Math.random().toString(36).substr(2, 9),
            code,
            status,
            x: 0, y: 0 // Position doesn't matter for manual mode logic much, smartSort handles it?
        }));

        const cTiles = makeTiles(props.initialData.concealed || [], 'concealed');
        const eTiles = makeTiles(props.initialData.exposed || [], 'exposed');
        tiles.value = [...cTiles, ...eTiles];
        
        // Restore Settings
        if (props.initialData.settings) {
            Object.assign(previewSettings, props.initialData.settings);
        }
        
        // Restore Winning Tile
        if (props.initialData.winningTile) {
            const wCode = props.initialData.winningTile;
            // Find a tile with this code in concealed
            const t = tiles.value.find(t => t.status === 'concealed' && t.code === wCode);
            if (t) winningTileId.value = t.id;
        }

        // Run calcs
        nextTick(runCalculation);
        // Show preview immediately? Or let user edit?
        // User wants to MODIFY, so show review screen (which enterManualMode does).
        // If they want to preview, they click confirm.
    }
});
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
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 90%; 
  /* Height is dynamic inline */
  border: 2px solid #00ff00;
  box-shadow: 0 0 0 400px rgba(0,0,0,0.6);
  border-radius: 8px;
  display: flex; justify-content: center; align-items: flex-end;
}
.resize-handle {
  position: absolute;
  bottom: -15px; left: 50%;
  transform: translateX(-50%);
  width: 60px; height: 30px;
  background: rgba(255,255,255,0.3);
  border-radius: 15px;
  display: flex; justify-content: center; align-items: center;
  cursor: ns-resize;
  pointer-events: auto; /* Enable clicks */
}
.resize-handle::after {
  content: '';
  width: 40px; height: 4px;
  background: white;
  border-radius: 2px;
}
.scan-label { color: #00ff00; background: rgba(0,0,0,0.6); margin-bottom: -30px; padding: 4px 8px; font-size: 14px; border-radius: 4px; }
.scan-line { position: absolute; top:0; width: 100%; height: 2px; background: #00ff00; animation: scan 2s infinite; }
@keyframes scan { 0% { top: 0; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

.controls { padding: 30px; background: #000; display: flex; flex-direction: column; gap: 15px; z-index: 10; }
.hint { color: #999; text-align: center; font-size: 12px; margin-bottom: 5px; }
.album-btn { background: rgba(255,255,255,0.2); color: white; border: none; }

/* Preview Full Page Styles */
.preview-container { height: 100%; display: flex; flex-direction: column; background: #fff; }
.preview-header { 
    display: flex; justify-content: space-between; align-items: center; 
    padding: 15px; border-bottom: 1px solid #f0f0f0; background: #fff;
    flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.preview-header h2 { margin: 0; font-size: 18px; color: #333; }

.preview-content { 
    flex: 1; overflow-y: auto; padding: 20px; 
    display: flex; flex-direction: column; gap: 20px;
}

/* Tiles Section */
.preview-tiles-section { background: #f9f9f9; padding: 10px; border-radius: 8px; }
.preview-label { font-size: 12px; color: #666; margin-bottom: 5px; }
.preview-tiles-row { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
.mini-tile img { width: 34px; height: 46px; border-radius: 4px; border: 1px solid #ddd; }

/* Score Display */
.score-display { text-align: center; margin: 10px 0; }
.total-tai { font-size: 32px; font-weight: bold; color: #ee0a24; display: block; }
.valid-status { font-size: 14px; color: #07c160; font-weight: bold; }
.valid-status.invalid { color: #ee0a24; }

/* Settings */
.preview-settings { background: #fff; border: 1px solid #eee; padding: 15px; border-radius: 10px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.setting-row span { color: #333; font-weight: bold; font-size: 15px; white-space: nowrap; } /* Prevent label wrap */
.scenario-toggles { display: flex; gap: 15px; align-items: center; flex-wrap: nowrap; } /* No wrap for toggles */
.wind-toggles { display: flex; gap: 5px; }

/* Description */
.desc-section h3 { margin: 0 0 10px 0; font-size: 16px; color: #333; }
.desc-list { background: #fffbe8; padding: 15px; border-radius: 8px; }
.desc-item { 
    font-size: 16px; margin: 5px 0; color: #333; 
    display: flex; justify-content: space-between; align-items: center; 
    border-bottom: 1px dashed #eecd9d; padding-bottom: 5px;
}
.desc-item:last-child { border-bottom: none; }
.desc-name { font-weight: 500; }
.desc-tai { color: #ee0a24; font-weight: bold; }

.divider { height: 1px; background: #eee; margin: 0 10px; }

/* Footer Action */
.action-footer { margin-top: 20px; padding: 0 10px 20px; }
.return-btn { border-width: 2px; font-weight: bold; }


/* Crop Mode */
.crop-mode { height: 100%; display: flex; flex-direction: column; background: #000; overflow: hidden; }
.crop-container { flex: 1; position: relative; overflow: hidden; }
.crop-image { position: absolute; transform-origin: 0 0; cursor: move; }
.overlay-guide { pointer-events: none; }

/* --- Review Mode Styles --- */
.review-mode { flex: 1; background: #f7f8fa; display: flex; flex-direction: column; min-height: 0; }
.review-header { text-align: center; padding: 10px 0 5px; color: #333; flex-shrink: 0; background: #fff; border-bottom: 1px solid #eee; }
.review-header h3 { margin: 0; font-size: 16px; }
.review-header p { margin: 2px 0 0; font-size: 12px; color: #1989fa; cursor: pointer; }

/* Hand View Sections */
.hand-view-section {
  background: #35654d; /* Green Table */
  padding: 10px 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
}

.section-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.section-label {
  color: rgba(255,255,255,0.9);
  font-size: 14px;
  margin-left: 5px;
  border-left: 3px solid #f1c40f;
  padding-left: 8px;
  font-weight: bold;
}

.hand-view-area {
  min-height: 80px;
  background: rgba(0,0,0,0.15);
  border-radius: 12px;
  padding: 10px 10px 40px 10px; /* Bottom padding for button area */
  position: relative;
  display: flex;
  flex-direction: column;
}

.hand-row { 
  display: flex; 
  flex-wrap: wrap; /* Allow wrapping */
  gap: 8px;
  align-items: flex-start;
}
.hand-tile { 
  width: 40px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  cursor: grab;
  position: relative;
  transition: transform 0.1s, opacity 0.1s;
  touch-action: none; /* Prevent scroll while dragging tile */
}
.hand-tile-img { 
  width: 100%; 
  height: auto; 
  object-fit: contain; 
  filter: drop-shadow(1px 2px 3px rgba(0,0,0,0.5)); 
  display: block;
}

.hand-tile-name {
  color: #fff;
  font-size: 10px;
  margin-top: 2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
.empty-hint {
  color: rgba(255,255,255,0.4);
  font-size: 14px;
  text-align: center;
  width: 100%;
  padding: 20px 0;
}

/* Add Button in Corner */
/* Add Button in Corner */
.add-btn-corner {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px !important;    /* Force width */
  height: 32px !important;   /* Force height equivalent */
  padding: 0 !important;     /* Remove padding that causes oval shape */
  border-radius: 50% !important; 
  display: flex !important;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  z-index: 10;
  opacity: 0.7;
}

.review-actions { padding: 10px 20px 20px; background: #fff; display: flex; gap: 10px; flex-shrink: 0; }

/* Picker */
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

/* Clickable Tiles */
.clickable-tile {
    cursor: pointer;
    border: 2px solid transparent; /* Reserve space */
    transition: all 0.2s;
    position: relative;
}
.clickable-tile:active { transform: scale(0.95); }
.winning-tile {
    border-color: #ee0a24;
    background: rgba(238, 10, 36, 0.1);
    transform: translateY(-4px);
    box-shadow: 0 4px 8px rgba(238, 10, 36, 0.3);
}
.winning-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ee0a24;
    color: white;
    font-size: 10px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Ensure Dialog Text is Visible */
.van-dialog__content {
    color: #333 !important;
}
</style>
