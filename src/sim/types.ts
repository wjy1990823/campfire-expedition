export type Team = 'hero' | 'enemy';
export type Role = 'tank' | 'healer' | 'dps';

export interface Stats {
  maxHp: number;
  maxMana: number;
  atk: number;
  armor: number;
  crit: number;
  attackInterval: number;
  range: number;
  moveSpeed: number;
  manaRegen: number;
}

export type SkillKind = 'damage' | 'aoeDamage' | 'heal' | 'aoeHeal' | 'taunt';

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  cooldown: number;
  manaCost: number;
  power: number;
  threatMult?: number;
  /** For heals: cast only when the target's hp ratio is below this. */
  healThreshold?: number;
  ranged?: boolean;
}

export interface LookDef {
  kind: 'humanoid' | 'slime' | 'beast';
  skin?: string;
  hair?: string;
  primary: string;
  secondary: string;
  headgear?: 'helmet' | 'hood' | 'hat' | 'hair' | 'ears';
  weapon?: 'sword' | 'staff' | 'dagger' | 'mace';
  shield?: boolean;
  robe?: boolean;
  eye?: string;
}

export interface ClassDef {
  id: string;
  name: string;
  role: Role;
  base: Stats;
  growth: Partial<Stats>;
  basicAttack: SkillDef;
  skills: SkillDef[];
  look: LookDef;
}

export interface MonsterDef {
  id: string;
  name: string;
  base: Stats;
  exp: number;
  gold: number;
  look: LookDef;
  basicAttack: SkillDef;
  skills: SkillDef[];
  scale?: number;
}

export interface MapDef {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  monsters: string[];
  boss: string;
  killsForBoss: number;
  theme: { sky: [string, string]; far: string; mid: string; ground: string; groundDark: string };
}

export interface Unit {
  uid: number;
  team: Team;
  defId: string;
  name: string;
  role: Role;
  level: number;
  stats: Stats;
  hp: number;
  mana: number;
  x: number;
  homeX: number;
  alive: boolean;
  isBoss: boolean;
  attackTimer: number;
  cooldowns: Record<string, number>;
  threat: Map<number, number>;
  targetUid: number | null;
  tauntedBy: number | null;
  tauntTimer: number;
  basicAttack: SkillDef;
  skills: SkillDef[];
  exp: number;
}

export type BattleEvent =
  | { type: 'spawn'; uid: number }
  | { type: 'despawn'; uid: number }
  | { type: 'cast'; src: number; skill: SkillDef; targets: number[] }
  | { type: 'damage'; src: number; tgt: number; amount: number; crit: boolean; skill: SkillDef }
  | { type: 'heal'; src: number; tgt: number; amount: number; crit: boolean; skill: SkillDef }
  | { type: 'death'; uid: number }
  | { type: 'loot'; uid: number; exp: number; gold: number }
  | { type: 'levelUp'; uid: number; level: number }
  | { type: 'waveStart'; wave: number; boss: boolean }
  | { type: 'bossDefeated'; mapId: string }
  | { type: 'wipe' }
  | { type: 'revive' };

export type Phase = 'travel' | 'fight' | 'wipe';
