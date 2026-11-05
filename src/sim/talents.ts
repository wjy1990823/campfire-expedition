import { CLASSES } from '../data/classes';
import { DEFAULT_SPEC, TALENTS, type TalentNode } from '../data/talents';
import type { HeroRecord } from '../game/state';
import type { SkillDef, Stats } from './types';

export const TALENT_START_LEVEL = 7;

export function talentPoints(level: number): number {
  return Math.max(0, level - TALENT_START_LEVEL + 1);
}

export function spent(r: HeroRecord, tree?: 0 | 1): number {
  const nodes = TALENTS[r.classId]?.nodes ?? [];
  return nodes.filter((n) => tree === undefined || n.tree === tree).reduce((a, n) => a + (r.talents[n.id] ?? 0), 0);
}

export function canLearn(r: HeroRecord, n: TalentNode): boolean {
  return (r.talents[n.id] ?? 0) < n.max && spent(r) < talentPoints(r.level) && spent(r, n.tree) >= n.req;
}

export function learn(r: HeroRecord, id: string): boolean {
  const n = TALENTS[r.classId]?.nodes.find((x) => x.id === id);
  if (!n || !canLearn(r, n)) return false;
  r.talents[id] = (r.talents[id] ?? 0) + 1;
  return true;
}

export function resetTalents(r: HeroRecord): void {
  r.talents = {};
}

/** Spends all free points, filling the preferred tree first, then the other one. */
export function autoAssign(r: HeroRecord): number {
  const t = TALENTS[r.classId];
  if (!t) return 0;
  const pref = DEFAULT_SPEC[r.classId] ?? 0;
  const order = [...t.nodes.filter((n) => n.tree === pref), ...t.nodes.filter((n) => n.tree !== pref)];
  let n = 0;
  for (let progress = true; progress; ) {
    progress = false;
    for (const node of order)
      if (canLearn(r, node)) {
        learn(r, node.id);
        n++;
        progress = true;
        break;
      }
  }
  return n;
}

function active(r: HeroRecord): [TalentNode, number][] {
  return (TALENTS[r.classId]?.nodes ?? []).filter((n) => (r.talents[n.id] ?? 0) > 0).map((n) => [n, r.talents[n.id]]);
}

export function applyTalentStats(s: Stats, r: HeroRecord): Stats {
  const pctSum: Partial<Record<keyof Stats, number>> = {};
  for (const [n, rank] of active(r)) {
    if (!n.stat) continue;
    if (n.stat.pct) pctSum[n.stat.key] = (pctSum[n.stat.key] ?? 0) + n.stat.pct * rank;
    if (n.stat.add) s[n.stat.key] += n.stat.add * rank;
  }
  for (const [k, p] of Object.entries(pctSum) as [keyof Stats, number][]) s[k] *= 1 + p;
  return s;
}

/** Class skills with talent modifiers and tactics applied, plus granted skills. */
export function heroSkills(r: HeroRecord): SkillDef[] {
  const mods = active(r);
  const skills = CLASSES[r.classId].skills.map((sk) => {
    const s = { ...sk };
    for (const [n, rank] of mods) {
      if (n.skill?.id !== s.id) continue;
      if (n.skill.power) s.power *= 1 + n.skill.power * rank;
      if (n.skill.cooldown) s.cooldown *= 1 - n.skill.cooldown * rank;
    }
    return s;
  });
  for (const [n] of mods) if (n.grant) skills.unshift({ ...n.grant });
  const th = r.tactics.healThreshold;
  return skills
    .filter((s) => !r.tactics.disabled.includes(s.id))
    .map((s) => (th != null && s.healThreshold != null ? { ...s, healThreshold: s.kind === 'aoeHeal' ? th - 0.05 : th } : s));
}

export function talentDesc(n: TalentNode, skillName: (id: string) => string): string {
  const STAT: Record<string, string> = { maxHp: '生命', atk: '攻击', armor: '护甲', crit: '暴击', manaRegen: '回蓝', maxMana: '法力上限', attackInterval: '攻击间隔' };
  if (n.grant) return `习得技能【${n.grant.name}】`;
  if (n.stat?.pct) return `${STAT[n.stat.key]} ${n.stat.pct > 0 ? '+' : ''}${Math.round(n.stat.pct * 100)}% / 级`;
  if (n.stat?.add) return `${STAT[n.stat.key]} +${(n.stat.add * 100).toFixed(0)}% / 级`;
  if (n.skill?.power) return `【${skillName(n.skill.id)}】效果 +${Math.round(n.skill.power * 100)}% / 级`;
  if (n.skill?.cooldown) return `【${skillName(n.skill.id)}】冷却 -${Math.round(n.skill.cooldown * 100)}% / 级`;
  return '';
}
