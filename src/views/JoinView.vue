<template>
  <div class="page-container">
    <van-nav-bar
      title="加入房間"
      left-text="首頁"
      left-arrow
      @click-left="goHome"
    />

    <div class="content">
      <div class="input-area">
        <div class="label">請輸入房號</div>
        <van-field
          v-model="roomId"
          placeholder="六位數房號"
          input-align="center"
          class="room-input"
          maxlength="6"
          @keydown.enter="joinRoom"
        />
        <van-button 
          type="primary" 
          block 
          round 
          class="join-btn"
          :disabled="roomId.length !== 6"
          @click="joinRoom"
        >
          加入
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import { showToast } from 'vant';

const router = useRouter();
const store = useGameStore();
const roomId = ref('');

const goHome = () => {
  router.push('/');
};

// 監聽錯誤訊息
watch(() => store.errorMsg, (newVal) => {
    if (newVal) {
        showToast({
            message: newVal,
            type: 'fail',
            wordBreak: 'break-word',
        });
    }
});

// 監聽 roomId 變化，如果有值則跳轉
watch(() => store.roomId, (newVal) => {
  if (newVal) {
    router.push(`/room/${newVal}`);
  }
});

const joinRoom = () => {
  if (roomId.value.length === 6) {
    store.connectAndJoin(roomId.value);
  }
};
</script>

<style scoped>
.page-container {
  height: 100vh;
  background-color: #f7f8fa;
}

.content {
  padding: 40px 20px;
  display: flex;
  justify-content: center;
}

.input-area {
  width: 100%;
  max-width: 300px;
  text-align: center;
}

.label {
  margin-bottom: 20px;
  font-size: 1.2em;
  color: #333;
}

.room-input {
  font-size: 24px;
  letter-spacing: 5px;
  margin-bottom: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px;
}

.join-btn {
  height: 50px;
  font-size: 18px;
}
</style>
