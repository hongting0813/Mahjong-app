<template>
  <div class="page-container">
    <van-nav-bar
      title="創建房間"
      left-text="首頁"
      left-arrow
      @click-left="goHome"
    />
    
    <GameSetup />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import GameSetup from '../components/GameSetup.vue';

const router = useRouter();

const goHome = () => {
  router.push('/');
};
</script>

<style scoped>
.page-container {
  height: 100vh;
  overflow: hidden;
  background: #f0f2f5;
  display: flex;
  flex-direction: column; 
}
</style>
