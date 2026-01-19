<template>
  <div class="seat-selector">
    <h2>請選擇你的位置</h2>
    
    <div class="debug-info">
      <p>連線狀態: 
        <span :class="{ 'connected': store.isConnected, 'disconnected': !store.isConnected }">
          {{ store.isConnected ? '✅ 已連線' : '❌ 未連線' }}
        </span>
      </p>
      <p>房號: {{ store.roomId }}</p>
      <p>玩家數: {{ store.players.length }}</p>
      <p v-if="!store.isConnected" class="error-tip">
        若是「未連線」，請檢查：<br>
        1. 手機與電腦是否在同個 Wi-Fi<br>
        2. 電腦防火牆是否關閉<br>
        3. 網址 IP 是否正確
      </p>
    </div>

    <div v-if="store.players.length === 0" class="loading">
      <van-loading size="24px">正在讀取房間資料...</van-loading>
    </div>

    <div v-else class="grid">
      <div v-for="p in store.players" :key="p.id" class="seat-card" @click="selectSeat(p.id)">
        <div class="avatar">{{ p.avatar }}</div>
        <div class="name">{{ p.name }}</div>
        <div class="status" v-if="p.score !== 0">分數: {{ p.score }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../stores/gameStore';
const store = useGameStore();

const selectSeat = (id) => {
  store.myPlayerId = id;
};
</script>

<style scoped>
.seat-selector { text-align: center; padding: 40px 20px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; }
.seat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: pointer; transition: 0.2s; }
.seat-card:active { transform: scale(0.95); background: #e8f3ff; }
.avatar { font-size: 40px; }
.name { font-weight: bold; margin-top: 5px; }

/* 新增樣式 */
.debug-info { background: #f0f0f0; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; text-align: left; }
.connected { color: green; font-weight: bold; }
.disconnected { color: red; font-weight: bold; }
.error-tip { color: #d63031; font-size: 12px; margin-top: 5px; }
.loading { margin-top: 50px; color: #666; }
</style>