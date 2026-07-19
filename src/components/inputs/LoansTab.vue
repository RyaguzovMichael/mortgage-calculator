<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { useInputs } from '@/app/useInputs'
import { useFormat } from '@/app/useFormat'
import { BUILT_IN_LOANS, isBuiltInLoanProduct } from '@/infrastructure/loanCatalogue'
import AppIcon from '@/components/AppIcon.vue'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'
import OwnItemAccordion from './OwnItemAccordion.vue'

const { inputs, addLoanProduct, removeLoanProduct, canRemoveLoanProduct } = useInputs()
const { t } = useI18n()
const { describeLoan, loanProductTerms } = useFormat()

const halykMeta = computed(() => BUILT_IN_LOANS.find((loan) => loan.id === 'halyk')!)
const otbasyMeta = computed(() => BUILT_IN_LOANS.find((loan) => loan.id === 'otbasy')!)
const builtInProduct = computed(
  () => inputs.loans.products.find((product) => isBuiltInLoanProduct(product.id))!,
)
const ownProducts = computed(() =>
  inputs.loans.products.filter((product) => !isBuiltInLoanProduct(product.id)),
)
</script>

<template>
  <section class="field-group">
    <h3>{{ t('loansTab.builtInTitle') }}</h3>
    <p class="note">{{ t('loansTab.builtInNote') }}</p>
    <div class="built-in">
      <span class="item-name">{{ halykMeta.name }}</span>
      <span class="item-terms">{{ loanProductTerms(builtInProduct) }}</span>
      <p class="note">{{ describeLoan(halykMeta) }}</p>
    </div>
    <div class="built-in">
      <span class="item-name">{{ otbasyMeta.name }}</span>
      <p class="note">{{ describeLoan(otbasyMeta) }}</p>
    </div>
  </section>

  <section class="field-group">
    <header class="section-head">
      <h3>{{ t('loansTab.ownTitle') }}</h3>
      <button type="button" @click="addLoanProduct">
        <AppIcon :path="mdiPlus" :size="16" />
        {{ t('loansTab.addButton') }}
      </button>
    </header>
    <p v-if="ownProducts.length === 0" class="note">{{ t('loansTab.ownEmpty') }}</p>
    <OwnItemAccordion
      v-for="product in ownProducts"
      :key="product.id"
      :name="product.name"
      :terms="loanProductTerms(product)"
    >
      <div class="own-head">
        <input
          v-model="product.name"
          type="text"
          :aria-label="t('loansTab.nameAriaLabel', { id: product.id })"
        />
        <button
          type="button"
          :disabled="!canRemoveLoanProduct(product.id)"
          :title="
            canRemoveLoanProduct(product.id)
              ? t('loansTab.removeTitleEnabled')
              : t('loansTab.removeTitleDisabled')
          "
          @click="removeLoanProduct(product.id)"
        >
          <AppIcon :path="mdiTrashCanOutline" :size="16" />
          {{ t('loansTab.removeButton') }}
        </button>
      </div>
      <PercentField v-model="product.annualRate" :label="t('loansTab.rateLabel')" :step="0.5" />
      <PercentField
        v-model="product.downPaymentFraction"
        :label="t('loansTab.downPaymentLabel')"
        :step="5"
      />
      <NumberField
        v-model="product.maxTermMonths"
        :label="t('loansTab.maxTermLabel')"
        :suffix="t('common.monthsSuffix')"
      />
    </OwnItemAccordion>
  </section>
</template>
