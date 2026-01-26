<template>
  <div class="home-container">
    <div class="logo-area">
      <img src="@/assets/logo.png" alt="App Logo" class="app-logo" />
      <h1 class="app-title">麻將計分通</h1>
    </div>

    <div class="action-area">
      <van-button type="primary" size="large" class="action-btn create-btn" to="/create">
        創建房間
      </van-button>
      
      <van-button type="default" size="large" class="action-btn join-btn" to="/join">
        輸入房號
      </van-button>
    </div>

    <div class="qr-bubble" @click="showQr = true">
      <van-icon name="qr" size="30" color="white" />
    </div>

    <van-popup v-model:show="showQr" round style="padding: 20px; text-align: center;">
      <h3>掃描加入</h3>
      <qrcode-vue :value="currentUrl" :size="200" level="H" />
      <p style="margin-top: 10px; color: #666; margin-bottom: 15px;">請掃描此 QR Code</p>
      <van-button icon="link" round size="small" @click="copyLink">複製連結</van-button>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import QrcodeVue from 'qrcode.vue';
import { showToast } from 'vant';
import { useGameStore } from '../stores/gameStore';

// 取得當前網址 (首頁)
const currentUrl = ref('');
const showQr = ref(false);

const store = useGameStore();

const copyLink = async () => {
  const text = currentUrl.value;
  
  // 1. 嘗試使用現代 API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: '已複製連結', type: 'success' });
      return;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback...');
    }
  }

  // 2. Fallback: 使用舊版 textarea 方式
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      showToast({ message: '已複製連結', type: 'success' });
    } else {
      throw new Error('execCommand failed');
    }
  } catch (err) {
    console.error('Copy failed', err);
    showToast({ message: '複製失敗，請手動複製', type: 'fail' });
  }
};

onMounted(() => {
  store.resetState(); // 回到首頁時重置遊戲狀態 (確保下次進房時會重新選位)
  currentUrl.value = window.location.origin;
});
</script>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  min-height: 100vh;
  background: white; 
}
/* ... existing styles ... */


.logo-area {
  margin-bottom: 50px;
  text-align: center;
}

.app-logo {
  width: 120px;
  height: 120px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  margin-bottom: 15px;
}

.app-title {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  letter-spacing: 2px;
  margin: 0;
}

.action-area {
  width: 100%;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 50px;
}

.action-btn {
  border-radius: 12px;
  font-size: 18px;
  height: 50px;
}

.create-btn {
  background: #0b6623; /* 呼應麻將綠 */
  border-color: #0b6623;
}

.join-btn {
  border: 2px solid #0b6623;
  color: #0b6623;
}

.qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: auto; /* 推到底部或留白 */
}

.qr-label {
  margin-bottom: 10px;
  color: #666;
  font-size: 14px;
}

.qr-bubble {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  background-color: #0b6623;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  cursor: pointer;
  z-index: 1000;
  transition: transform 0.2s;
}

.qr-bubble:active {
  transform: scale(0.9);
}
</style>
