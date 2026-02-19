<template>
  <van-popup 
    :show="show" 
    position="right" 
    :style="{ width: '85%', height: '100%' }"
    @update:show="$emit('update:show', $event)"
  >
    <div style="display: flex; flex-direction: column; height: 100%; background: #f7f8fa;">
      <van-nav-bar title="操作幫助指南" left-arrow @click-left="$emit('update:show', false)" />
      
      <div style="flex: 1; overflow-y: auto; padding-bottom: 30px;">
        <van-collapse v-model="activeNames">
          <van-collapse-item title="🀄️ 核心操作 (新手必看)" name="1">
            <div style="font-size: 14px; line-height: 1.6; color: #666;">
              <p><b>● 如何記帳？</b><br/>進入房間後，點擊牌桌中央的「🀄️」圖標，即可開啟手動記帳視窗。</p>
              <p><b>● 查看我的戰績？</b><br/>點擊您的「頭像」或「分數」，可開啟個人統計，查看胡牌數及最大台數。</p>
              <p><b>● 如何更換莊家？</b><br/>長按玩家頭像（或點擊個人戰績內的按鈕）即可更換莊家並設定「連莊拉莊」次數。</p>
            </div>
          </van-collapse-item>
          
          <van-collapse-item title="✨ 特色功能 (高手進階)" name="2">
            <div style="font-size: 14px; line-height: 1.6; color: #666;">
              <p><b>● 計分預覽 (預防錯誤)</b><br/>在記帳送出前，底部會出現橘色區塊，明確顯示該局預計的金額變動。</p>
              <p><b>● 支付標記 (對帳神器)</b><br/>點擊紀錄中的「詳細 >」，可對個別輸家勾選「已付現」。結算表底部的「待結餘額」會自動扣除已付額。</p>
              <p><b>● 撤銷/刪除記錄</b><br/>若記錯帳，進入該局「詳細 >」最底部點擊「刪除記錄」，系統會自動退回分數。</p>
            </div>
          </van-collapse-item>
          
          <van-collapse-item title="⚖️ 計分規則 (台灣麻將)" name="3">
            <div style="font-size: 14px; line-height: 1.6; color: #666;">
              <p><b>● 莊家加計計算式</b><br/>採用 <code>(連莊次數 × 2) + 1</code> 規則：</p>
              <ul>
                <li>一加一台 (連0)：1 台</li>
                <li>連一拉一 (連1)：3 台</li>
                <li>連二拉二 (連2)：5 台</li>
                <li>依此類推...</li>
              </ul>
              <p><b>● AI 算台建議</b><br/>拍照時請確保手牌整齊且光線充足，中洞、邊張等特殊台數建議手動勾選核對。</p>
            </div>
          </van-collapse-item>
        </van-collapse>

        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          祝您大發利市，把把自摸！🀄️✨
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  show: Boolean
});

defineEmits(['update:show']);

const activeNames = ref(['1']);
</script>
