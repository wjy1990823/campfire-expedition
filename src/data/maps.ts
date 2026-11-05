import type { MapDef } from '../sim/types';

const t = (sky: [string, string], far: string, mid: string, ground: string, groundDark: string): MapDef['theme'] => ({ sky, far, mid, ground, groundDark });

export const REGIONS = ['余烬林地', '霜烬高地'];

export const MAPS: MapDef[] = [
  { id: 'glimmerwood', region: 0, name: '微光森林', minLevel: 1, maxLevel: 6, monsters: ['slime', 'wolf', 'goblin'], boss: 'wolfKing', killsForBoss: 20,
    theme: t(['#3b5dc9', '#94e0ff'], '#2a6f6a', '#257179', '#5a8f29', '#3c5e1c') },
  { id: 'webcave', region: 0, name: '蛛网洞窟', minLevel: 6, maxLevel: 11, monsters: ['spider', 'bat', 'kobold'], boss: 'broodmother', killsForBoss: 30,
    theme: t(['#1a1c2c', '#3e4766'], '#2b1a33', '#333c57', '#566c86', '#3e4766') },
  { id: 'sunsetwaste', region: 0, name: '落日荒原', minLevel: 11, maxLevel: 16, monsters: ['scorpion', 'hyena', 'bandit'], boss: 'sandchief', killsForBoss: 35,
    theme: t(['#ef7d57', '#ffcd75'], '#b13e53', '#c2853d', '#d9a066', '#a0703c') },
  { id: 'frostpass', region: 1, name: '寒霜山道', minLevel: 16, maxLevel: 20, monsters: ['frostslime', 'snowwolf', 'yeti'], boss: 'frosttroll', killsForBoss: 40,
    theme: t(['#94b0c2', '#f4f4f4'], '#566c86', '#8b9bb4', '#e8eef2', '#b8c6d1') },
  { id: 'sunkentemple', region: 1, name: '沉没神殿', minLevel: 20, maxLevel: 24, monsters: ['tideslime', 'fishman', 'templeguard'], boss: 'tidepriest', killsForBoss: 40,
    theme: t(['#29366f', '#41a6f6'], '#1f3d5c', '#257179', '#3b8f8a', '#25615e') },
  { id: 'ashgrave', region: 1, name: '灰烬墓园', minLevel: 24, maxLevel: 27, monsters: ['skeleton', 'ghoul', 'wraith'], boss: 'bonedragon', killsForBoss: 45,
    theme: t(['#262b44', '#566c86'], '#1a1c2c', '#333c57', '#4a4f5c', '#33363f') },
  { id: 'moltenrift', region: 1, name: '熔火裂谷', minLevel: 27, maxLevel: 30, monsters: ['fireslime', 'imp', 'lavahound'], boss: 'moltenlord', killsForBoss: 50,
    theme: t(['#5d275d', '#b13e53'], '#2b1a33', '#5d275d', '#5a3a3a', '#3a2424') },
];

export function mapById(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
