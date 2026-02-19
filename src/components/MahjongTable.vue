<template>
  <div class="table-view" :style="{ background: store.settings.bgColor }">
    <div class="header">
      <div class="room-info">底 {{ store.settings.base }} / 台 {{ store.settings.tai }}</div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <van-button icon="chart-trending-o" size="small" round type="primary" @click="showSettlementDialog = true">結算</van-button>
        <van-button icon="qr" size="small" round @click="showQr = true">邀請</van-button>
      </div>
    </div>

    <!-- 上半部：麻將桌 (固定高度/比例，佔 60%) -->
    <div class="table-area">
      <van-dialog 
      v-model:show="showDealerDialog" 
      title="莊家與連莊設定" 
      show-cancel-button
      @confirm="saveDealerSettings"
    >
        <div style="padding: 20px;">
            <div style="margin-bottom: 16px;">
                <div style="margin-bottom: 8px; font-size: 14px; color: #666;">目前的莊家</div>
                <div style="display: flex; gap: 8px;">
                    <van-button 
                        v-for="p in store.players" 
                        :key="p.id"
                        size="small"
                        :type="tempDealerId === p.id ? 'primary' : 'default'"
                        @click="tempDealerId = p.id"
                    >
                        {{ p.name }}
                    </van-button>
                </div>
            </div>
            
            <div>
                <div style="margin-bottom: 8px; font-size: 14px; color: #666;">連莊次數 (連N)</div>
                <van-stepper v-model="tempDealerStreak" min="0" max="20" integer />
                <div style="font-size: 12px; color: #999; margin-top: 4px;">例如: 連2拉2，請設定為 2</div>
            </div>
        </div>
    </van-dialog>

      <div class="mahjong-table" :style="{ transform: `scale(${tableScale})` }">
        <div class="center-zone" @click="showActionModal = true">
          <div class="center-content" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
            <div class="logo">🀄️</div>
            <div>記帳</div>
          </div>
        </div>

        <div 
          v-for="(p, index) in store.rotatedPlayers" 
          :key="p.id"
          class="player-seat"
          :class="getPositionClass(index)"
          @click="openPlayerStats(p)"
          style="cursor: pointer;"
        >
          <div class="avatar-wrapper" :class="{ 'winner': p.score > 0, 'loser': p.score < 0 }">
            {{ p.avatar }}
            <div class="score-badge">{{ p.score }}</div>
            
            <!-- Dealer Badge -->
            <div v-if="p.id === store.dealerId" class="dealer-badge" @click.stop="openDealerSettings">
               莊 {{ store.dealerStreak > 0 ? `連${store.dealerStreak}` : '' }}
            </div>
          </div>
          <div class="p-name">{{ p.name }}</div>
        </div>
        
        <!-- Fallback Set Dealer Button if no dealer -->
        <div v-if="store.dealerId === null && store.players.length > 0" class="center-zone" style="top: 65%; pointer-events: none;">
            <van-button size="mini" type="warning" style="pointer-events: auto;" @click="openDealerSettings">設定莊家</van-button>
        </div>
      </div>
    </div>

    <!-- 中間：操作區 (佔 10%) -->
    <div class="action-area">
      <div class="action-btn" @click="showCamera = true">
        <van-icon name="scan" size="20" />
        <span>AI 算台</span>
      </div>

    </div>

    <!-- 下半部：戰況 (佔 30%) -->
    <div class="logs-panel">
      <div class="logs-title">戰況速報</div>
      <div class="logs-list">
        <div v-for="log in store.logs" :key="log.id" class="log-item">
          <span class="time">{{ log.time }}</span>
          <span class="desc">
            <span class="winner-name">{{ log.winner }}</span> {{ log.desc }}
            <span class="detail-link" @click.stop="showLogDetails(log)">詳細 ></span>
          </span>
          <span class="amt">+{{ log.amount }}</span>
        </div>
        <div v-if="store.logs.length === 0" class="no-logs">暫無戰況</div>
      </div>
    </div>

    <van-dialog v-model:show="showDetailDialog" title="戰績明細" show-confirm-button>
        <div style="padding: 12px 16px; max-height: 65vh; overflow-y: auto;">
            
            <!-- 1. 牌型預覽 (Moved to Top) -->
            <div v-if="currentDetailTiles" style="margin-bottom: 16px; text-align: left;">
                <div style="font-size: 13px; font-weight: bold; color: #555; margin-bottom: 8px;">當時牌型</div>
                
                <div style="background: #f9f9f9; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                    <!-- 明牌 -->
                    <div v-if="currentDetailTiles.exposed && currentDetailTiles.exposed.length" style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap;">
                        <img v-for="(code, idx) in currentDetailTiles.exposed" :key="'exp'+idx" :src="`/tiles/${code}.webp`" style="width: 28px; height: 38px;" />
                    </div>
                    
                    <!-- 暗牌 + 胡牌 -->
                    <div style="display: flex; flex-wrap: wrap; align-items: start;">
                        <!-- 暗牌 -->
                        <div v-if="currentDetailTiles.concealed && currentDetailTiles.concealed.length" style="display: flex; gap: 4px; margin-right: 12px; flex-wrap: wrap; flex: 1; align-content: flex-start;">
                            <img v-for="(code, idx) in currentDetailTiles.concealed" :key="'con'+idx" :src="`/tiles/${code}.webp`" style="width: 28px; height: 38px; margin-bottom: 4px;" />
                        </div>
                        
                        <!-- 贏的那張牌 -->
                        <div v-if="currentDetailTiles.winningTile" style="display: flex; flex-direction: column; align-items: center; padding-left: 8px; border-left: 1px dashed #ddd; flex-shrink: 0; align-self: stretch; justify-content: center;">
                            <span style="font-size: 10px; color: #d00; margin-bottom: 2px;">胡</span>
                            <img :src="`/tiles/${currentDetailTiles.winningTile}.webp`" style="width: 32px; height: 42px; border: 2px solid #d00; border-radius: 4px;" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. 台數明細 (List Layout) -->
            <div v-if="currentDetailList.length">
                <div style="font-size: 13px; font-weight: bold; color: #555; margin-bottom: 8px; text-align: left;">計分細項</div>
                <div style="border: 1px solid #ebedf0; border-radius: 8px; overflow: hidden;">
                    <van-cell 
                        v-for="(item, i) in currentDetailList" 
                        :key="i" 
                        :title="item.name"
                        title-style="flex: 4; text-align: left;"
                        value-style="flex: 1;"
                    >
                        <template #value>
                            <span v-if="item.tai" style="color: #d00; font-weight: bold;">{{ item.tai }} 台</span>
                        </template>
                    </van-cell>
                </div>
            </div>

            <!-- 3. 支付標記 (New Feature) -->
            <div style="margin-top: 20px;">
                <div style="font-size: 13px; font-weight: bold; color: #555; margin-bottom: 8px; text-align: left;">支付狀態 (勾選代表已付現)</div>
                <div style="background: #fff; border: 1px solid #ebedf0; border-radius: 8px;">
                    <van-cell 
                        v-for="loser in currentDetailLosers" 
                        :key="loser.id"
                        :title="loser.name"
                        title-style="text-align: left;"
                    >
                        <template #right-icon>
                            <van-switch 
                                :model-value="loser.isPaid" 
                                size="18px"
                                active-color="#07c160"
                                @update:model-value="store.togglePayment(selectedLogId, loser.id)"
                            />
                        </template>
                    </van-cell>
                </div>
                <div style="font-size: 11px; color: #999; margin-top: 6px; text-align: left;">
                    * 標記為已付現的局數，將不計入結算表下方的「待結餘額」。
                </div>
            </div>

            <!-- 4. 刪除按鈕 (New Feature) -->
            <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                 <van-button 
                    type="danger" 
                    plain 
                    block 
                    round 
                    size="small"
                    icon="delete-o"
                    @click="handleDeleteLog"
                 >
                    刪除此筆記錄 (分數將會退回)
                 </van-button>
            </div>
        </div>
    </van-dialog>

    <!-- Stats Dialog -->
    <van-dialog v-model:show="showStatsDialog" :title="currentStatsPlayer ? `${currentStatsPlayer.name} 的戰績` : '戰績統計'">
        <div v-if="currentStatsPlayer" style="padding: 20px;">
            <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 20px;">
                <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: #07c160;">{{ currentStatsData.win }}</div>
                    <div style="font-size: 12px; color: #666;">胡牌總數</div>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: #ee0a24;">{{ currentStatsData.dealt }}</div>
                    <div style="font-size: 12px; color: #666;">放槍次數</div>
                </div>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <van-row gutter="10" style="margin-bottom: 8px;">
                    <van-col span="12" style="color: #333">自摸次數: <b>{{ currentStatsData.zimo }}</b></van-col>
                    <van-col span="12" style="color: #333">胡牌次數: <b>{{ currentStatsData.ron }}</b></van-col>
                </van-row>
                <van-row gutter="10">
                    <van-col span="12" style="color: #333">最大台數: <b>{{ currentStatsData.maxTai }}</b> 台</van-col>
                    <van-col span="12" style="color: #333">目前戰績: <b :style="{ color: currentStatsData.totalScore >= 0 ? '#07c160' : '#ee0a24' }">{{ currentStatsData.totalScore }}</b></van-col>
                </van-row>
            </div>
            
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #1989fa; padding-left: 8px; color: #333;">相關戰績</div>
            <div style="max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #eee; border-radius: 8px; color: #333;">
                <div v-for="log in currentStatsData.history" :key="log.id" style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="color: #666; font-size: 11px; margin-bottom: 2px;">{{ log.time }}</div>
                        <div :style="{ color: log.isWin ? '#07c160' : '#ee0a24', fontWeight: 'bold' }">
                           {{ log.enrichedDesc }}
                        </div>
                    </div>
                    <div style="font-size: 16px; font-weight: bold;" :style="{ color: log.amount > 0 ? '#07c160' : '#ee0a24' }">
                        {{ log.amount > 0 ? '+' : '' }}{{ log.amount }}
                    </div>
                </div>
                <div v-if="currentStatsData.history.length === 0" style="text-align: center; padding: 20px; color: #999;">暫無紀錄</div>
            </div>
        </div>
    </van-dialog>

    <!-- Dealer Settings Dialog -->
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
    
    <!-- Settlement Dialog -->
    <van-dialog 
      v-model:show="showSettlementDialog" 
      class="settlement-dialog-custom"
      :show-confirm-button="false"
      close-on-click-overlay
    >
      <div class="settlement-container" ref="settlementContainerRef">
        <!-- Settlement Report Header (Visible in Image) -->
        <div class="settlement-report-header">
            <div class="s-title">麻將戰績表</div>
            <div class="s-info">
                <span>房號: {{ store.roomId }}</span>
                <span style="margin: 0 8px;">|</span>
                <span>{{ new Date().toLocaleDateString() }}</span>
                <span style="margin: 0 8px;">|</span>
                <span>底 {{ store.settings.base }} / 台 {{ store.settings.tai }}</span>
            </div>
        </div>

        <!-- Player Headers -->
        <div class="settlement-header">
           <div class="col-idx">#</div>
           <div v-for="p in store.players" :key="p.id" class="col-player">
              <div class="s-avatar">{{ p.avatar }}</div>
              <div class="s-name">{{ p.name }}</div>
           </div>
        </div>
        
        <!-- Score Rows -->
        <div class="settlement-body">
            <div v-for="(row, idx) in settlementRows" :key="idx" 
                 class="settlement-row clickable" 
                 @click="handleSettlementRowClick(row)">
                <div class="col-idx">{{ idx + 1 }}</div>
                <div v-for="p in store.players" :key="p.id" class="col-score" 
                     :class="{ 
                        'win': row.scores[p.id] > 0, 
                        'lose': row.scores[p.id] < 0,
                        'paid': row.payments?.[p.id]?.isPaid 
                     }">
                     <span class="score-num">{{ row.scores[p.id] > 0 ? '+' : '' }}{{ row.scores[p.id] !== 0 ? row.scores[p.id] : '-' }}</span>
                     <van-icon v-if="row.payments?.[p.id]?.isPaid" name="success" class="paid-icon" />
                </div>
            </div>
            <div v-if="settlementRows.length === 0" class="no-data">暫無紀錄</div>
        </div>

        <!-- Total Footer -->
        <div class="settlement-footer">
            <div class="col-idx">總</div>
            <div v-for="p in store.players" :key="p.id" class="col-total" 
                 :class="{ 'win': p.score > 0, 'lose': p.score < 0 }">
                 {{ p.score > 0 ? '+' : '' }}{{ p.score }}
            </div>
        </div>

        <!-- Unpaid Balances (Remaining to pay/receive) -->
        <div class="settlement-unpaid">
            <div class="col-idx" style="font-size: 10px; line-height: 1.2;">待結<br/>餘額</div>
            <div v-for="p in store.players" :key="p.id" class="col-total" 
                 :class="{ 'win': unpaidBalances[p.id] > 0, 'lose': unpaidBalances[p.id] < 0 }">
                 {{ unpaidBalances[p.id] > 0 ? '+' : '' }}{{ unpaidBalances[p.id] }}
            </div>
        </div>
        
        <div class="settlement-actions">
             <div style="display: flex; gap: 10px; flex-direction: column;">
                <div style="display: flex; gap: 10px;">
                    <van-button block round type="success" @click="downloadSettlementImage">下載圖片</van-button>
                    <van-button block round @click="showSettlementDialog = false">關閉</van-button>
                </div>
                <van-button block round plain type="danger" icon="delete-o" @click="promptDeleteRoom">結束戰局並刪除房間</van-button>
             </div>
        </div>
      </div>
    </van-dialog>

    <!-- Delete Room Confirmation Dialog -->
    <van-dialog
        v-model:show="showDeleteConfirm"
        title="⚠️ 確認刪除房間"
        show-cancel-button
        @confirm="handleDeleteConfirm"
        confirm-button-text="確認刪除"
        confirm-button-color="#ee0a24"
    >
        <div style="padding: 20px; text-align: center;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                此操作將<b style="color: #ee0a24;">永久刪除</b>房間資料。<br>
                請輸入房號 <b style="color: #1989fa;">{{ store.roomId }}</b> 以確認。
            </p>
            <input
                v-model="deleteConfirmInput"
                placeholder="請輸入房號"
                style="width: 100%; box-sizing: border-box; padding: 10px; text-align: center; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; color: #333; background: #fff;"
            />
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
                        <van-radio-group v-model="scoreForm.type" direction="horizontal" :disabled="scoreForm.isLocked">
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
                <van-field v-model="scoreForm.tai" type="number" name="tai" label="牌型台數" placeholder="輸入台數" :rules="[{ required: true, message: '請輸入台數' }]" />
                
                <!-- 連莊設定 -->
                <van-cell center title="計算莊家台數">
                    <template #right-icon>
                        <van-switch v-model="scoreForm.includeLian" size="24" />
                    </template>
                </van-cell>
                <van-field 
                    v-if="scoreForm.includeLian"
                    v-model="scoreForm.lianTai" 
                    type="number" 
                    label="莊家台數" 
                    placeholder="自動計算" 
                />
                
                <div style="padding: 10px 16px; text-align: right; font-weight: bold; color: #d00;">
                    總計: {{ Number(scoreForm.tai) + Number(scoreForm.lianTai) }} 台
                </div>

                <!-- 詳細說明 -->
                <div v-if="scoreForm.details" style="font-size: 12px; color: #666; padding: 0 16px 10px 16px;">
                    紀錄: {{ scoreForm.details }}
                </div>
            </van-cell-group>
            <div style="margin-top: 15px; padding: 10px; background: #fdf6ec; border-radius: 8px; border: 1px solid #faecd8;">
                <div style="font-size: 13px; font-weight: bold; color: #e6a23c; margin-bottom: 8px; text-align: left;">計分預覽</div>
                <div v-for="p in store.players" :key="p.id" style="display: flex; justify-content: space-between; font-size: 13px; color: #666; margin-bottom: 4px;">
                    <span>{{ p.name }} ({{ p.id === store.dealerId ? '莊' : '閒' }})</span>
                    <span :style="{ fontWeight: 'bold', color: scorePreview[p.id] > 0 ? '#07c160' : (scorePreview[p.id] < 0 ? '#ee0a24' : '#999') }">
                        {{ scorePreview[p.id] > 0 ? '+' : '' }}{{ scorePreview[p.id] !== 0 ? scorePreview[p.id] : '-' }}
                    </span>
                </div>
            </div>

            <div style="margin: 16px;">
                <van-button round block type="primary" native-type="submit">
                確認記帳
                </van-button>
                <van-button round block plain type="primary" @click="modifyScore" style="margin-top: 10px;">
                    修改牌型
                </van-button>
            </div>
          </van-form>
       </div>
    </van-action-sheet>

    <CameraAI 
      v-if="showCamera" 
      @close="closeCamera" 
      @on-confirm="handleAiResult"
      :initial-data="tempInitialData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useGameStore } from '../stores/gameStore';
