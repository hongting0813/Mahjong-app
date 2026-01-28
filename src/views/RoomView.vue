<template>
  <div class="room-container">
     <van-nav-bar
      v-if="!store.isPlaying" 
      :title="`房號：${roomId}`"
      left-text="首頁"
      left-arrow
      @click-left="goHome"
      :border="false"
    />
    <!-- Navbar is now part of the flow, no fixed/placeholder needed -->

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
