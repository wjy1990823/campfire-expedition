import type { LookDef, MonsterDef, SkillDef, Stats } from '../sim/types';

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
  ...extraMonsters(),
};

function mob(
  id: string, name: string, look: LookDef, base: Partial<Stats> = {}, exp = 16, gold = 5, extra: Partial<MonsterDef> = {},
): MonsterDef {
  return {
    id, name, look, exp, gold,
    base: { maxHp: 80, maxMana: 0, atk: 8, armor: 9, crit: 0.06, attackInterval: 1.6, range: 36, moveSpeed: 60, manaRegen: 0, ...base },
    basicAttack: claw,
    skills: [],
    ...extra,
  };
}

function boss(id: string, name: string, look: LookDef, skills: SkillDef[], base: Partial<Stats> = {}, scale = 1.8): MonsterDef {
  return mob(id, name, look, { maxHp: 1800, atk: 18, armor: 25, crit: 0.1, attackInterval: 1.7, range: 52, moveSpeed: 60, ...base }, 220, 80, { skills, scale });
}

function aoe(id: string, name: string, cooldown = 9, power = 1.2): SkillDef {
  return { id, name, kind: 'aoeDamage', cooldown, manaCost: 0, power };
}
function smash(id: string, name: string, cooldown = 7, power = 2.2): SkillDef {
  return { id, name, kind: 'damage', cooldown, manaCost: 0, power };
}
function H(o: Partial<LookDef>): LookDef {
  return { kind: 'humanoid', primary: '#333c57', secondary: '#566c86', ...o };
}
function B(primary: string, secondary: string, eye?: string): LookDef {
  return { kind: 'beast', primary, secondary, eye };
}
function S(primary: string, secondary: string): LookDef {
  return { kind: 'slime', primary, secondary };
}

