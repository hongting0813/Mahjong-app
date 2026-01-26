import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CreateRoomView from '../views/CreateRoomView.vue'
import JoinView from '../views/JoinView.vue'
import RoomView from '../views/RoomView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/create',
      name: 'create',
      component: CreateRoomView
    },
    {
      path: '/join',
      name: 'join',
      component: JoinView
    },
    {
      path: '/room/:roomId',
      name: 'room',
      component: RoomView
    }
  ]
})

export default router
