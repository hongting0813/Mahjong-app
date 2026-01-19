<template>
  <div class="app-wrapper">
    <GameSetup v-if="!store.roomId" />

    <SeatSelector v-else-if="store.myPlayerId === null" />

    <MahjongTable v-else />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useGameStore } from './stores/gameStore';
import GameSetup from './components/GameSetup.vue';
import SeatSelector from './components/SeatSelector.vue';
import MahjongTable from './components/MahjongTable.vue';

const store = useGameStore();

onMounted(() => {
  // 檢查網址是否有 ?room=123456
  const params = new URLSearchParams(window.location.search);
  const roomIdFromUrl = params.get('room');
  
  if (roomIdFromUrl) {
    store.connectAndJoin(roomIdFromUrl);
  }
});
</script>