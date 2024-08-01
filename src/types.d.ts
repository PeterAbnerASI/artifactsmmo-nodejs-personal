
declare type RegexMatchedString<Pattern extends string> = `${string & { __brand: Pattern }}`

/**
 * @match ^[a-z0-9_-]+$
 */
declare type TechnicalName = string
/**
 * @match ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$
 */
declare type DateTimeIso = string

declare type Slot = "weapon" | "shield" | "helmet" | "body_armor" | "leg_armor" | "boots" | "ring1" | "ring2" | "amulet" | "artifact1" | "artifact2" | "artifact3" | "consumable1" | "consumable2"

declare type ContentType = "monster" | "resource" | "workshop" | "bank" | "grand_exchange" | "tasks_master"

declare type PageInput<T> = T & {
  /**
   * @default 1
   * @minimum 1
   */
  page?: number
  /**
   * @default 50
   * @minimum 1
   * @maximum 100
   */
  size?: number

}

declare type MapsInput = PageInput<{
  content_code?: TechnicalName
  content_type?: ContentType
}>

declare type MonstersInput = PageInput<{
  drop?: TechnicalName
  max_level?: number
  min_level?: number
}>

declare type Cooldown = {
  total_seconds: number
  remaining_seconds: number
  totalSeconds: number
  remainingSeconds: number
  expiration: DateTimeIso
  reason: string
}

declare type MapContent = {
  name: string
  skin: TechnicalName
  x: number
  y: number
  content: null | {
    type: ContentType
    code: TechnicalName
  }
}

declare type Monster = {
  name: string
  code: string
  level: number
  hp: number
  attack_fire: number
  attack_earth: number
  attack_water: number
  attack_air: number
  res_fire: number
  res_earth: number
  res_water: number
  res_air: number
  min_gold: number
  max_gold: number
  drops: {
    code: string
    rate: number
    min_quantity: number
    max_quantity: number
  }[]
}

declare type Resource = {
  name: string
  code: string
  skill: string
  level: number
  drops: {
    code: string
    rate: number
    min_quantity: number
    max_quantity: number
  }[]
}

declare type Item = {
  name: string
  code: TechnicalName
  level: 1,
  type: string
  subtype: string
  description: string
  effects: [] // TODO
  craft: null | {
    skill: string
    level: number
    items: {
      code: string
      quantity: number
    }[]
    quantity: number
  }
}

declare type PageResult<T = null> = {
  data: T
  total: number
  page: number
  size: number
  pages: number
}

declare type ActionResult<T = null> = {
  cooldown: Cooldown
  character: Character
} & T

declare type Character = {
  name: string
  skin: string
  level: number
  xp: number
  max_xp: number
  total_xp: number
  gold: number
  speed: number
  mining_level: number
  mining_xp: number
  mining_max_xp: number
  woodcutting_level: number
  woodcutting_xp: number
  woodcutting_max_xp: number
  fishing_level: number
  fishing_xp: number
  fishing_max_xp: number
  weaponcrafting_level: number
  weaponcrafting_xp: number
  weaponcrafting_max_xp: number
  gearcrafting_level: number
  gearcrafting_xp: number
  gearcrafting_max_xp: number
  jewelrycrafting_level: number
  jewelrycrafting_xp: number
  jewelrycrafting_max_xp: number
  cooking_level: number
  cooking_xp: number
  cooking_max_xp: number
  hp: number
  haste: number
  critical_strike: number
  stamina: number
  attack_fire: number
  attack_earth: number
  attack_water: number
  attack_air: number
  dmg_fire: number
  dmg_earth: number
  dmg_water: number
  dmg_air: number
  res_fire: number
  res_earth: number
  res_water: number
  res_air: number
  x: number
  y: number
  cooldown: number
  cooldown_expiration: DateTimeIso
  weapon_slot: string
  shield_slot: string
  helmet_slot: string
  body_armor_slot: string
  leg_armor_slot: string
  boots_slot: string
  ring1_slot: string
  ring2_slot: string
  amulet_slot: string
  artifact1_slot: string
  artifact2_slot: string
  artifact3_slot: string
  consumable1_slot: string
  consumable1_slot_quantity: number
  consumable2_slot: string
  consumable2_slot_quantity: number
  task: string
  task_type: string
  task_progress: number
  task_total: number
  inventory_max_items: number
  inventory: {
    slot: number
    code: string
    quantity: number
  }[]
  inventory_slot1: string
  inventory_slot1_quantity: number
  inventory_slot2: string
  inventory_slot2_quantity: number
  inventory_slot3: string
  inventory_slot3_quantity: number
  inventory_slot4: string
  inventory_slot4_quantity: number
  inventory_slot5: string
  inventory_slot5_quantity: number
  inventory_slot6: string
  inventory_slot6_quantity: number
  inventory_slot7: string
  inventory_slot7_quantity: number
  inventory_slot8: string
  inventory_slot8_quantity: number
  inventory_slot9: string
  inventory_slot9_quantity: number
  inventory_slot10: string
  inventory_slot10_quantity: number
  inventory_slot11: string
  inventory_slot11_quantity: number
  inventory_slot12: string
  inventory_slot12_quantity: number
  inventory_slot13: string
  inventory_slot13_quantity: number
  inventory_slot14: string
  inventory_slot14_quantity: number
  inventory_slot15: string
  inventory_slot15_quantity: number
  inventory_slot16: string
  inventory_slot16_quantity: number
  inventory_slot17: string
  inventory_slot17_quantity: number
  inventory_slot18: string
  inventory_slot18_quantity: number
  inventory_slot19: string
  inventory_slot19_quantity: number
  inventory_slot20: string
  inventory_slot20_quantity: number
}

declare type BankItem = {
  code: TechnicalName
  quantity: number
}

declare type FightResult = {
  xp: number
  gold: number
  drops: {
    code: TechnicalName
    quantity: number
  }[]
  turns: number
  monster_blocked_hits: {
    fire: number
    earth: number
    water: number
    air: number
    total: number
  }
  player_blocked_hits: {
    fire: number
    earth: number
    water: number
    air: number
    total: number
  }
  logs: string[]
  result: "win" | "lose"
}

declare type GatherResult = {
  xp: number
  items: {
    code: TechnicalName
    quantity: number
  }[]
}