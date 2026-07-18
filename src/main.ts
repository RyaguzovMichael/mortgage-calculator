import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './assets/theme.css'
import './assets/forms.css'

createApp(App).use(router).mount('#app')
