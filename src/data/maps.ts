import type { MapDef } from '../sim/types';

export const MAPS: MapDef[] = [
  {
    id: 'glimmerwood',
    name: '微光森林',
    minLevel: 1,
    maxLevel: 6,
    monsters: ['slime', 'wolf', 'goblin'],
    boss: 'wolfKing',
    killsForBoss: 20,
    theme: { sky: ['#3b5dc9', '#94e0ff'], far: '#2a6f6a', mid: '#257179', ground: '#5a8f29', groundDark: '#3c5e1c' },
  },
];
