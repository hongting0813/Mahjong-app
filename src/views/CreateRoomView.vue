<template>
  <div class="page-container">
    <van-nav-bar
      title="創建房間"
      left-text="首頁"
      left-arrow
      @click-left="goHome"
    >
      <template #right>
        <van-icon name="question-o" size="22" @click="showHelp = true" />
      </template>
    </van-nav-bar>
    
    <GameSetup />

    <HelpGuide v-model:show="showHelp" :steps="setupSteps" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import GameSetup from '../components/GameSetup.vue';
import HelpGuide from '../components/HelpGuide.vue';

const router = useRouter();
const showHelp = ref(false);

const setupSteps = [
  {
    target: '#tour-setup-color',
    title: '個性化背景',
    content: '您可以選擇喜歡的牌桌顏色。這個顏色會同步給所有進入房間的玩家。'
  },
  {
    target: '#tour-setup-rules',
    title: '設定規則',
    content: '在這裡設定本局的底與台。這會影響後續記帳時的自動計算金額。'
  },
  {
    target: '#tour-setup-players',
    title: '玩家資料',
    content: '您可以自訂四位玩家的名稱與頭像。這些資料會同步給加入房間的所有牌友。'
  },
  {
    target: '.create-btn', // GameSetup doesn't have id on button, but let's use class or better add id
    title: '開始對局',
    content: '設定完成後點擊建立，系統將自動產生房號並進入房間。'
  }
];

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
