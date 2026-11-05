import { CLASSES } from '../data/classes';
import { MONSTERS } from '../data/monsters';
import { Rng } from './rng';
import type { BattleEvent, MapDef, Phase, SkillDef, Stats, Unit } from './types';

export const TICK = 0.1;
const TRAVEL_TIME = 1.6;
const WIPE_TIME = 3;
const TANK_THREAT_MULT = 3;
const HEAL_THREAT = 0.5;
const CRIT_MULT = 1.5;
const TAUNT_DURATION = 3;
const BOSS_RETRY_KILLS = 10;
const HERO_ADVANCE = 50;
const SPAWN_X = [410, 455, 500, 545];
const HOME_X: Record<string, number> = { tank: 175, dps: 120, healer: 65 };

export function expToNext(level: number): number {
  return Math.round(50 * Math.pow(level, 1.8));
}

export function heroStats(classId: string, level: number): Stats {
  const c = CLASSES[classId];
  const s = { ...c.base };
  for (const [k, v] of Object.entries(c.growth) as [keyof Stats, number][]) s[k] += v * (level - 1);
  return s;
}

export function monsterStats(monsterId: string, level: number): Stats {
  const b = MONSTERS[monsterId].base;
  const l = level - 1;
  return { ...b, maxHp: Math.round(b.maxHp * (1 + 0.3 * l)), atk: b.atk * (1 + 0.2 * l), armor: b.armor * (1 + 0.15 * l) };
}

export function mitigate(amount: number, armor: number): number {
  return amount * (100 / (100 + armor));
}

export interface HeroInit {
  classId: string;
  name: string;
  level?: number;
  exp?: number;
}

export class Battle {
  units: Unit[] = [];
  events: BattleEvent[] = [];
  phase: Phase = 'travel';
  phaseTimer = TRAVEL_TIME;
  wave = 0;
  kills = 0;
  gold = 0;
  bossDefeated = false;
  bossWave = false;
  time = 0;
  private nextUid = 1;
  private rng: Rng;

  constructor(public map: MapDef, heroes: HeroInit[], seed = Date.now()) {
    this.rng = new Rng(seed);
    for (const h of heroes) this.addHero(h);
  }

  get heroes(): Unit[] {
    return this.units.filter((u) => u.team === 'hero');
  }
  get enemies(): Unit[] {
    return this.units.filter((u) => u.team === 'enemy');
  }
  get bossProgress(): number {
    return Math.min(1, this.kills / this.map.killsForBoss);
  }

  unit(uid: number | null): Unit | undefined {
    return uid == null ? undefined : this.units.find((u) => u.uid === uid);
  }

  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private addHero(h: HeroInit): Unit {
    const c = CLASSES[h.classId];
    const level = h.level ?? 1;
    const stats = heroStats(c.id, level);
    const u = this.makeUnit({
      team: 'hero', defId: c.id, name: h.name, role: c.role, level, stats,
      x: HOME_X[c.role] - 220, basicAttack: c.basicAttack, skills: c.skills, isBoss: false,
    });
    u.homeX = HOME_X[c.role];
    u.exp = h.exp ?? 0;
    return u;
  }

  private makeUnit(p: Pick<Unit, 'team' | 'defId' | 'name' | 'role' | 'level' | 'stats' | 'x' | 'basicAttack' | 'skills' | 'isBoss'>): Unit {
    const u: Unit = {
      ...p, uid: this.nextUid++, hp: p.stats.maxHp, mana: p.stats.maxMana, homeX: p.x, alive: true,
      attackTimer: this.rng.range(0.2, p.stats.attackInterval), cooldowns: {}, threat: new Map(),
      targetUid: null, tauntedBy: null, tauntTimer: 0, exp: 0,
    };
    this.units.push(u);
    this.events.push({ type: 'spawn', uid: u.uid });
    return u;
  }

  private avgHeroLevel(): number {
    const h = this.heroes;
    return Math.round(h.reduce((a, u) => a + u.level, 0) / h.length);
  }

