<template>
  <div class="setup-container">
    <h2 class="title">🀄️ 開房設定</h2>
    
    <div class="color-picker">
      <span v-for="color in bgColors" :key="color" 
            :style="{ background: color }" 
            class="color-dot" 
            :class="{ active: form.bgColor === color }"
            @click="form.bgColor = color">
      </span>
    </div>

    <van-cell-group inset title="規則">
      <van-field v-model="form.base" type="number" label="底" />
      <van-field v-model="form.tai" type="number" label="台" />
    </van-cell-group>

    <van-cell-group inset title="玩家設定">
      <div v-for="(p, idx) in localPlayers" :key="idx" class="player-row">
        <div class="avatar-select" @click="changeAvatar(idx)">{{ p.avatar }}</div>
        <van-field v-model="p.name" :label="`位置 ${idx+1}`" placeholder="輸入名稱" />
      </div>
    </van-cell-group>

    <div class="btn-area">
      <van-button type="primary" block round @click="handleCreate">建立房間並進入</van-button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';

const router = useRouter();

const store = useGameStore();
const bgColors = ['#0b6623', '#2c3e50', '#8e44ad', '#c0392b']; // 綠, 藍, 紫, 紅
const avatars = ['👨🏻', '👩🏻', '👴🏻', '👵🏻', '🧑🏻', '👱🏻‍♀️', '🐶', '🐱', '🐣', '🐰', '🐭', '🐠', '🤖', '👽', '🤡', '👻', '😈', '💩'];

const form = reactive({ base: 300, tai: 50, bgColor: '#0b6623' });
const localPlayers = reactive([
  { id: 0, name: '東', avatar: '👨🏻', score: 0 },
  { id: 1, name: '南', avatar: '👩🏻', score: 0 },
  { id: 2, name: '西', avatar: '👴🏻', score: 0 },
  { id: 3, name: '北', avatar: '👵🏻', score: 0 },
]);

const changeAvatar = (idx) => {
  // 簡單隨機換 (實際可做彈窗選擇)
  const current = avatars.indexOf(localPlayers[idx].avatar);
  localPlayers[idx].avatar = avatars[(current + 1) % avatars.length];
};

const handleCreate = () => {
  // 產生隨機房間號碼 (6位數)
  const roomId = Math.floor(100000 + Math.random() * 900000).toString();
  store.createRoom(roomId);
  
  // 等待連線後發送設定
  setTimeout(() => {
    store.updateSettings(form, localPlayers);
    // 預設房主是第一個位置，但為了測試，我們讓使用者自己選
    
    // 跳轉到房間頁面
    router.push(`/room/${roomId}`);
  }, 500);
};
</script>
<style scoped>
.setup-container { padding: 20px 0; background: #f0f2f5; min-height: 100vh; }
.color-picker { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; }
.color-dot { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.color-dot.active { transform: scale(1.2); border-color: #333; }
.player-row { display: flex; align-items: center; background: white; padding: 5px 15px; border-bottom: 1px solid #eee; }
.avatar-select { font-size: 24px; margin-right: 10px; cursor: pointer; }
.btn-area { padding: 20px; }
</style>