import QrcodeVue from 'qrcode.vue';
import { showToast, showConfirmDialog } from 'vant';
import CameraAI from './CameraAI.vue';
import html2canvas from 'html2canvas';

const store = useGameStore();
const showQr = ref(false);
const showActionModal = ref(false);
const showDetailDialog = ref(false); 
const currentDetail = ref(''); 
const currentDetailTiles = ref(null); 
const selectedLogId = ref(null); // 追蹤當前詳細視窗對應的記錄 ID
const currentAiResult = ref(null); 
const tableScale = ref(1);
const showCamera = ref(false);
const showLogImport = ref(false); // Valid
const tempInitialData = ref(null); // Data to pass when reopening camera

// Delete Room State
const showDeleteConfirm = ref(false);
const deleteConfirmInput = ref('');

const promptDeleteRoom = () => {
    deleteConfirmInput.value = '';
    showDeleteConfirm.value = true;
};

const handleDeleteConfirm = () => {
    if (deleteConfirmInput.value === String(store.roomId)) {
        store.deleteRoom();
    } else {
        showToast('房號輸入錯誤，取消刪除');
    }
};

const startCamera = () => {
    tempInitialData.value = null; // Clear old data
    showCamera.value = true;
};

const closeCamera = () => {
    showCamera.value = false;
    tempInitialData.value = null;
};

