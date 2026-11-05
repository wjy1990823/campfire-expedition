import type { MonsterDef } from '../sim/types';

const claw = { id: 'claw', name: '撕咬', kind: 'damage' as const, cooldown: 0, manaCost: 0, power: 1 };

export const MONSTERS: Record<string, MonsterDef> = {
  slime: {
    id: 'slime',
    name: '苔藓史莱姆',
    base: { maxHp: 70, maxMana: 0, atk: 6, armor: 6, crit: 0.03, attackInterval: 1.8, range: 36, moveSpeed: 40, manaRegen: 0 },
    exp: 12,
    gold: 3,
    look: { kind: 'slime', primary: '#38b764', secondary: '#a7f070' },
    basicAttack: { ...claw, name: '黏液撞击' },
    skills: [],
  },
  wolf: {
    id: 'wolf',
    name: '灰鬃狼',
    base: { maxHp: 85, maxMana: 0, atk: 8, armor: 10, crit: 0.08, attackInterval: 1.4, range: 36, moveSpeed: 80, manaRegen: 0 },
    exp: 16,
    gold: 4,
    look: { kind: 'beast', primary: '#94a3b8', secondary: '#566c86', eye: '#f7e26b' },
    basicAttack: claw,
    skills: [],
  },
  goblin: {
    id: 'goblin',
    name: '哥布林斥候',
    base: { maxHp: 75, maxMana: 0, atk: 9, armor: 8, crit: 0.1, attackInterval: 1.5, range: 36, moveSpeed: 70, manaRegen: 0 },
    exp: 15,
    gold: 6,
    look: { kind: 'humanoid', skin: '#71c94b', primary: '#7a4b2a', secondary: '#c2853d', headgear: 'ears', weapon: 'dagger' },
    basicAttack: { ...claw, name: '背刺' },
    skills: [],
  },
  wolfKing: {
    id: 'wolfKing',
    name: '黑雾狼王',
    base: { maxHp: 600, maxMana: 0, atk: 14, armor: 25, crit: 0.1, attackInterval: 1.7, range: 52, moveSpeed: 70, manaRegen: 0 },
    exp: 220,
    gold: 80,
    scale: 1.8,
    look: { kind: 'beast', primary: '#3d2c5a', secondary: '#1f1530', eye: '#ff3355' },
    basicAttack: { ...claw, name: '暗影撕咬' },
    skills: [{ id: 'wk_howl', name: '黑雾横扫', kind: 'aoeDamage', cooldown: 9, manaCost: 0, power: 1.2 }],
  },
};
