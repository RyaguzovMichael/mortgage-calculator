# Архитектура расчётного ядра (State Machine & Game Loop)

> **Статус: справочный документ, не текущая архитектура.** Ядро в итоге не пошло
> по пути класс-стейтов из этого файла — вместо четырёх параллельных
> стейт-машин `src/engine/runPlan.ts` стал одним драйвером, который читает
> различия между вариантами из данных (`PurchasePlan` — четыре решения: `loan`,
> `buyWhen`, `borrow`, `repay`, плюс `housing`). Это решение более общее: тот
> же драйвер прогоняет и пользовательские планы, которые не свести к
> заранее написанным классам-состояниям. Единственная идея отсюда, которой в
> движке не хватало, — проверка платёжеспособности перед выдачей кредита
> (`Credit.canBeIssued`, см. ниже) — она реализована в `runPlan.ts` как
> `canAffordPayment`. Остальное здесь оставлено как история и справочный
> материал, а не как план к исполнению.

## Контекст задачи
Необходимо реализовать ядро симуляции для сравнения стратегий покупки недвижимости (ипотека Halyk, ипотека Отбасы, покупка без ипотеки). 
Ядро должно быть написано на **чистом TypeScript** без привязок к UI-фреймворкам.
Основа архитектуры — паттерн State внутри Game Loop (ежемесячный цикл расчёта).

## Глобальные правила для генерации кода (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ)
1. **Никаких комментариев в коде.** Генерируй чистый, самодокументируемый TypeScript код без `//` и `/** */`.
2. **Тестирование:** Если пишешь тесты, используй только стандартные ассерты (например, встроенный `assert` из Node или базовый `expect`). Строго запрещено использовать библиотеки в стиле FluentAssertions.
3. Соблюдай строгую типизацию.

---

## 1. Базовые контракты (Interfaces)

```typescript
export type MarketData = {
  apartmentPrice: number;
  rentPrice: number;
};

export interface Deposit {
  get balance(): number;
  put(amount: number): void;
  canWithdrawSafely(): boolean;
  forceWithdraw(amount: number): void;
  processMonth(): void;
}

export interface Credit {
  get debt(): number;
  canBeIssued(targetAmount: number, linkedDeposit: Deposit | null): boolean;
  issue(amount: number): void;
  getMonthlyPayment(): number;
  pay(amount: number): { principalPaid: number; interestPaid: number };
  processMonth(): void;
}

export interface SimulationMetrics {
  totalIncome: number;
  totalOutcome: number; 
  hasApartment: boolean;
}

export interface SimulationContext {
  currentState: ScenarioState;
  kaspiDeposit: Deposit;
  otbasyDeposit: Deposit | null;
  mortgage: Credit | null;
  metrics: SimulationMetrics;
  
  changeState(newState: ScenarioState): void;
}

export interface ScenarioState {
  processMonth(ctx: SimulationContext, market: MarketData, income: number): void;
}
2. Оркестратор (SimulationEngine)
Движок прокручивает цикл (Game Loop) заданное количество месяцев.
Логика одного тика (месяца):

Рассчитать глобальные MarketData и Income для текущего месяца.

Для каждого сценария (SimulationContext):

Передать market и income в currentState.processMonth(...).

Вызвать processMonth() у всех активных депозитов и кредитов (начисление процентов).

Сохранить снепшот текущего состояния для последующего вывода в таблицу.

3. Метрики и маршрутизация денег (Income / Outcome)
Внутри processMonth каждого стейта происходит маршрутизация денежного потока:

Income (входящие деньги, зарплата) — прибавляется к ctx.metrics.totalIncome.

Outcome (безвозвратные траты: аренда, проценты по кредиту) — прибавляется к ctx.metrics.totalOutcome.

Тело кредита или переводы на депозит метриками Income/Outcome не считаются (это перераспределение активов).

Логика безопасного снятия с депозита:
Если стейту нужно снять деньги с депозита, он проверяет deposit.canWithdrawSafely().
Если метод возвращает false, стейт пропускает снятие в этом месяце. Если снятие критично (например, на первоначальный взнос), вызывается forceWithdraw, что внутри депозита сбрасывает накопленный период капитализации.

4. Описание состояний (State Machines) по вариантам
Каждый вариант начинается в состоянии WaitingForSaleState (до месяца продажи старой квартиры).

Вариант 1: Halyk сразу (Immediate)
WaitingForSaleState: Все свободные деньги идут в Kaspi. В месяц продажи фиксируется продажа, сразу берется кредит (взнос = 20% от целевого кредита из Kaspi). hasApartment = true. Переход в HalykMortgageState.

HalykMortgageState: Аренды нет. Весь income идет в mortgage.pay (аннуитет + досрочное погашение тела). Возвращенный interestPaid пишется в totalOutcome. Если debt === 0, переход в DoneState.

DoneState: Все деньги уходят на Kaspi.

Вариант 2: Halyk отложенно (Delayed)
WaitingForSaleState: Накопление в Kaspi. При наступлении месяца продажи — переход в AccumulatingState.

AccumulatingState: Оплата аренды (пишется в totalOutcome). Пополнение Kaspi на фиксированную сумму (например, 100 000) или весь остаток. Ждем заданного N месяца. На N месяц: весь баланс Kaspi идет как первоначальный взнос. Выдача кредита. hasApartment = true. Переход в HalykMortgageState.

HalykMortgageState: Досрочное погашение, как в Варианте 1.

Вариант 3: Otbasy (Сложная логика)
WaitingForSaleState: Накопление в Kaspi. В месяц продажи: часть денег от продажи (параметр, по умолчанию 50% целевого кредита) кладется на OtbasyDeposit (засев). Переход в OtbasyAccumulatingState.

OtbasyAccumulatingState:

Оплата аренды (totalOutcome).

Из остатка: 100 000 идет в OtbasyDeposit, остальное в KaspiDeposit.

Проверка: mortgage.canBeIssued(...) (внутри кредита проверяется 50% и CC >= 5).

Если true: выдача кредита, покупка квартиры (hasApartment = true), переход в OtbasyMortgageState.

OtbasyMortgageState:

Аренды нет.

Из income платится только аннуитет (досрочно гасить невыгодно).

Оставшиеся деньги идут в KaspiDeposit.

Условие закрытия: стейт каждый месяц проверяет, хватает ли баланса Kaspi на полное закрытие долга (kaspi.balance >= mortgage.debt). Если да, делает forceWithdraw с Kaspi на сумму долга, гасит кредит полностью и переходит в DoneState.

DoneState: Весь поток идет в Kaspi.

Вариант 4: Без ипотеки (Cash)
WaitingForSaleState: Накопление в Kaspi. После продажи переход в CashAccumulatingState.

CashAccumulatingState: Оплата аренды (totalOutcome). Весь остаток идет в KaspiDeposit. Ждем, пока kaspi.balance >= market.apartmentPrice. Как только хватает — покупка за наличные (списание с депозита, hasApartment = true), переход в DoneState.

DoneState: Весь поток идет в Kaspi.

5. Задачи для реализации
Создать базовые интерфейсы и DTO.

Написать движок SimulationEngine.

Реализовать классы KaspiDeposit (с логикой штрафа за сбитый период) и OtbasyDeposit (со своей ставкой и отдельным учетом премии).

Реализовать кредиты HalykCredit и OtbasyCredit (с логикой проверки CC).

Написать стейты для каждого из 4-х сценариев и связать их переходами.
