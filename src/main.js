import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// 引入 Vant 樣式
import 'vant/lib/index.css';
// 引入 Vant 組件 (為了方便，這裡全量引入，正式上線建議按需引入)
import Vant from 'vant';

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Vant)
app.mount('#app')