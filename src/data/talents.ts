import type { SkillDef, Stats } from '../sim/types';

export interface TalentNode {
  id: string;
  name: string;
  tree: 0 | 1;
  /** Points that must already be spent in this tree. */
  req: number;
  max: number;
  stat?: { key: keyof Stats; pct?: number; add?: number };
  skill?: { id: string; power?: number; cooldown?: number };
  grant?: SkillDef;
}

export interface TalentTree {
  names: [string, string];
  nodes: TalentNode[];
}

const REQS = [0, 0, 3, 5, 8];
const MAXES = [3, 3, 3, 2, 1];
type Spec = Omit<TalentNode, 'id' | 'tree' | 'req' | 'max'>;

function tree(cls: string, names: [string, string], a: Spec[], b: Spec[]): TalentTree {
  const mk = (list: Spec[], t: 0 | 1) =>
    list.map((n, i) => ({ ...n, id: `${cls}_${t}_${i}`, tree: t, req: REQS[i], max: MAXES[i] }));
  return { names, nodes: [...mk(a, 0), ...mk(b, 1)] };
}

const pct = (name: string, key: keyof Stats, p: number): Spec => ({ name, stat: { key, pct: p } });
const add = (name: string, key: keyof Stats, a: number): Spec => ({ name, stat: { key, add: a } });
const pow = (name: string, id: string, p: number): Spec => ({ name, skill: { id, power: p } });
const cd = (name: string, id: string, c: number): Spec => ({ name, skill: { id, cooldown: c } });
const grant = (s: Omit<SkillDef, 'manaCost'> & { manaCost?: number }): Spec => ({ name: s.name, grant: { manaCost: 0, ...s } });

export const TALENTS: Record<string, TalentTree> = {
  guardian: tree('guardian', ['坚壁', '复仇'],
    [pct('体格', 'maxHp', 0.04), pct('铁甲', 'armor', 0.06), pow('盾牌专精', 'g_slam', 0.15), pct('坚守', 'maxHp', 0.06),
      grant({ id: 'g_shock', name: '震荡波', kind: 'aoeDamage', cooldown: 10, power: 1.2, threatMult: 2 })],
    [pct('蛮力', 'atk', 0.04), add('致命打击', 'crit', 0.02), pow('横扫', 'g_cleave', 0.2), pct('迅击', 'attackInterval', -0.05),
      grant({ id: 'g_revenge', name: '复仇打击', kind: 'damage', cooldown: 7, power: 2.4, threatMult: 2 })]),
  priest: tree('priest', ['神圣', '戒律'],
    [pow('强效治疗', 'p_heal', 0.08), pct('冥想', 'manaRegen', 0.1), cd('祈祷', 'p_aoeheal', 0.1), pct('心灵之泉', 'maxMana', 0.1),
      grant({ id: 'p_nova', name: '神圣新星', kind: 'aoeHeal', cooldown: 18, manaCost: 30, power: 1.6, healThreshold: 0.8 })],
    [pct('坚韧', 'maxHp', 0.05), pct('真言术', 'armor', 0.08), cd('快速祷言', 'p_heal', 0.08), pct('惩戒', 'atk', 0.08),
      grant({ id: 'p_fire', name: '神圣之火', kind: 'damage', cooldown: 6, manaCost: 12, power: 2, ranged: true })]),
  mage: tree('mage', ['火焰', '冰霜'],
    [pct('炽热', 'atk', 0.04), pow('火球强化', 'm_fireball', 0.12), add('点燃', 'crit', 0.02), cd('快速施法', 'm_fireball', 0.1),
      grant({ id: 'm_pyro', name: '炎爆术', kind: 'damage', cooldown: 14, manaCost: 30, power: 3.5, ranged: true })],
    [pct('奥术智慧', 'maxMana', 0.08), pow('冰封', 'm_blizzard', 0.15), pct('唤醒', 'manaRegen', 0.1), cd('寒冬', 'm_blizzard', 0.1),
      grant({ id: 'm_cone', name: '冰锥术', kind: 'aoeDamage', cooldown: 9, manaCost: 25, power: 1.1, ranged: true })]),
  hunter: tree('hunter', ['射击', '生存'],
    [pct('精准', 'atk', 0.04), pow('稳固射击', 'h_aimed', 0.15), add('鹰眼', 'crit', 0.02), pct('急速射击', 'attackInterval', -0.05),
      grant({ id: 'h_chimera', name: '奇美拉射击', kind: 'damage', cooldown: 12, manaCost: 25, power: 3, ranged: true })],
    [pct('野性耐力', 'maxHp', 0.06), pct('皮甲专精', 'armor', 0.08), pow('箭雨', 'h_volley', 0.15), pct('专注', 'manaRegen', 0.15),
      grant({ id: 'h_trap', name: '爆炸陷阱', kind: 'aoeDamage', cooldown: 14, manaCost: 25, power: 1.4, ranged: true })]),
  rogue: tree('rogue', ['刺杀', '战斗'],
    [add('致命', 'crit', 0.02), pow('残忍', 'r_eviscerate', 0.15), pct('淬毒', 'atk', 0.04), cd('冷酷', 'r_eviscerate', 0.1),
      grant({ id: 'r_poison', name: '毒伤', kind: 'damage', cooldown: 10, manaCost: 25, power: 2.8 })],
    [pct('坚毅', 'maxHp', 0.05), pct('闪电反射', 'attackInterval', -0.04), pow('刀锋', 'r_fan', 0.15), pct('闪避', 'armor', 0.1),
      grant({ id: 'r_flurry', name: '剑刃乱舞', kind: 'aoeDamage', cooldown: 12, manaCost: 30, power: 1.5 })]),
};

/** Tree index the auto-assigner prefers for each class. */
export const DEFAULT_SPEC: Record<string, 0 | 1> = { guardian: 0, priest: 0, mage: 0, hunter: 0, rogue: 0 };