function extraMonsters(): Record<string, MonsterDef> {
  const list: MonsterDef[] = [
    // 蛛网洞窟
    mob('spider', '洞穴蛛', B('#5d275d', '#2b1a33', '#a7f070'), { atk: 9, attackInterval: 1.3 }),
    mob('bat', '吸血蝠', B('#3e4766', '#1f2238', '#ff5f5f'), { maxHp: 65, moveSpeed: 90, crit: 0.12 }),
    mob('kobold', '狗头人矿工', H({ skin: '#c2853d', primary: '#7a4b2a', secondary: '#f7c948', headgear: 'ears', weapon: 'mace' }), { maxHp: 90, armor: 12 }, 17, 7),
    boss('broodmother', '洞穴织母', B('#2b1a33', '#5d275d', '#a7f070'), [aoe('bm_web', '毒网喷吐', 8)]),
    // 落日荒原
    mob('scorpion', '荒原毒蝎', B('#c2853d', '#7a4b2a', '#1a1c2c'), { armor: 16, atk: 9 }),
    mob('hyena', '斑纹鬣狗', B('#b8935a', '#6b4f2a', '#f7e26b'), { moveSpeed: 85, attackInterval: 1.3 }),
    mob('bandit', '荒原强盗', H({ skin: '#e0a878', primary: '#7a4b2a', secondary: '#b13e53', headgear: 'hood', weapon: 'dagger' }), { crit: 0.14 }, 17, 9),
    boss('sandchief', '沙暴头领', H({ skin: '#e0a878', primary: '#c2853d', secondary: '#7a4b2a', headgear: 'helmet', weapon: 'sword', shield: true }), [aoe('sc_storm', '沙暴旋风', 9), smash('sc_cleave', '断骨重劈')]),
    // 寒霜山道
    mob('frostslime', '冰霜史莱姆', S('#73eff7', '#f4f4f4'), { maxHp: 95, armor: 12, attackInterval: 1.8 }),
    mob('snowwolf', '雪原狼', B('#f4f4f4', '#94b0c2', '#3b5dc9'), { moveSpeed: 85, crit: 0.1 }),
    mob('yeti', '雪人', B('#c2c3c7', '#8b93a8', '#1a1c2c'), { maxHp: 120, atk: 10, attackInterval: 2 }, 20, 7, { scale: 1.25 }),
    boss('frosttroll', '冰霜巨魔', H({ skin: '#73eff7', primary: '#29366f', secondary: '#f4f4f4', headgear: 'hair', weapon: 'mace' }), [aoe('ft_quake', '冰川震击', 10, 1.3), smash('ft_smash', '巨魔重击', 8, 2.4)], {}, 2),
    // 沉没神殿
    mob('tideslime', '潮汐软泥', S('#29366f', '#41a6f6'), { maxHp: 100, armor: 10 }),
    mob('fishman', '深潜鱼人', H({ skin: '#3b8f8a', primary: '#257179', secondary: '#a7f070', headgear: 'ears', weapon: 'dagger' }), { crit: 0.12, moveSpeed: 75 }),
    mob('templeguard', '石像守卫', H({ skin: '#8b93a8', primary: '#566c86', secondary: '#c2c3c7', headgear: 'helmet', weapon: 'sword', shield: true }), { maxHp: 110, armor: 20, attackInterval: 2 }, 20, 8),
    boss('tidepriest', '潮汐祭司', H({ skin: '#3b8f8a', primary: '#29366f', secondary: '#73eff7', headgear: 'hat', weapon: 'staff', robe: true }), [aoe('tp_wave', '潮汐巨浪', 8, 1.25)], { range: 120 }),
    // 灰烬墓园
    mob('skeleton', '骷髅战士', H({ skin: '#e8e8d8', primary: '#8b93a8', secondary: '#566c86', headgear: 'helmet', weapon: 'sword' }), { armor: 14 }),
    mob('ghoul', '食尸鬼', H({ skin: '#6b8f5a', primary: '#3c5e1c', secondary: '#5d275d', headgear: 'hair', weapon: 'dagger' }), { maxHp: 95, attackInterval: 1.3 }),
    mob('wraith', '怨灵', S('#566c86', '#c2c3c7'), { maxHp: 70, atk: 10, crit: 0.12 }),
    boss('bonedragon', '骸骨龙', B('#e8e8d8', '#8b93a8', '#73eff7'), [aoe('bd_breath', '冥火吐息', 9, 1.3), smash('bd_bite', '碎骨撕咬', 7, 2.2)], { maxHp: 1950 }, 2.2),
    // 熔火裂谷
    mob('fireslime', '熔岩史莱姆', S('#ef7d57', '#ffcd75'), { maxHp: 95, atk: 9 }),
    mob('imp', '火焰小鬼', H({ skin: '#b13e53', primary: '#5d275d', secondary: '#ef7d57', headgear: 'ears', weapon: 'staff' }), { range: 110, attackInterval: 1.8, maxHp: 70 }),
    mob('lavahound', '熔火猎犬', B('#5d275d', '#b13e53', '#ffcd75'), { moveSpeed: 85, atk: 10 }),
    boss('moltenlord', '熔核领主', H({ skin: '#ef7d57', primary: '#b13e53', secondary: '#ffcd75', headgear: 'helmet', weapon: 'mace' }), [aoe('ml_erupt', '熔岩喷发', 9, 1.35), smash('ml_hammer', '熔核之锤', 8, 2.5)], { maxHp: 2100, atk: 19 }, 2.2),
    // 幽影地窟（副本）
    mob('cultist', '黑雾教徒', H({ skin: '#c2c3c7', primary: '#262b44', secondary: '#5d275d', headgear: 'hood', weapon: 'staff', robe: true }), { range: 110, attackInterval: 1.8 }, 20, 8),
    mob('shade', '暗影', S('#262b44', '#5d275d'), { maxHp: 90, crit: 0.12 }, 20, 8),
    boss('jailer', '狱卒格罗姆', H({ skin: '#8b93a8', primary: '#333c57', secondary: '#b13e53', headgear: 'helmet', weapon: 'mace', shield: true }), [smash('jl_chain', '锁链重击', 6, 2.3)], { maxHp: 2400 }),
    boss('shadowwitch', '暗影女巫', H({ skin: '#c2c3c7', primary: '#5d275d', secondary: '#b45cff', headgear: 'hat', weapon: 'staff', robe: true }), [aoe('sw_nova', '暗影新星', 7, 1.2)], { maxHp: 2200, range: 120 }),
    boss('mistlord', '黑雾领主', B('#1f1530', '#5d275d', '#ff3355'), [aoe('mlord_mist', '黑雾吞噬', 8, 1.35), smash('mlord_rend', '撕裂', 6, 2.4)], { maxHp: 3200, atk: 20 }, 2.4),
  ];
  return Object.fromEntries(list.map((m) => [m.id, m]));
}