  private spawnWave(): void {
    this.wave++;
    const bossReady = !this.bossDefeated && this.kills >= this.map.killsForBoss;
    this.bossWave = bossReady;
    const clampLv = (l: number) => Math.max(this.map.minLevel, Math.min(this.map.maxLevel, l));
    if (bossReady) {
      const def = MONSTERS[this.map.boss];
      this.makeUnit({
        team: 'enemy', defId: def.id, name: def.name, role: 'dps', level: this.map.maxLevel,
        stats: monsterStats(def.id, this.map.maxLevel), x: SPAWN_X[0], basicAttack: def.basicAttack,
        skills: def.skills, isBoss: true,
      });
    } else {
      const count = this.rng.int(2, 3 + (this.wave > 5 ? 1 : 0));
      for (let i = 0; i < count; i++) {
        const def = MONSTERS[this.rng.pick(this.map.monsters)];
        const level = clampLv(this.avgHeroLevel() + this.rng.int(-1, 1));
        this.makeUnit({
          team: 'enemy', defId: def.id, name: def.name, role: 'dps', level, stats: monsterStats(def.id, level),
          x: SPAWN_X[i] + this.rng.range(-10, 10), basicAttack: def.basicAttack, skills: def.skills, isBoss: false,
        });
      }
    }
    this.events.push({ type: 'waveStart', wave: this.wave, boss: bossReady });
  }

  tick(dt = TICK): void {
    this.time += dt;
    if (this.phase === 'travel') {
      this.phaseTimer -= dt;
      for (const h of this.heroes) this.moveToward(h, h.homeX, dt, 0);
      if (this.phaseTimer <= 0) {
        this.phase = 'fight';
        this.spawnWave();
      }
      return;
    }
    if (this.phase === 'wipe') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.revive();
      return;
    }

