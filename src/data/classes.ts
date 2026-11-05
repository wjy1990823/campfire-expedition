import type { ClassDef } from '../sim/types';

export const CLASSES: Record<string, ClassDef> = {
  guardian: {
    id: 'guardian',
    name: '守卫者',
    role: 'tank',
    base: { maxHp: 220, maxMana: 0, atk: 9, armor: 40, crit: 0.05, attackInterval: 1.6, range: 36, moveSpeed: 70, manaRegen: 0 },
    growth: { maxHp: 30, atk: 1.6, armor: 6 },
    basicAttack: { id: 'g_basic', name: '劈砍', kind: 'damage', cooldown: 0, manaCost: 0, power: 1, threatMult: 1 },
    skills: [
      { id: 'g_taunt', name: '嘲讽怒吼', kind: 'taunt', cooldown: 8, manaCost: 0, power: 0 },
      { id: 'g_slam', name: '盾牌猛击', kind: 'damage', cooldown: 5, manaCost: 0, power: 1.6, threatMult: 2 },
      { id: 'g_cleave', name: '顺劈斩', kind: 'aoeDamage', cooldown: 9, manaCost: 0, power: 0.8, threatMult: 1.5 },
    ],
    look: { kind: 'humanoid', skin: '#f4c197', primary: '#8b9bb4', secondary: '#c0392b', headgear: 'helmet', weapon: 'sword', shield: true },
  },
  priest: {
    id: 'priest',
    name: '圣光牧师',
    role: 'healer',
    base: { maxHp: 130, maxMana: 140, atk: 8, armor: 12, crit: 0.08, attackInterval: 2, range: 150, moveSpeed: 65, manaRegen: 5 },
    growth: { maxHp: 16, maxMana: 12, atk: 1.4, armor: 2, manaRegen: 0.3 },
    basicAttack: { id: 'p_basic', name: '惩击', kind: 'damage', cooldown: 0, manaCost: 0, power: 0.8, ranged: true },
    skills: [
      { id: 'p_aoeheal', name: '治疗之环', kind: 'aoeHeal', cooldown: 12, manaCost: 40, power: 2.2, healThreshold: 0.7 },
      { id: 'p_heal', name: '快速治疗', kind: 'heal', cooldown: 1.5, manaCost: 14, power: 3.2, healThreshold: 0.75 },
    ],
    look: { kind: 'humanoid', skin: '#f4c197', hair: '#f7e26b', primary: '#f4f4f4', secondary: '#f7c948', headgear: 'hair', weapon: 'mace', robe: true },
  },
  mage: {
    id: 'mage',
    name: '奥术法师',
    role: 'dps',
    base: { maxHp: 115, maxMana: 140, atk: 13, armor: 10, crit: 0.12, attackInterval: 1.8, range: 160, moveSpeed: 65, manaRegen: 4 },
    growth: { maxHp: 14, maxMana: 12, atk: 2.4, armor: 1.5, manaRegen: 0.3 },
    basicAttack: { id: 'm_basic', name: '奥术飞弹', kind: 'damage', cooldown: 0, manaCost: 0, power: 1, ranged: true },
    skills: [
      { id: 'm_blizzard', name: '暴风雪', kind: 'aoeDamage', cooldown: 11, manaCost: 35, power: 1.3, ranged: true },
      { id: 'm_fireball', name: '火球术', kind: 'damage', cooldown: 4, manaCost: 14, power: 2.2, ranged: true },
    ],
    look: { kind: 'humanoid', skin: '#f4c197', primary: '#3b5dc9', secondary: '#73eff7', headgear: 'hat', weapon: 'staff', robe: true },
  },
};

export const STARTING_PARTY = ['guardian', 'mage', 'priest'] as const;
