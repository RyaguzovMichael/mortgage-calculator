<script setup lang="ts">
import { computed } from 'vue'
import { useInputs } from '@/app/useInputs'
import { productTerms } from '@/app/format'
import { isBuiltInProduct } from '@/infrastructure/depositCatalogue'
import NumberField from './NumberField.vue'
import PercentField from './PercentField.vue'

const { inputs, addProduct, removeProduct, canRemoveProduct } = useInputs()

// Split by where the deposit comes from, not by a stored flag: the file decides.
const builtInProducts = computed(() => inputs.deposits.products.filter((p) => isBuiltInProduct(p.id)))
const ownProducts = computed(() => inputs.deposits.products.filter((p) => !isBuiltInProduct(p.id)))
</script>

<template>
  <section class="field-group">
    <h3>Встроенные вклады</h3>
    <p class="note">
      Из файла <code>data/deposits.yml</code>. Их нельзя изменить или удалить — правятся в файле,
      и правка доезжает до всех.
    </p>
    <div v-for="product in builtInProducts" :key="product.id" class="built-in">
      <span class="item-name">{{ product.name }}</span>
      <span class="item-terms">{{ productTerms(product) }}</span>
    </div>
  </section>

  <section class="field-group">
    <header class="section-head">
      <h3>Свои вклады</h3>
      <button type="button" @click="addProduct">+ Добавить</button>
    </header>
    <p v-if="ownProducts.length === 0" class="note">
      Пока ничего. Добавьте вклад, если у вас есть предложение банка, которого нет выше — и
      выберите его основным во вкладке «Деньги».
    </p>
    <div v-for="product in ownProducts" :key="product.id" class="own">
      <div class="own-head">
        <input v-model="product.name" type="text" :aria-label="`Название вклада ${product.id}`" />
        <button
          type="button"
          :disabled="!canRemoveProduct(product.id)"
          :title="
            canRemoveProduct(product.id)
              ? 'Удалить вклад'
              : 'Нельзя удалить: сейчас на него идут все деньги'
          "
          @click="removeProduct(product.id)"
        >
          Удалить
        </button>
      </div>
      <PercentField v-model="product.annualRate" label="Ставка" />
      <NumberField
        v-model="product.payoutPeriodMonths"
        label="Выплата раз в"
        suffix="мес"
        hint="1 = снятие в любой момент без потерь. Больше — проценты сгорают при снятии до выплаты."
      />
      <p class="note">{{ productTerms(product) }}</p>
    </div>
  </section>
</template>