    for (const u of this.units) {
      if (!u.alive) continue;
      for (const k in u.cooldowns) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - dt);
      u.attackTimer -= dt;
      u.mana = Math.min(u.stats.maxMana, u.mana + u.stats.manaRegen * dt);
      if (u.tauntTimer > 0 && (u.tauntTimer -= dt) <= 0) u.tauntedBy = null;
    }
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.team === 'hero') this.heroAct(u, dt);
      else this.enemyAct(u, dt);
    }

    const aliveEnemies = this.enemies.filter((e) => e.alive);
    const aliveHeroes = this.heroes.filter((h) => h.alive);
    if (aliveHeroes.length === 0) {
      if (this.bossWave) this.kills = Math.max(0, this.map.killsForBoss - BOSS_RETRY_KILLS);
      this.phase = 'wipe';
      this.phaseTimer = WIPE_TIME;
      this.events.push({ type: 'wipe' });
    } else if (aliveEnemies.length === 0) {
      this.clearEnemies();
      this.phase = 'travel';
      this.phaseTimer = TRAVEL_TIME;
    }
  }

  private clearEnemies(): void {
    for (const e of this.enemies) this.events.push({ type: 'despawn', uid: e.uid });
    this.units = this.units.filter((u) => u.team === 'hero');
  }

  private revive(): void {
    this.clearEnemies();
    for (const h of this.heroes) {
      h.alive = true;
      h.hp = h.stats.maxHp;
      h.mana = h.stats.maxMana;
      h.x = h.homeX - 220;
      h.cooldowns = {};
      h.targetUid = null;
    }
    this.bossWave = false;
    this.phase = 'travel';
    this.phaseTimer = TRAVEL_TIME + 1;
    this.events.push({ type: 'revive' });
  }

  private moveToward(u: Unit, x: number, dt: number, range: number): boolean {
    const d = x - u.x;
    if (Math.abs(d) <= range) return true;
    const step = Math.min(Math.abs(d) - range, u.stats.moveSpeed * dt);
    u.x += Math.sign(d) * step;
    return Math.abs(x - u.x) <= range + 0.01;
  }

  private ready(u: Unit, s: SkillDef): boolean {
    return (u.cooldowns[s.id] ?? 0) <= 0 && u.mana >= s.manaCost;
  }

  private spend(u: Unit, s: SkillDef): void {
    u.cooldowns[s.id] = s.cooldown;
    u.mana -= s.manaCost;
  }

  private heroAct(u: Unit, dt: number): void {
    const allies = this.heroes.filter((h) => h.alive);
    const enemies = this.enemies.filter((e) => e.alive);

    if (u.role === 'healer') {
      for (const s of u.skills) {
        if (!this.ready(u, s)) continue;
        const th = s.healThreshold ?? 1;
        if (s.kind === 'aoeHeal') {
          const hurt = allies.filter((a) => a.hp / a.stats.maxHp < th);
          if (hurt.length >= 2) {
            this.spend(u, s);
            this.events.push({ type: 'cast', src: u.uid, skill: s, targets: allies.map((a) => a.uid) });
            for (const a of allies) this.heal(u, a, s);
            return;
          }
        } else if (s.kind === 'heal') {
          const low = allies.reduce((m, a) => (a.hp / a.stats.maxHp < m.hp / m.stats.maxHp ? a : m));
          if (low.hp / low.stats.maxHp < th) {
            this.spend(u, s);
            this.events.push({ type: 'cast', src: u.uid, skill: s, targets: [low.uid] });
            this.heal(u, low, s);
            return;
          }
        }
      }
    }

    if (enemies.length === 0) return;
    const target = this.pickHeroTarget(u, enemies);
    u.targetUid = target.uid;
    const desired = Math.min(target.x - u.stats.range, u.homeX + HERO_ADVANCE);
    this.moveToward(u, desired, dt, 0);
    if (Math.abs(target.x - u.x) > u.stats.range + 0.01) return;

    for (const s of u.skills) {
      if (!this.ready(u, s)) continue;
      if (s.kind === 'taunt') {
        const loose = enemies.filter((e) => this.enemyTarget(e)?.uid !== u.uid);
        if (loose.length === 0) continue;
        this.spend(u, s);
        this.events.push({ type: 'cast', src: u.uid, skill: s, targets: loose.map((e) => e.uid) });
        for (const e of loose) {
          e.tauntedBy = u.uid;
          e.tauntTimer = TAUNT_DURATION;
          const top = Math.max(0, ...e.threat.values());
          e.threat.set(u.uid, top * 1.1 + 10);
        }
        return;
      }
      if (s.kind === 'damage') {
        this.spend(u, s);
        this.events.push({ type: 'cast', src: u.uid, skill: s, targets: [target.uid] });
        this.dealDamage(u, target, s);
        return;
      }
      if (s.kind === 'aoeDamage' && enemies.length >= 2) {
        this.spend(u, s);
        this.events.push({ type: 'cast', src: u.uid, skill: s, targets: enemies.map((e) => e.uid) });
        for (const e of enemies) this.dealDamage(u, e, s);
        return;
      }
    }
    if (u.attackTimer <= 0) {
      u.attackTimer = u.stats.attackInterval;
      this.events.push({ type: 'cast', src: u.uid, skill: u.basicAttack, targets: [target.uid] });
      this.dealDamage(u, target, u.basicAttack);
    }
  }

  private pickHeroTarget(u: Unit, enemies: Unit[]): Unit {
    const nearest = (list: Unit[]) => list.reduce((m, e) => (Math.abs(e.x - u.x) < Math.abs(m.x - u.x) ? e : m));
    if (u.role === 'tank') {
      const loose = enemies.filter((e) => this.enemyTarget(e)?.uid !== u.uid);
      return nearest(loose.length ? loose : enemies);
    }
    const tank = this.heroes.find((h) => h.alive && h.role === 'tank');
    const focus = this.unit(tank?.targetUid ?? null);
    if (focus?.alive) return focus;
    return enemies.reduce((m, e) => (e.hp < m.hp ? e : m));
  }

  enemyTarget(e: Unit): Unit | undefined {
    const heroes = this.heroes.filter((h) => h.alive);
    if (heroes.length === 0) return undefined;
    const taunter = this.unit(e.tauntedBy);
    if (taunter?.alive) return taunter;
    let best: Unit | undefined;
    let bestThreat = -1;
    for (const h of heroes) {
      const t = e.threat.get(h.uid) ?? 0;
      if (t > bestThreat) {
        best = h;
        bestThreat = t;
      }
    }
    if (bestThreat <= 0) return heroes.reduce((m, h) => (Math.abs(h.x - e.x) < Math.abs(m.x - e.x) ? h : m));
    return best;
  }

  private enemyAct(u: Unit, dt: number): void {
    const target = this.enemyTarget(u);
    if (!target) return;
    u.targetUid = target.uid;
    if (!this.moveToward(u, target.x, dt, u.stats.range)) return;
    for (const s of u.skills) {
      if (!this.ready(u, s)) continue;
      if (s.kind === 'aoeDamage') {
        const heroes = this.heroes.filter((h) => h.alive);
        this.spend(u, s);
        this.events.push({ type: 'cast', src: u.uid, skill: s, targets: heroes.map((h) => h.uid) });
        for (const h of heroes) this.dealDamage(u, h, s);
        return;
      }
    }
    if (u.attackTimer <= 0) {
      u.attackTimer = u.stats.attackInterval;
      this.events.push({ type: 'cast', src: u.uid, skill: u.basicAttack, targets: [target.uid] });
      this.dealDamage(u, target, u.basicAttack);
    }
  }

  private roll(u: Unit, s: SkillDef): { amount: number; crit: boolean } {
    const crit = this.rng.next() < u.stats.crit;
    const amount = u.stats.atk * s.power * this.rng.range(0.9, 1.1) * (crit ? CRIT_MULT : 1);
    return { amount, crit };
  }

  private dealDamage(src: Unit, tgt: Unit, s: SkillDef): void {
    if (!tgt.alive) return;
    const r = this.roll(src, s);
    const amount = Math.max(1, Math.round(mitigate(r.amount, tgt.stats.armor)));
    tgt.hp = Math.max(0, tgt.hp - amount);
    this.events.push({ type: 'damage', src: src.uid, tgt: tgt.uid, amount, crit: r.crit, skill: s });
    if (tgt.team === 'enemy') {
      const mult = (src.role === 'tank' ? TANK_THREAT_MULT : 1) * (s.threatMult ?? 1);
      tgt.threat.set(src.uid, (tgt.threat.get(src.uid) ?? 0) + amount * mult);
    }
    if (tgt.hp <= 0) this.kill(tgt);
  }

  private heal(src: Unit, tgt: Unit, s: SkillDef): void {
    const r = this.roll(src, s);
    const amount = Math.min(Math.round(r.amount), tgt.stats.maxHp - tgt.hp);
    tgt.hp += amount;
    this.events.push({ type: 'heal', src: src.uid, tgt: tgt.uid, amount, crit: r.crit, skill: s });
    const enemies = this.enemies.filter((e) => e.alive);
    for (const e of enemies) e.threat.set(src.uid, (e.threat.get(src.uid) ?? 0) + (amount * HEAL_THREAT) / enemies.length);
  }

  private kill(u: Unit): void {
    u.alive = false;
    u.targetUid = null;
    this.events.push({ type: 'death', uid: u.uid });
    if (u.team !== 'enemy') return;
    const def = MONSTERS[u.defId];
    const l = u.level - 1;
    const exp = Math.round(def.exp * (1 + 0.25 * l));
    const gold = Math.round(def.gold * (1 + 0.2 * l));
    this.gold += gold;
    this.kills++;
    this.events.push({ type: 'loot', uid: u.uid, exp, gold });
    for (const h of this.heroes) this.gainExp(h, exp);
    if (u.isBoss) {
      this.bossDefeated = true;
      this.events.push({ type: 'bossDefeated', mapId: this.map.id });
    }
  }

  private gainExp(h: Unit, exp: number): void {
    h.exp += exp;
    while (h.exp >= expToNext(h.level)) {
      h.exp -= expToNext(h.level);
      h.level++;
      h.stats = heroStats(h.defId, h.level);
      if (h.alive) {
        h.hp = h.stats.maxHp;
        h.mana = h.stats.maxMana;
      }
      this.events.push({ type: 'levelUp', uid: h.uid, level: h.level });
    }
  }
}