const modifyScore = () => {
    // Re-open camera with current data
    tempInitialData.value = currentAiResult.value;
    showActionModal.value = false;
    showCamera.value = true;
};

// Dealer Settings
const showDealerDialog = ref(false);
const tempDealerId = ref(null);
const tempDealerStreak = ref(0);

// Player Stats
const showStatsDialog = ref(false);
const currentStatsPlayer = ref(null);
const currentStatsData = ref({
    win: 0,
    zimo: 0,
    ron: 0,
    dealt: 0,
    maxTai: 0,
    totalScore: 0,
    history: []
});

const openPlayerStats = (player) => {
    currentStatsPlayer.value = player;
    calculateStats(player.id);
    showStatsDialog.value = true;
};

const calculateStats = (playerId) => {
    let win = 0, zimo = 0, ron = 0, dealt = 0, maxTai = 0;
    const history = [];
    
    // Safety check: logs might be undefined initially
    const safeLogs = store.logs || [];
    
    safeLogs.forEach(log => {
        let involved = false;
        
        // Winner Stats
        if (log.winnerId === playerId) {
            win++;
            if (log.loserId === null) zimo++;
            else ron++;
            
            if (log.tai > maxTai) maxTai = log.tai;
            involved = true;
        }
        
        // Loser Stats (Dealt In)
        if (log.loserId === playerId) {
            dealt++;
            involved = true;
        }
        
        // Zimo Loss (Others win by Zimo)
        if (log.winnerId !== playerId && log.loserId === null) {
            involved = true;
        }
        
        if (involved) {
            // Enrich description for this player's perspective
            let enrichedDesc = '';
            const winnerName = store.players.find(p => p.id === log.winnerId)?.name || '未知';
            
            if (log.winnerId === playerId) {
                // I won
                if (log.loserId === null) {
                    enrichedDesc = '自摸';
                } else {
                    const loserName = store.players.find(p => p.id === log.loserId)?.name || '未知';
                    enrichedDesc = `胡了 ${loserName}`;
                }
            } else {
                // I lost
                if (log.loserId === playerId) {
                    // I dealt in
                    enrichedDesc = `放槍給 ${winnerName}`;
                } else if (log.loserId === null) {
                    // Someone else Zimo, I paid
                    enrichedDesc = `被 ${winnerName} 自摸`;
                } else {
                    // Should not happen if involved check is correct, but fallback
                    enrichedDesc = `${winnerName} 胡牌`; 
                }
            }
            
            // Calculate my specific amount change
            let myAmount = 0;
            if (log.winnerId === playerId) myAmount = log.amount; // I won full amount? Wait, log.amount is total? 
            // Usually log.amount is what winner gets.
            // If Zimo, winner gets X * 3. Each loser pays X. 
            // Wait, store.settleRound needs to be checked. 
            // Assuming log.amount is total transfer to winner.
            
            if (log.winnerId === playerId) {
                myAmount = log.amount;
            } else {
                 if (log.loserId === null) {
                     // Zimo: 需要從記錄中重新計算我付了多少
                     // 莊家多付的台數根據連莊狀態：2 × 連莊次數 + 1
                     const taiValue = Number(store.settings.tai);
                     const taiCount = log.tai || 0;
                     const individualBase = Number(store.settings.base) + (taiCount * taiValue);
                     
                     // 使用該局記錄的莊家 ID 和連莊次數
                     const logDealerId = log.dealerId;
                     const logDealerStreak = log.dealerStreak || 0;
                     const isDealerMe = (playerId === logDealerId);
                     
                     if (isDealerMe) {
                         // 莊家多付連莊台數（使用記錄的連莊次數）
                         const dealerExtraTai = (logDealerStreak * 2) + 1;
                         myAmount = -(individualBase + (taiValue * dealerExtraTai));
                     } else {
                         myAmount = -individualBase;
                     }
                 } else {
                     // Ron: I pay full
                     myAmount = -log.amount;
                 }
            }
            
            history.push({
                ...log,
                enrichedDesc,
                amount: myAmount, // Override strict amount for this view
                isWin: myAmount > 0
            });
        }
    });
    
    // Find current score from store
    const currentPlayer = store.players.find(p => p.id === playerId);
    
    currentStatsData.value = {
        win, zimo, ron, dealt, maxTai,
        totalScore: currentPlayer?.score || 0,
        history: history.reverse() // Newest first
    };
};


