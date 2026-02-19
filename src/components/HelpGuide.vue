<template>
  <Teleport to="body">
    <div v-if="show" class="tour-overlay" @click.self="handleOverlayClick">
      <!-- Spotlight Mask -->
      <div 
        class="spotlight" 
        :style="spotlightStyle"
      ></div>

      <!-- Tooltip Content -->
      <div 
        v-if="currentStep" 
        class="tour-tooltip" 
        :style="tooltipStyle"
      >
        <div class="tooltip-header">
          <span class="step-counter">步驟 {{ currentStepIndex + 1 }} / {{ steps.length }}</span>
          <van-icon name="cross" class="close-tour" @click="$emit('update:show', false)" />
        </div>
        <div class="tooltip-body">
          <h3 class="tooltip-title">{{ currentStep.title }}</h3>
          <p class="tooltip-content">{{ currentStep.content }}</p>
        </div>
        <div class="tooltip-footer">
          <van-button 
            v-if="currentStepIndex > 0" 
            size="small" 
            plain 
            round 
            @click="prevStep"
          >上一步</van-button>
          <div style="flex: 1"></div>
          <van-button 
            size="small" 
            type="primary" 
            round 
            @click="nextStep"
          >{{ isLastStep ? '完成' : '下一步' }}</van-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  show: Boolean,
  steps: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:show']);

const currentStepIndex = ref(0);
const targetRect = ref(null);

const currentStep = computed(() => props.steps[currentStepIndex.value]);
const isLastStep = computed(() => currentStepIndex.value === props.steps.length - 1);

// Spotlight Style: Using box-shadow to create a dark overlay with a hole
const spotlightStyle = computed(() => {
  if (!targetRect.value) return { display: 'none' };
  
  const { top, left, width, height } = targetRect.value;
  const padding = 5;
  
  return {
    top: `${top - padding}px`,
    left: `${left - padding}px`,
    width: `${width + padding * 2}px`,
    height: `${height + padding * 2}px`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)'
  };
});

// Tooltip position logic
const tooltipStyle = computed(() => {
  if (!targetRect.value) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  
  const { top, left, width, height } = targetRect.value;
  const winHeight = window.innerHeight;
  const winWidth = window.innerWidth;
  const tooltipPadding = 12;
  const tooltipWidth = 280; // Should match style
  
  let styles = {};
  
  // Vertical Position
  // If too close to bottom (e.g. QR bubble), show above
  if (top + height + 200 > winHeight) {
    styles.bottom = `${winHeight - top + tooltipPadding}px`;
  } else {
    styles.top = `${top + height + tooltipPadding}px`;
  }
  
  // Horizontal Position & Centering
  let horizontalCenter = left + width / 2;
  
  // Adjust if too close to left or right edges
  if (horizontalCenter - tooltipWidth / 2 < 10) {
    styles.left = '10px';
    styles.transform = 'none';
  } else if (horizontalCenter + tooltipWidth / 2 > winWidth - 10) {
    styles.right = '10px';
    styles.transform = 'none';
  } else {
    styles.left = `${horizontalCenter}px`;
    styles.transform = 'translateX(-50%)';
  }
  
  return styles;
});

const updateTargetRect = () => {
  if (!props.show || !currentStep.value) return;
  
  const el = document.querySelector(currentStep.value.target);
  if (el) {
    targetRect.value = el.getBoundingClientRect();
  } else {
    targetRect.value = null; // Target not found, maybe show in center
  }
};

const nextStep = () => {
  if (isLastStep.value) {
    emit('update:show', false);
  } else {
    currentStepIndex.value++;
    updateTargetRect();
  }
};

const prevStep = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
    updateTargetRect();
  }
};

const handleOverlayClick = () => {
  // Prevent closing on backdrop click if needed, or skip to next
};

// Re-calculate rect on scroll/resize
watch(() => props.show, (newVal) => {
  if (newVal) {
    currentStepIndex.value = 0;
    // Delay slightly to ensure target is rendered
    setTimeout(updateTargetRect, 300);
  }
});

onMounted(() => {
  window.addEventListener('resize', updateTargetRect);
  window.addEventListener('scroll', updateTargetRect, true);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateTargetRect);
  window.removeEventListener('scroll', updateTargetRect, true);
});
</script>

<style scoped>
.tour-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000;
  pointer-events: auto;
}

.spotlight {
  position: absolute;
  border-radius: 12px;
  pointer-events: none;
  transition: all 0.3s ease;
}

.tour-tooltip {
  position: absolute;
  width: 280px;
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  z-index: 10001;
  transition: all 0.3s ease;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.step-counter {
  font-size: 12px;
  color: #999;
  font-weight: 500;
}

.close-tour {
  font-size: 18px;
  color: #ccc;
  cursor: pointer;
}

.tooltip-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #333;
}

.tooltip-content {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.tooltip-footer {
  margin-top: 16px;
  display: flex;
  align-items: center;
}
</style>
