import chalk from "chalk"
import { fetchApi, toQueryString } from "./fetch"
import { secondsToDateTime, secondsToFriendly } from "./log"
import { filter, find, get, ListIterateeCustom } from "lodash"
import { getCached } from "./cache"
import { expectedTryCountForDrop } from "./utilities"

const endpoint = <Result = any, Input extends any[] = []>(endpoint: string, inputTransformerOrMethod?: ((...input: Input) => object) | 'POST') => {
  const bodyTransformer = typeof inputTransformerOrMethod === 'function' ? inputTransformerOrMethod : undefined
  return (...input: Input) => fetchApi(
    endpoint,
    inputTransformerOrMethod !== undefined ? 'POST' : 'GET',
    bodyTransformer && input ? bodyTransformer(...input) : undefined
  ) as Promise<Result>
}
const action = <Result = null, Input extends any[] = []>(name: string, action: string, inputTransformer?: ((...input: Input) => object)) => {
  return endpoint<ActionResult<Result>, Input>(`/my/${name}/action/${action}`, inputTransformer || "POST")
}

const fetchPages = async <T>(caller: (page?: number) => Promise<PageResult<T[]>>) => {
  const { data, pages } = await caller()
  const results = data
  for (let page = 2; page <= pages; page++) {
    results.push(...(await caller(page)).data)
  }
  return results
}

const fetchContentType = <T extends object>(type: "items" | "monsters" | "resources" | "maps") => {

  const all = () => getCached<T[]>(`all-${type}`, () => fetchPages((page = 1) => fetchApi(`/${type}?page=${page}`)))

  return {
    all,
    find: (query: ListIterateeCustom<T, boolean>) => all().then(all => find(all, query)),
    findAll: (query: ListIterateeCustom<T, boolean>) => all().then(all => filter(all, query)),
  }
}

export const db = {
  items: fetchContentType<Item>("items"),
  monsters: fetchContentType<Monster>("monsters"),
  resources: fetchContentType<Resource>("resources"),
  maps: fetchContentType<MapContent>("maps"),
}