// Initialize Dealer logic when players load
watch(() => store.players, (newVal) => {
    if (newVal.length > 0 && store.dealerId === null) {
        store.setDealer(newVal[0].id, 0); // Default to first player
    }
}, { immediate: true });

const openDealerSettings = () => {
    tempDealerId.value = store.dealerId || (store.players[0]?.id);
    tempDealerStreak.value = store.dealerStreak;
    showDealerDialog.value = true;
};

const saveDealerSettings = () => {
    store.setDealer(tempDealerId.value, Number(tempDealerStreak.value));
    showDealerDialog.value = false;
    showToast('莊家設定已更新');
};

// 產生連結 (假設跑在 Localhost)
const joinUrl = computed(() => `${window.location.origin}/?room=${store.roomId}`);

const showSettlementDialog = ref(false);
const settlementContainerRef = ref(null);

const downloadSettlementImage = async () => {
    if (!settlementContainerRef.value) return;
    
    // Create a clone to render full height
    const clone = settlementContainerRef.value.cloneNode(true);
    Object.assign(clone.style, {
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        width: '600px', // Fixed width for consistent image
        zIndex: '-1000',
        background: '#fff', // White background for paper look
        fontFamily: 'sans-serif',
        padding: '20px',    // Add padding for card look
        borderRadius: '12px'
    });
    
    // Fix body scrolling in clone
    const cloneBody = clone.querySelector('.settlement-body');
    if (cloneBody) {
        cloneBody.style.maxHeight = 'none';
        cloneBody.style.overflowY = 'visible';
    }
    
    // Remove Actions from clone
    const cloneActions = clone.querySelector('.settlement-actions');
    if (cloneActions) cloneActions.remove();
    
    // Ensure unpaid balances row is visible in clone (might be at bottom)
    const cloneUnpaid = clone.querySelector('.settlement-unpaid');
    if (cloneUnpaid) {
        cloneUnpaid.style.marginTop = '10px';
        cloneUnpaid.style.borderTop = '2px dashed #ee0a24';
    }
    
    // Scale up the header in clone
    const cloneTitle = clone.querySelector('.s-title');
    if (cloneTitle) cloneTitle.style.fontSize = '24px';

    document.body.appendChild(clone);
    
    try {
        const canvas = await html2canvas(clone, { 
            scale: 2, 
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#f8f8f8'
        });
        
        const link = document.createElement('a');
        link.download = `mahjong_score_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showToast('圖片下載成功');
    } catch (e) {
        console.error("Download failed:", e);
        showToast('圖片下載失敗');
    } finally {
        document.body.removeChild(clone);
    }
};

const handleSettlementRowClick = (row) => {
    // 從 store.logs 中找出完整的 log 物件
    const fullLog = store.logs.find(l => l.id === row.id);
    if (fullLog) {
        showLogDetails(fullLog);
    }
};

const settlementRows = computed(() => {
    // Reconstruct round-by-round scores from logs
    // 透過 [...].reverse() 確保按時間順序 (最早的在上面) 顯示
    return [...store.logs].reverse().map((log) => {
        const scores = {};
        
        // Init all to 0
        store.players.forEach(p => scores[p.id] = 0);
        
        const winnerId = log.winnerId;
        const loserId = log.loserId;
        const amount = log.amount; // Total transferred to winner
        
        if (loserId === null) {
            // Zimo: 莊家多付連莊台數（2 × 連莊次數 + 1）
            const taiCount = log.tai || 0;
            const baseAmount = Number(store.settings.base) + (taiCount * Number(store.settings.tai));
            const taiValue = Number(store.settings.tai);
            
            // 使用該局記錄的莊家 ID 和連莊次數
            const logDealerId = log.dealerId;
            const logDealerStreak = log.dealerStreak || 0;
            const dealerExtraTai = (logDealerStreak * 2) + 1;
            const dealerAmount = baseAmount + (taiValue * dealerExtraTai);
            
            store.players.forEach(p => {
                if (p.id === winnerId) {
                    scores[p.id] = amount; // 贏家收的總金額
                } else {
                    // 輸家根據是否為該局的莊家決定支付金額
                    scores[p.id] = (p.id === logDealerId) ? -dealerAmount : -baseAmount;
                }
            });
        } else {
            // Ron: Winner +Total, Loser -Total
            scores[winnerId] = amount;
            scores[loserId] = -amount;
        }
        
        return {
            id: log.id,
            scores,
            payments: log.payments || {} // 傳遞支付狀態
        };
    });
});

/**
 * 計算每位玩家的待結餘額 (扣除已標記付現的部分)
 */
const unpaidBalances = computed(() => {
    const balances = {};
    store.players.forEach(p => balances[p.id] = 0);

    settlementRows.value.forEach(row => {
        store.players.forEach(p => {
            const score = row.scores[p.id];
            if (score === 0) return;

            // 判斷是否已結清
            // 贏家：如果輸家（所有的）都付了，贏家才算結清？不，贏家是看「誰付給他」
            // 邏輯：對於各個玩家，如果該玩家是輸家且 isPaid=true，則不計入餘額。
            // 如果該玩家是贏家，則總額扣除掉那些 isPaid=true 的輸家的支付金額。

            if (score < 0) {
                // 我是輸家
                const isPaid = row.payments[p.id]?.isPaid || false;
                if (!isPaid) {
                    balances[p.id] += score;
                }
            } else {
                // 我是贏家 (只有自摸或胡牌會正分)
                // 找出這筆記錄中所有為我支付且「尚未付清」的人
                const log = store.logs.find(l => l.id === row.id);
                if (log) {
                    if (log.loserId === null) {
                        // 自摸：檢查三個閒家
                        store.players.forEach(pOther => {
                            if (pOther.id !== p.id) {
                                if (!(log.payments?.[pOther.id]?.isPaid)) {
                                    // 重新計算 individual amount (莊家多付)
                                    const baseAmount = Number(store.settings.base) + ((log.tai || 0) * Number(store.settings.tai));
                                    const isDealerOther = (pOther.id === log.dealerId);
                                    const dealerExtraTai = ((log.dealerStreak || 0) * 2) + 1;
                                    const amountOther = isDealerOther ? (baseAmount + (Number(store.settings.tai) * dealerExtraTai)) : baseAmount;
                                    balances[p.id] += amountOther;
                                }
                            }
                        });
                    } else {
                        // 放槍：檢查單一輸家
                        if (!(log.payments?.[log.loserId]?.isPaid)) {
                            balances[p.id] += log.amount;
                        }
                    }
                }
            }
        });
    });
    return balances;
});

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
  baseTai: 0, // Hand Tai
  lianTai: 0, // Streak Tai
  includeLian: true, // Toggle
  details: '', // Store scoring breakdown
  isLocked: false // Lock type selection if Zimo
});

const loserOptions = computed(() => {
  if (scoreForm.winner === null || scoreForm.winner === undefined) return [];
  return store.players.filter(p => p.id !== scoreForm.winner);
});

const handleAiResult = (result) => {
  // result = { concealed: [...], exposed: [...], tai: ..., desc: [...], isZimo: bool }
  console.log("AI 結果:", result);
  
  // Pre-fill form
  scoreForm.winner = store.myPlayerId !== null ? store.myPlayerId : (store.players[0]?.id || 0);
  scoreForm.type = result.isZimo ? 'zimo' : 'ron'; // Auto-detect Zimo
  scoreForm.isLocked = !!result.isZimo; // Lock if Zimo
  scoreForm.loser = null;
  
  // Calculate Base Tai
  let totalTai = typeof result.tai === 'number' ? result.tai : 0;
  
  // Format details
  let detailArr = [];
  if (result.desc && Array.isArray(result.desc)) {
    detailArr = result.desc.map(d => `${d.name}(${d.tai})`);
  }
  
  scoreForm.baseTai = totalTai; 
  scoreForm.tai = totalTai; 
  scoreForm.details = detailArr.join(', ');

  // Save full result for logging
  currentAiResult.value = {
    concealed: result.concealed || [],
    exposed: result.exposed || [],
    winningTile: result.winningTile || null,
    settings: result.settings || {}
  };
  
  // Trigger Lian Tai calculation
  updateLianTai();
  
  // Show Modal
  showActionModal.value = true;
};

// Start watching form changes to update Lian Tai
watch(() => [scoreForm.winner, scoreForm.loser, scoreForm.includeLian], () => {
    if (showActionModal.value) updateLianTai();
});

// Watch modal open to refresh state
watch(showActionModal, (newVal) => {
    if (newVal) {
        initScoreFormWinner();
    }
});

// Also watch players if modal is open (e.g. reload or delay)
watch(() => store.players, () => {
    if (showActionModal.value) {
        initScoreFormWinner();
    }
}, { deep: true });

const initScoreFormWinner = () => {
    // Refresh winner default if unset or invalid
    if (!scoreForm.winner || !store.players.some(p => p.id === scoreForm.winner)) {
         scoreForm.winner = store.dealerId !== null ? store.dealerId : (store.players[0]?.id || 0);
    }
    // Force update Lian Tai based on current settings
    updateLianTai();
};

// Auto-select loser when type becomes 'ron' or winner changes
watch(() => [scoreForm.type, scoreForm.winner, showActionModal.value], () => {
    if (showActionModal.value && scoreForm.type === 'ron') {
        const options = loserOptions.value;
        if (options.length > 0) {
             // If current loser is not in options (e.g. was winner), or is null
             if (!scoreForm.loser || !options.find(p => p.id === scoreForm.loser)) {
                 scoreForm.loser = options[0].id;
             }
        }
    }
}, { immediate: true });

const updateLianTai = () => {
    if (!scoreForm.includeLian) {
        scoreForm.lianTai = 0;
        return;
    }
    
    // Calculate potential streak bonus
    const w = scoreForm.winner;
    const l = scoreForm.type === 'zimo' ? null : scoreForm.loser;
    
    // Only calculate if valid
    if (w !== null) {
        const bonus = store.calculateLianTai(w, l);
        scoreForm.lianTai = bonus;
    }
};

const showLogDetails = (log) => {
    currentDetail.value = log.details || '無詳細資料';
    currentDetailTiles.value = log.tiles || null;
    selectedLogId.value = log.id; // 保存當前記錄 ID
    showDetailDialog.value = true;
};

// Compute structured details list
const currentDetailList = computed(() => {
    if (!currentDetail.value || currentDetail.value === '無詳細資料') return [];
    
    // Parse format "Name(Tai)"
    return currentDetail.value.split(',').map(s => {
        const str = s.trim();
        const match = str.match(/^(.*)\((\d+)\)$/);
        if (match) {
            return { name: match[1], tai: match[2] };
        }
        return { name: str, tai: '' };
    });
});

// 計算當前詳細視窗中的輸家列表及其支付狀態
const currentLogData = computed(() => {
    return store.logs.find(l => l.id === selectedLogId.value);
});

const currentDetailLosers = computed(() => {
    const log = currentLogData.value;
    if (!log) return [];
    
    const losers = [];
    if (log.loserId === null) {
        // 自摸：除了贏家以外都是輸家
        store.players.forEach(p => {
            if (p.id !== log.winnerId) {
                losers.push({
                    id: p.id,
                    name: p.name,
                    isPaid: log.payments?.[p.id]?.isPaid || false
                });
            }
        });
    } else {
        // 放槍：只有一個輸家
        const p = store.players.find(p => p.id === log.loserId);
        if (p) {
            losers.push({
                id: p.id,
                name: p.name,
                isPaid: log.payments?.[p.id]?.isPaid || false
            });
        }
    }
    return losers;
});

const submitScore = () => {
  const winner = scoreForm.winner;
  const loser = scoreForm.type === 'zimo' ? null : scoreForm.loser;
  // Total Tai = Base + Lian
  const tai = Number(scoreForm.tai) + Number(scoreForm.lianTai);
  
  let details = scoreForm.details;
  if (scoreForm.lianTai > 0) {
      const lianText = `連莊(${scoreForm.lianTai})`;
      details = details ? `${details}, ${lianText}` : lianText;
  }
  
  const tiles = currentAiResult.value; // Get saved tiles
  
  if (scoreForm.type === 'ron' && loser === null) {
    showToast('請選擇放槍者');
    return;
  }
  
  store.settleRound(winner, loser, tai, details, tiles); // Pass tiles
  showActionModal.value = false;
  showToast('戰績已更新');
  
  // Reset Form
  setTimeout(() => {
    scoreForm.winner = null; 
    scoreForm.type = 'zimo';
    scoreForm.loser = null;
    scoreForm.tai = 0;
    scoreForm.lianTai = 0;
    scoreForm.details = '';
    scoreForm.isLocked = false;
    currentAiResult.value = null;
    tempInitialData.value = null; // Clear modify history
    initScoreFormWinner(); // Re-init default winner
  }, 300); // Small delay to allow modal transition
};

const scorePreview = computed(() => {
    const preview = {};
    store.players.forEach(p => preview[p.id] = 0);
    
    if (!showActionModal.value) return preview;
    
    const baseAmount = Number(scoreForm.base) || Number(store.settings.base);
    const taiCount = Number(scoreForm.tai);
    const lianCount = Number(scoreForm.lianTai);
    const totalTransferred = baseAmount + (taiCount * Number(store.settings.tai));
    
    const extraTai = (store.dealerStreak * 2) + 1;
    const extraAmount = Number(store.settings.tai) * extraTai;

    const winnerId = scoreForm.winner;
    const loserId = scoreForm.type === 'zimo' ? null : scoreForm.loser;
    
    if (loserId === null) {
        // 自摸
        const isWinnerDealer = (winnerId === store.dealerId);
        let totalWin = 0;
        store.players.forEach(p => {
            if (p.id === winnerId) return;
            const pPay = (isWinnerDealer || p.id === store.dealerId) 
                         ? (totalTransferred + extraAmount) 
                         : totalTransferred;
            preview[p.id] = -pPay;
            totalWin += pPay;
        });
        preview[winnerId] = totalWin;
    } else {
        // 放槍
        const isWinnerDealer = (winnerId === store.dealerId);
        const isLoserDealer = (loserId === store.dealerId);
        const pPay = (isWinnerDealer || isLoserDealer) 
                     ? (totalTransferred + extraAmount) 
                     : totalTransferred;
        preview[winnerId] = pPay;
        preview[loserId] = -pPay;
    }
    return preview;
});

const handleDeleteLog = () => {
    const logId = selectedLogId.value;
    if (!logId) return;
    
    // 雖然 server 會檢查，但 UI 指導使用者僅刪除最後一筆較安全
    const isLast = store.logs[0]?.id === logId;
    const msg = isLast 
        ? '確定要刪除這筆記錄嗎？分數將會自動撤銷。' 
        : '⚠️ 注意：這不是最後一筆記錄，刪除雖然會退回分數，但可能導致莊家連莊狀態邏輯混亂，確定要繼續？';

    showConfirmDialog({
        title: '確認刪除',
        message: msg,
    }).then(() => {
        store.deleteLog(logId);
        showDetailDialog.value = false;
        showToast('記錄已刪除並退回分數');
    }).catch(() => {});
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
}
.detail-link {
  color: #999;
  font-size: 12px;
  margin-left: 6px;
  cursor: pointer;
  text-decoration: underline;
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
.player-seat { 
    position: absolute; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    width: 80px; 
    
    .avatar-wrapper { 
        font-size: 40px; 
        width: 60px; 
        height: 60px; 
        background: white; 
        border-radius: 50%; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        position: relative; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); 
        border: 3px solid white; 
        
        &.winner { border-color: #07c160; animation: pop 0.3s; } 
        &.loser { border-color: #ee0a24; } 
        
        .score-badge { 
            position: absolute; 
            bottom: -5px; 
            right: -10px; 
            background: #333; 
            color: white; 
            font-size: 12px; 
            padding: 2px 6px; 
            border-radius: 10px; 
            font-weight: bold;
            z-index: 5;
        } 
        
        .dealer-badge {
            position: absolute;
            top: -10px;
            right: -12px;
            background: #FF9800; /* Distinct Orange */
            color: #fff;
            font-size: 12px; /* Larger font */
            padding: 2px 8px; /* More padding */
            border-radius: 12px; /* Pill shape */
            border: 2px solid #fff; /* White border to pop */
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
            font-weight: bold;
            z-index: 10; /* Above score badge */
            white-space: nowrap; /* Prevent wrapping */
        }
    } 
    
    .p-name { 
        margin-top: 5px; 
        font-size: 12px; 
        text-shadow: 0 1px 2px black; 
    } 
}
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
.winner-name { color: #f1c40f; font-weight: bold; margin-right: 4px; }
.amt { color: #f1c40f; font-weight: bold; }
.no-logs { text-align: center; color: rgba(255,255,255,0.5); padding: 20px; font-size: 12px; }

.qr-container { text-align: center; padding: 20px; }

/* 結算面板樣式已移至下方全域 style 以免 scoped 限制傳送 (teleport) 元件 */

.settlement-report-header {
    text-align: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px dashed #ddd; /* Separator */
}
.s-title {
    font-size: 18px;
    font-weight: bold;
    color: #333;
    margin-bottom: 4px;
}
.s-info {
    font-size: 12px;
    color: #999;
}

.settlement-header, .settlement-footer, .settlement-row, .settlement-unpaid {
    display: flex;
    align-items: center;
}

.settlement-header {
    background: #fff;
    border-radius: 8px 8px 0 0;
    padding: 10px 0;
    font-weight: bold;
    border-bottom: 2px solid #eee;
}

.settlement-footer {
    background: #fff;
    border-radius: 0 0 8px 8px;
    padding: 10px 0;
    font-weight: bold;
    border-top: 2px solid #eee;
    margin-top: -1px; /* Connect to body */
}
.settlement-unpaid {
    background: #fff5f5; /* Light red/alert background */
    border-radius: 0 0 8px 8px;
    padding: 10px 0;
    font-weight: bold;
    border-top: 2px dashed #ee0a24;
    margin-top: -1px;
}

.settlement-body {
    max-height: 50vh;
    overflow-y: auto;
    background: #fff;
    color: #333;
}

.settlement-row {
    padding: 6px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
    transition: background 0.2s;
}
.settlement-row.clickable:active {
    background: #f0f0f0;
}
.settlement-row:last-child {
    border-bottom: none;
}

.col-idx {
    width: 30px;
    text-align: center;
    color: #999;
    font-size: 12px;
    flex-shrink: 0;
}

.col-player, .col-score, .col-total {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #333;
}

.col-score { 
    font-family: monospace; 
    font-size: 15px; 
    color: #bbb;
    position: relative;
}
.col-score.paid .score-num {
    text-decoration: line-through;
    opacity: 0.5;
    color: #999 !important;
}
.col-total { font-family: monospace; font-size: 16px; font-weight: bold; }
.paid-icon {
    position: absolute;
    top: 0;
    right: 2px;
    font-size: 10px;
    color: #07c160;
}
.score-num { position: relative; z-index: 1; }

/* Colors */
.win { color: #07c160 !important; font-weight: bold; }
.lose { color: #ee0a24 !important; font-weight: bold; }

.s-avatar { font-size: 20px; margin-bottom: 2px; }
.s-name { font-size: 12px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50px; }

.no-data { padding: 40px; text-align: center; color: #ccc; }
.settlement-actions { margin-top: 15px; }

</style>

<!-- 全域樣式：用於處理被 Teleport 到 body 的 Vant 對話框 -->
<style lang="scss">
.settlement-dialog-custom {
    max-width: 500px !important;
    max-height: 100vh !important;
    border-radius: 16px !important;
    overflow: hidden !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate3d(-50%, -50%, 0) !important;
    margin: 0 !important; /* 確保沒有邊距干擾置中 */
}

.settlement-container {
    padding: 15px;
    background: #f8f8f8;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 讓內部 body 滾動就好 */
}

.settlement-report-header {
    flex-shrink: 0; /* 標題不縮放 */
}

.settlement-body {
    flex: 1; /* 表格佔據剩餘空間並可滾動 */
    overflow-y: auto;
}

.settlement-unpaid, .settlement-footer {
    flex-shrink: 0; /* 底部不縮放 */
}
</style>