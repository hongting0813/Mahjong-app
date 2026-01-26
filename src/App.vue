<template>
  <div class="app-wrapper">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from './stores/gameStore';

const store = useGameStore();
const router = useRouter();

onMounted(() => {
  // 檢查網址是否有 ?room=123456 (兼容舊連結)
  const params = new URLSearchParams(window.location.search);
  const roomIdFromUrl = params.get('room');
  
  if (roomIdFromUrl) {
    // 轉址到新的路由路徑
    router.push(`/room/${roomIdFromUrl}`);
  }
});
</script>