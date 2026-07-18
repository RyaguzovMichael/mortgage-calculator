<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const REPO_URL = 'https://github.com/RyaguzovMichael/mortgage-calculator'
const CONTACT_EMAIL = 'miha890r@gmail.com'
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <p class="disclaimer">{{ t('footer.disclaimer') }}</p>
    <div class="bottom">
      <span class="copyright">{{ t('footer.copyright', { year }) }}</span>
      <nav class="links">
        <a :href="REPO_URL" target="_blank" rel="noopener noreferrer">{{ t('footer.github') }}</a>
        <a :href="`${REPO_URL}/blob/master/README.md`" target="_blank" rel="noopener noreferrer">{{
          t('footer.readme')
        }}</a>
        <a :href="`${REPO_URL}/blob/master/LICENSE`" target="_blank" rel="noopener noreferrer">{{
          t('footer.license')
        }}</a>
        <a :href="`mailto:${CONTACT_EMAIL}`">{{ t('footer.contact') }}</a>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--surface-1);
  border-top: 1px solid var(--border);
}
.disclaimer {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
  max-width: 900px;
}
.bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.copyright {
  font-size: var(--text-sm);
  color: var(--text-muted);
  white-space: nowrap;
}
.links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.links a {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-decoration: none;
}
.links a:hover {
  color: var(--text-primary);
  text-decoration: underline;
}
</style>
