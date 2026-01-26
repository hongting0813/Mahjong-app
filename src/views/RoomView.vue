<template>
  <div class="room-container">
     <van-nav-bar
      v-if="!store.isPlaying" 
      :title="`房號：${roomId}`"
      left-text="首頁"
      left-arrow
      @click-left="goHome"
      fixed
      placeholder
      z-index="100"
    />
    <!-- 如果不想在打牌時顯示 NavBar，可以用 v-if 控制，或者設計收合 -->
    <!-- 這裡假設打牌時 (MahjongTable) 可能有自己的 header 或全螢幕，這裏先簡單處理 -->

    <div class="room-content">
      <SeatSelector v-if="store.myPlayerId === null" />
      <MahjongTable v-else />
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import SeatSelector from '../components/SeatSelector.vue';
import MahjongTable from '../components/MahjongTable.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

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
  min-height: 100vh;
  background: #f0f2f5;
}
.room-content {
    /* 如果有 nav bar placeholder，這裡不需要額外 padding-top，否則需要 */
}
</style>
