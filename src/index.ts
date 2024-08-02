import { api } from "./api"
import { CHARACTER_NAME } from "./env"

const main = async () => {

  const c = api.character(CHARACTER_NAME)
  const s = c.smart

  await s.await()
  // await s.train("copper_ring", 5)
  await s.craftRecursive("copper_ring", 4)
  // await c.equip("copper_armor", "body_armor")
}

// train("itemcode", skilltargetlevel)
// checks how many items can be craft with one inventory
// empty current inventory
// makes rounds and recycles items
// checks after each round if the target is reached


main()
