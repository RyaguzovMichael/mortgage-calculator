<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputs } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { isBuiltInProduct } from '@/infrastructure/depositCatalogue'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import OwnItemAccordion from './OwnItemAccordion.vue'

const { inputs, addProduct, removeProduct, canRemoveProduct } = useInputs()
const { t } = useI18n()
const { productTerms } = useFormat()

// Split by where the deposit comes from, not by a stored flag: the file decides.
const builtInProducts = computed(() =>
  inputs.deposits.products.filter((p) => isBuiltInProduct(p.id)),
)
const ownProducts = computed(() => inputs.deposits.products.filter((p) => !isBuiltInProduct(p.id)))
</script>

<template>
  <section class="field-group">
    <h3>{{ t('depositsTab.builtInTitle') }}</h3>
    <p class="note">{{ t('depositsTab.builtInNote') }}</p>
    <div v-for="product in builtInProducts" :key="product.id" class="built-in">
      <span class="item-name">{{ product.name }}</span>
      <span class="item-terms">{{ productTerms(product) }}</span>
    </div>
  </section>

  <section class="field-group">
    <header class="section-head">
      <h3>{{ t('depositsTab.ownTitle') }}</h3>
      <button type="button" @click="addProduct">{{ t('depositsTab.addButton') }}</button>
    </header>
    <p v-if="ownProducts.length === 0" class="note">{{ t('depositsTab.ownEmpty') }}</p>
    <OwnItemAccordion
      v-for="product in ownProducts"
      :key="product.id"
      :name="product.name"
      :terms="productTerms(product)"
    >
      <div class="own-head">
        <input
          v-model="product.name"
          type="text"
          :aria-label="t('depositsTab.nameAriaLabel', { id: product.id })"
        />
        <button
          type="button"
          :disabled="!canRemoveProduct(product.id)"
          :title="
            canRemoveProduct(product.id)
              ? t('depositsTab.removeTitleEnabled')
              : t('depositsTab.removeTitleDisabled')
          "
          @click="removeProduct(product.id)"
        >
          {{ t('depositsTab.removeButton') }}
        </button>
      </div>
      <PercentField v-model="product.annualRate" :label="t('depositsTab.rateLabel')" />
      <NumberField
        v-model="product.payoutPeriodMonths"
        :label="t('depositsTab.payoutLabel')"
        :suffix="t('common.monthsSuffix')"
        :hint="t('depositsTab.payoutHint')"
      />
    </OwnItemAccordion>
  </section>
</template>