export const api = {
  characters: endpoint('/characters'),

  bankItems: (input?: PageInput<{ item_code?: TechnicalName }>) => endpoint<PageResult<BankItem[]>>(`/my/bank/items${toQueryString(input)}`)(),
  bankGold: endpoint('/my/bank/gold'),

  logs: endpoint('/logs'),

  character: (name: string) => {

    const wait = async <T>(result?: Promise<ActionResult<T>>) => {
      let cooldown = 0
      if (result) {
        cooldown = (await result)?.cooldown.remaining_seconds
      } else {
        const { cooldown_expiration } = await api.character(name).get()
        if (cooldown_expiration) {
          cooldown = Math.ceil(.001 * (new Date(cooldown_expiration).getTime() - Date.now()))
        }
      }
      if (cooldown > 0) {
        console.log(chalk.greenBright(`Waiting ${cooldown}s...`))
        await new Promise(resolve => setTimeout(resolve, cooldown * 1000))
      }
      return result
    }

    const s = () => api.character(name).smart

    return {
      smart: {
        await: wait,
        depositAll: async () => {
          const { inventory } = await api.character(name).get()
          if (!inventory.some(i => i.quantity > 0)) return
          await wait(api.character(name).smart.moveTo("bank", "content.type"))
          for (const { code, quantity } of inventory) {
            if (quantity < 1 || !code) continue
            console.log(`Depositing ${quantity} of '${code}'...`)
            await wait(api.character(name).depositItem(code, quantity))
          }
        },
        recycle: async (item: TechnicalName, quantity: number | "all" = "all") => {
          const [{ craft }, { inventory }] = await Promise.all([
            (await db.items).find(item),
            api.character(name).get(),
          ])
          if (!craft) throw new Error('This item cannot be recycled')
          const max = inventory.find(i => i.code === item)!.quantity || 0
          if (max === 0) {
            console.log(chalk.red(`No '${item}' to recycle`))
            return
          }
          const times = quantity === "all"
            ? max
            : Math.min(quantity, max)
          if (quantity !== "all" && times < max) {
            console.log(chalk.yellow(`Recycling ${times} times (max: ${max})... Expected duration: ${secondsToFriendly(times * 25)}`))
          } else {
            console.log(`Recycling ${times} times...`)
          }
          await wait(api.character(name).smart.moveTo(craft.skill))
          await wait(api.character(name).recycle(item, times))
        },
        remainingSpace: async () => {
          const { inventory, inventory_max_items } = await api.character(name).get()
          return inventory_max_items - inventory.reduce((acc: number, item) => acc + item.quantity, 0)
        },
        /**
         *
         * @param resource TechnicalName of the resource to gather
         * @param quantity Number of times to gather the resource, or "full" to gather until the inventory is full
         */
        gather: async (resource?: string, quantity: number | "full" = "full") => {
          if (resource) {
            await wait(api.character(name).smart.moveTo(resource))
          }
          const c = api.character(name)
          const times = quantity === "full"
            ? await c.smart.remainingSpace()
            : quantity
          console.log(`Gathering ${times} times... Expected duration: ${secondsToFriendly(times * 25)} | Finished at: ${secondsToDateTime(times * 25)}`)
          for (let i = 0; i < times; i++) {
            await wait(api.character(name).gather())
          }
        },
        moveTo: async (value: string, property: "content.code" | "content.type" = "content.code") => {
          const [
            { x: currentX, y: currentY },
            { x, y },
          ] = await Promise.all([
            api.character(name).get(),
            db.maps.find((e) => get(e, property) === value),
          ])
          if (currentX !== x || currentY !== y) {
            return api.character(name).move(x, y)
          }
        },
        goToMonster: async (monster: TechnicalName) => wait(api.character(name).smart.moveTo(monster, "content.code")),
        fight: async (monster: TechnicalName, quantity: number | "full" = "full") => {
          await s().goToMonster(monster)
          const times = quantity === "full" ? await s().remainingSpace() : quantity
          console.log(`Fighting ${times} times...`)
          for (let i = 0; i < times; i++) {
            await wait(api.character(name).fight())
          }
        },
        fightForDrop: async (drops: { itemCode: TechnicalName, quantity: number }[]) => {
          const monster = await db.monsters.find(m => drops.every(({ itemCode }) => m.drops.some(d => d.code === itemCode)))
          if (!monster) throw new Error(`No monster drops all the items: ${drops.map(d => d.itemCode).join(', ')}`)
          await wait(s().goToMonster(monster.code))
          const remaining = drops.map(({ itemCode, quantity }) => ({ itemCode, quantity }))
          // TODO Expected duration
          const expectedTryCount = Math.max(...remaining.map(({ itemCode, quantity }) => {
            const drop = monster.drops.find(d => d.code === itemCode)!
            return expectedTryCountForDrop(drop.rate, drop.min_quantity, drop.max_quantity, quantity)
          }))
          console.log(`Expected number of tries: ${expectedTryCount}`)
          while (remaining.some(({ quantity }) => quantity > 0)) {
            const { fight: { drops }, ...result } = await api.character(name).fight()
            await wait(Promise.resolve(result))
            for (const { code, quantity } of drops) {
              const item = remaining.find(i => i.itemCode === code)
              if (item) item.quantity -= quantity
            }
          }
        },
        gatherForDrop: async (drops: { itemCode: TechnicalName, quantity: number }[]) => {
          const resource = await db.resources.find(r => drops.every(({ itemCode }) => r.drops.some(d => d.code === itemCode)))
          if (!resource) throw new Error(`No resource drops all the items: ${drops.map(d => d.itemCode).join(', ')}`)
          await wait(s().moveTo(resource.code))
          const remaining = drops.map(({ itemCode, quantity }) => ({ itemCode, quantity }))
          // TODO Expected duration
          const expectedTryCount = Math.max(...remaining.map(({ itemCode, quantity }) => {
            const drop = resource.drops.find(d => d.code === itemCode)!
            return expectedTryCountForDrop(drop.rate, drop.min_quantity, drop.max_quantity, quantity)
          }))
          console.log(`Expected duration: ${secondsToFriendly(expectedTryCount * 25)} | Finished at: ${secondsToDateTime(expectedTryCount * 25)}`)
          while (remaining.some(({ quantity }) => quantity > 0)) {
            const { details, ...result } = await api.character(name).gather()
            for (const { code, quantity } of details.items) {
              const item = remaining.find(i => i.itemCode === code)
              if (item) item.quantity -= quantity
            }
            await wait(Promise.resolve(result))
          }
        },
        planCraft: async (item: TechnicalName, quantity = 1, useStock = true) => {

          //#region Stock management
          const inventoryUnusedItems: Character["inventory"] = []
          const inventoryUsedItems: BankItem[] = []
          const addInventoryUsedItem = (code: TechnicalName, quantity: number) => {
            const item = find(inventoryUnusedItems, { code })
            if (!item) throw new Error(`Not enough of '${code}' in the inventory`)
            if (item.quantity < quantity) throw new Error(`Not enough of '${code}' in the inventory`)
            item.quantity -= quantity
            const existing = find(inventoryUsedItems, { code })
            if (existing) {
              existing.quantity += quantity
            } else {
              inventoryUsedItems.push({ code, quantity })
            }
          }
          const bankUnusedItems: BankItem[] = []
          const bankUsedItems: BankItem[] = []
          const addBankUsedItem = (code: TechnicalName, quantity: number) => {
            const item = find(bankUnusedItems, { code })
            if (!item) throw new Error(`Not enough of '${code}' in the bank`)
            if (item.quantity < quantity) throw new Error(`Not enough of '${code}' in the bank`)
            item.quantity -= quantity
            const existing = find(bankUsedItems, { code })
            if (existing) {
              existing.quantity += quantity
            } else {
              bankUsedItems.push({ code, quantity })
            }
          }

          const applyStock = (code: TechnicalName, quantity: number) => {
            const quantityInInventory = find(inventoryUnusedItems, { code })?.quantity || 0
            if (quantityInInventory > 0) {
              const quantityToUse = Math.min(quantity, quantityInInventory)
              addInventoryUsedItem(code, quantityToUse)
              quantity -= quantityToUse
            }
            if (quantity > 0) {
              const quantityInBank = find(bankUnusedItems, { code })?.quantity || 0
              if (quantityInBank > 0) {
                const quantityToUse = Math.min(quantity, quantityInBank)
                addBankUsedItem(code, quantityToUse)
                quantity -= quantityToUse
              }
            }
            return quantity
          }

          if (useStock) {
            await Promise.all([
              api.character(name).get().then(({ inventory: i }) => inventoryUnusedItems.push(...i)),
              fetchPages((page) => api.bankItems({ page })).then((items) => bankUnusedItems.push(...items)),
            ])
          }
          //#endregion

          //#region Precalculation
          const _basicItemsNecessary: { code: TechnicalName, quantity: number }[] = []
          const _crafts: { skill: string, item: TechnicalName, quantity: number }[] = []
          const addCraft = (skill: string, item: TechnicalName, quantity: number) => _crafts.splice(0, 0, {skill, item, quantity })
          const addItem = (code: TechnicalName, quantity: number) => {
            const existing = find(_basicItemsNecessary, { code })
            if (existing) {
              existing.quantity += quantity
            } else {
              _basicItemsNecessary.push({ code, quantity })
            }
          }

          const _item = await db.items.find({ code: item })

          const processElement = async (element: Item, itemCountNecessary = 1) => {

            itemCountNecessary = applyStock(element.code, itemCountNecessary)
            if (!itemCountNecessary || itemCountNecessary <= 0) return

            if (element.craft) {
              addCraft(element.craft.skill, element.code, Math.ceil(itemCountNecessary / element.craft.quantity))
              for (const { code, quantity } of element.craft.items) {
                const item = await db.items.find({ code })
                await processElement(item, Math.ceil(quantity * itemCountNecessary / element.craft.quantity))
              }
            } else if (element.type === "resource") {
              addItem(element.code, itemCountNecessary)
            } else {
              throw new Error(`This item cannot be crafted: ${element.code}`)
            }
          }
          await processElement(_item, quantity)

          const resources = _basicItemsNecessary
          const crafts = _crafts
          //#endregion

          console.log(chalk.bold.yellowBright(`[Crafting ${quantity} ${item}]`))
          console.log(chalk.yellow(`  Need to retrieve the following resources:`))
          for (const { code, quantity } of resources) {
            console.log(chalk.gray(`    - ${quantity} ${code}`))
          }
          console.log(chalk.yellow(`  Using the following items:`))
          for (const { code, quantity } of inventoryUsedItems) {
            console.log(chalk.gray(`    - ${quantity} ${code} (inventory)`))
          }
          for (const { code, quantity } of bankUsedItems) {
            console.log(chalk.gray(`    - ${quantity} ${code} (bank)`))
          }
          console.log(chalk.yellow(`  Crafting steps:`))
          for (const { skill, item, quantity } of crafts) {
            console.log(chalk.gray(`    - ${quantity} ${item} (skill: ${skill})`))
          }

          return useStock
            ? { resources, crafts, inventoryUsedItems, bankUsedItems }
            : { resources, crafts }
        },
        craftRecursive: async (item: TechnicalName, quantity = 1, useStock = true) => {

          const { resources, crafts, bankUsedItems } = await s().planCraft(item, quantity, useStock)

          //#region Execution
          console.log(chalk.green(`  Retrieving resources...`))
          // TODO regroup/cell or mob perhaps ?
          for (const { code, quantity } of resources) {
            const { subtype } = await db.items.find({ code })
            if (subtype === "mob") {
              await s().fightForDrop([{ itemCode: code, quantity }])
            } else {
              await s().gatherForDrop([{ itemCode: code, quantity }])
            }
          }

          if (bankUsedItems.length > 0) {
            console.log(chalk.green(`  Retrieving bank items...`))
            await wait(api.character(name).smart.moveTo("bank", "content.type"))
            for (const { code, quantity } of bankUsedItems) {
              await wait(api.character(name).withdrawItem(code, quantity))
            }
          }

          console.log(chalk.green(`  Crafting...`))
          for (const { skill, item, quantity } of crafts) {
            await wait(s().moveTo(skill))
            await wait(api.character(name).craft(item, quantity))
          }
          //#endregion
        },
        craft: async (item: TechnicalName, quantity: number | "full" = "full") => {
          const [
            { inventory },
            { craft },
          ] = await Promise.all([
            api.character(name).get(),
            db.items.find({ code: item }),
          ])
          if (!craft) throw new Error('This item cannot be crafted')
          const maxTimes = craft.quantity * Math.min(...craft.items.map(({ code, quantity }) => Math.floor(inventory.find(i => i.code === code)!.quantity / quantity)))
          if (maxTimes === 0) {
            console.log(chalk.red(`Not enough materials to craft any of '${item}'`))
            for (const { code, quantity } of craft.items) {
              const item = inventory.find(i => i.code === code)!
              console.log(chalk.red(`- ${item.quantity}/${quantity} ${item.code}`))
            }
            return
          }
          const times = quantity === "full"
            ? maxTimes
            : Math.min(quantity, maxTimes)
          if (quantity !== "full" && times < maxTimes) {
            console.log(chalk.yellow(`Crafting ${times} times (max: ${maxTimes})... Expected duration: ${secondsToFriendly(times * 25)}`))
          } else {
            console.log(`Crafting ${times} times...`)
          }
        },
        train: async (itemCode: TechnicalName, target: number) => {
          // checks how many items can be craft with one inventory
          // empty current inventory
          // makes rounds and recycles items
          // checks after each round if the target is reached
          
          //#region Precalculation
          const { resources } = await s().planCraft(itemCode, 1, false)
          const { inventory_max_items } = await api.character(name).get()
      
          const oneItemResourceCount = resources.reduce((acc, { quantity }) => acc + quantity, 0)
          const countPerRound = Math.floor(inventory_max_items / oneItemResourceCount)
          //#endregion

          await s().depositAll()
          
          console.log(`One item needs ${oneItemResourceCount} resources. You can craft ${countPerRound} items per round.`)
        },
      },

      get: endpoint<Character, []>(`/characters/${name}`),

      logs: endpoint(`my/${name}/logs`),
      
      move: action(name, "move", (x: number, y: number) => ({ x, y })),
      equip: action(name, "equip", (item: TechnicalName, slot: Slot) => ({ code: item, slot })),
      unequip: action(name, "unequip", (slot: Slot) => ({ slot })),
      fight: action<{ fight: FightResult }>(name, "fight"),
      gather: action<{ details: GatherResult }>(name, "gathering"),
      craft: action(name, "crafting", (item: TechnicalName, quantity = 1) => ({ code: item, quantity })),
      depositItem: action(name, "bank/deposit", (item: TechnicalName, quantity = 1) => ({ code: item, quantity })),
      depositGold: action(name, "bank/deposit/gold", (quantity: number) => ({ quantity })),
      recycle: action(name, "recycling", (item: TechnicalName, quantity = 1) => ({ code: item, quantity })),
      withdrawItem: action(name, "bank/withdraw", (item: TechnicalName, quantity = 1) => ({ code: item, quantity })),
      withdrawGold: action(name, "bank/withdraw/gold", (quantity: number) => ({ quantity })),
      buy: action(name, "ge/buy", (item: TechnicalName, quantity, price) => ({ code: item, quantity, price })),
      sell: action(name, "ge/sell", (item: TechnicalName, quantity, price) => ({ code: item, quantity, price })),
      taskNew: action(name, "task/new"),
      taskComplete: action(name, "task/complete"),
      taskExchange: action(name, "task/exchange"),
      itemDelete: action(name, "delete", (item: TechnicalName, quantity = 1) => ({ code: item, quantity })),
    }
  },
}