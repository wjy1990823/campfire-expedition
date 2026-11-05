import { Rng } from './rng';
import type { Role, Stats } from './types';

export type Slot = 'weapon' | 'head' | 'chest' | 'legs' | 'feet' | 'neck' | 'ring' | 'trinket';
export type StatKey = 'maxHp' | 'atk' | 'armor' | 'crit' | 'manaRegen';

export const SLOTS: Slot[] = ['weapon', 'head', 'chest', 'legs', 'feet', 'neck', 'ring', 'trinket'];
export const SLOT_NAMES: Record<Slot, string> = {
  weapon: '武器', head: '头部', chest: '胸甲', legs: '腿甲', feet: '鞋子', neck: '项链', ring: '戒指', trinket: '饰品',
};
export const STAT_NAMES: Record<StatKey, string> = { maxHp: '生命', atk: '攻击', armor: '护甲', crit: '暴击', manaRegen: '回蓝' };

export const RARITIES = [
  { name: '粗糙', color: '#9d9d9d', mult: 0.6, affixes: 0 },
  { name: '普通', color: '#f4f4f4', mult: 1, affixes: 0 },
  { name: '优秀', color: '#38d957', mult: 1.25, affixes: 1 },
  { name: '精良', color: '#3d8bff', mult: 1.55, affixes: 2 },
  { name: '史诗', color: '#b45cff', mult: 1.9, affixes: 3 },
  { name: '传说', color: '#ff9b26', mult: 2.4, affixes: 4 },
] as const;

export interface Item {
  id: number;
  slot: Slot;
  name: string;
  rarity: number;
  ilvl: number;
  stats: Partial<Record<StatKey, number>>;
}

const BASE_NAMES: Record<Slot, string[]> = {
  weapon: ['余烬之刃', '橡木长杖', '狼牙战锤', '猎手长弓', '影刃匕首'],
  head: ['皮帽', '铁盔', '学徒兜帽'],
  chest: ['旅者外衣', '锁子甲', '亚麻长袍'],
  legs: ['护腿', '皮裤', '镶钉腿甲'],
  feet: ['旅行靴', '铁靴', '轻便便鞋'],
  neck: ['骨牙项链', '琥珀吊坠'],
  ring: ['铜戒', '苔藓指环'],
  trinket: ['篝火余烬', '狼王之牙', '微光护符'],
};
const AFFIX_PREFIX: Record<StatKey, string> = { maxHp: '坚韧', atk: '凶猛', armor: '守护', crit: '精准', manaRegen: '智慧' };

const MAIN_STATS: Record<Slot, StatKey[]> = {
  weapon: ['atk'], head: ['armor', 'maxHp'], chest: ['armor', 'maxHp'], legs: ['armor', 'maxHp'], feet: ['armor', 'maxHp'],
  neck: ['maxHp'], ring: ['atk'], trinket: ['crit'],
};

function statValue(stat: StatKey, ilvl: number, mult: number, main: boolean, weapon: boolean): number {
  const m = mult * (main ? 1 : 0.6);
  switch (stat) {
    case 'atk': return Math.max(1, Math.round(ilvl * 1.1 * m * (weapon ? 2 : 1)));
    case 'armor': return Math.max(1, Math.round(ilvl * 2.5 * m));
    case 'maxHp': return Math.max(1, Math.round(ilvl * 7 * m));
    case 'crit': return Math.round(0.012 * m * 1000) / 1000;
    case 'manaRegen': return Math.round(ilvl * 0.15 * m * 10) / 10 || 0.1;
  }
}

export function rollRarity(rng: Rng, boss: boolean): number {
  const r = rng.next();
  if (boss) return r < 0.15 ? 5 : r < 0.6 ? 4 : 3;
  return r < 0.002 ? 5 : r < 0.015 ? 4 : r < 0.08 ? 3 : r < 0.3 ? 2 : r < 0.8 ? 1 : 0;
}

export function rollItem(rng: Rng, id: number, ilvl: number, rarity: number): Item {
  const slot = rng.pick(SLOTS);
  const rar = RARITIES[rarity];
  const stats: Partial<Record<StatKey, number>> = {};
  for (const s of MAIN_STATS[slot]) stats[s] = statValue(s, ilvl, rar.mult, true, slot === 'weapon');
  const pool: StatKey[] = ['maxHp', 'atk', 'armor', 'crit', 'manaRegen'];
  let firstAffix: StatKey | null = null;
  for (let i = 0; i < rar.affixes; i++) {
    const s = rng.pick(pool);
    firstAffix ??= s;
    stats[s] = Math.round(((stats[s] ?? 0) + statValue(s, ilvl, rar.mult, false, slot === 'weapon')) * 1000) / 1000;
  }
  const base = rng.pick(BASE_NAMES[slot]);
  const name = firstAffix ? `${AFFIX_PREFIX[firstAffix]}的${base}` : base;
  return { id, slot, name, rarity, ilvl, stats };
}

const ROLE_WEIGHTS: Record<Role, Record<StatKey, number>> = {
  tank: { maxHp: 1, atk: 2, armor: 2.5, crit: 300, manaRegen: 1 },
  healer: { maxHp: 0.8, atk: 4, armor: 1, crit: 400, manaRegen: 12 },
  dps: { maxHp: 0.5, atk: 5, armor: 0.8, crit: 600, manaRegen: 6 },
};

export function itemScore(item: Item | undefined, role: Role): number {
  if (!item) return 0;
  const w = ROLE_WEIGHTS[role];
  return Object.entries(item.stats).reduce((a, [k, v]) => a + (v ?? 0) * w[k as StatKey], 0);
}

export function gearBonus(items: (Item | undefined)[]): Partial<Stats> {
  const b: Partial<Stats> = {};
  for (const it of items) {
    if (!it) continue;
    for (const [k, v] of Object.entries(it.stats) as [StatKey, number][]) b[k] = (b[k] ?? 0) + v;
  }
  return b;
}

export function salvageValue(item: Item): number {
  return Math.round(item.ilvl * (1 + item.rarity * item.rarity) * 1.5);
}

export function formatStat(k: StatKey, v: number): string {
  return k === 'crit' ? `${STAT_NAMES[k]} +${(v * 100).toFixed(1)}%` : `${STAT_NAMES[k]} +${v}`;
}
