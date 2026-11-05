import type { MapDef } from '../sim/types';

export interface DungeonDef {
  id: string;
  name: string;
  /** Monsters scale to the party but never below this level. */
  minLevel: number;
  unlockMap: string;
  stages: { monsters?: string[]; boss?: string }[];
  theme: MapDef['theme'];
}

const trash = { monsters: ['cultist', 'shade', 'skeleton'] };

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'shadowcrypt',
    name: '幽影地窟',
    minLevel: 10,
    unlockMap: 'webcave',
    stages: [trash, trash, { boss: 'jailer' }, trash, { boss: 'shadowwitch' }, trash, trash, { boss: 'mistlord' }],
    theme: { sky: ['#14151f', '#262b44'], far: '#1f1530', mid: '#2b1a33', ground: '#3e4766', groundDark: '#262b44' },
  },
];
