<template>
  <div class="room-container">
     <van-nav-bar
      v-if="!store.isPlaying" 
      :title="`房號：${roomId}`"
      left-text="首頁"
      left-arrow
      @click-left="goHome"
      :border="false"
    >
        <template #right>
          <van-icon name="question-o" size="22" @click="showHelp = true" />
        </template>
      </van-nav-bar>
    <!-- Navbar is now part of the flow, no fixed/placeholder needed -->

    <div class="room-content">
      <SeatSelector v-if="store.myPlayerId === null" />
      <MahjongTable v-else />
    </div>

    <!-- 全局幫助指南 -->
    <HelpGuide v-model:show="showHelp" :steps="currentSteps" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import SeatSelector from '../components/SeatSelector.vue';
import MahjongTable from '../components/MahjongTable.vue';
import HelpGuide from '../components/HelpGuide.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();
const showHelp = ref(false);

const roomSteps = [
  {
    target: '#tour-table',
    title: '麻將桌現場',
    content: '這裡是您的對戰牌桌，顯示了所有玩家的座位、分數、以及目前的莊家狀態。'
  },
  {
    target: '#tour-center',
    title: '核心記帳區 🀄️',
    content: '點擊中央的 🀄️ 圖示，即可開啟手動記帳。系統會根據目前的莊家自動計算正確的台數變動。'
  },
  {
    target: '#tour-header-btns',
    title: '功能控制',
    content: '「結算」可以查看整場的總損益；「邀請」則會顯示 QR Code 讓牌友掃描加入。'
  },
  {
    target: '#tour-logs',
    title: '戰況紀錄區',
    content: '每一局的記帳結果都會出現在這裡。點擊「詳細」可以查看支付狀態或撤銷記錯的內容。'
  }
];

const seatSteps = [
  {
    target: '.seat-selector h2',
    title: '選擇座位',
    content: '進入房間後，請先點擊您的頭像來選擇位置。'
  },
  {
    target: '#tour-seat-grid',
    title: '確認身份',
    content: '選擇座位後，系統會將您定位在畫面下方，方便您以正確視角觀看戰局。'
  }
];

const currentSteps = computed(() => {
  return store.myPlayerId === null ? seatSteps : roomSteps;
});

const roomId = computed(() => route.params.roomId);

const goHome = () => {
    // 這裡可以加入離開房間的確認
    router.push('/');
};

onMounted(() => {
  if (roomId.value) {
    // 如果 store 裡面沒有 roomId 或不一樣，重新連線
    if (store.roomId !== roomId.value) {
        store.connectAndJoin(roomId.value);
    }
  }
});
</script>

<style scoped>
.room-container {
  height: 100vh; /* Fixed viewport height */
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
  overflow: hidden; /* Prevent body scroll */
}
.room-content {
  flex: 1; /* Fill remaining space */
  overflow: hidden; /* Or auto if you want internal scroll, but MahjongTable handles it */
  position: relative;
  display: flex;
  flex-direction: column;
}
</style>
