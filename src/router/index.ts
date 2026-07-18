import { createRouter, createWebHistory } from 'vue-router'
import { isOnboarded } from '@/infrastructure/onboardingPersistence'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/start',
      name: 'start',
      component: () => import('@/views/StartConditionView.vue'),
    },
    {
      path: '/',
      name: 'calculator',
      component: () => import('@/views/CalculatorView.vue'),
    },
    {
      path: '/conditions',
      name: 'conditions',
      component: () => import('@/views/ConditionsView.vue'),
    },
    {
      path: '/database',
      name: 'database',
      component: () => import('@/views/DatabaseView.vue'),
    },
  ],
})

// Until the start-condition wizard is finished, every route funnels to it. An
// already-onboarded user may still open /start manually to redo their intake.
router.beforeEach((to) => {
  if (!isOnboarded() && to.name !== 'start') return { name: 'start' }
  return true
})
