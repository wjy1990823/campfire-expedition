import { describe, expect, it } from 'vitest';
import { deserialize, exportSave, importSave, newGame, OFFLINE_CAP_SECONDS, serialize } from '../game/state';
import { applyOfflineRewards } from './offline';

describe('offline rewards & saves', () => {
  it('ignores short absences', () => {
    expect(applyOfflineRewards(newGame(0), 30, 1)).toBeNull();
  });

  it('grants rewards proportional to time and caps them', () => {
    const a = newGame(0);
    const r1 = applyOfflineRewards(a, 3600, 1)!;
    expect(r1.gold).toBeGreaterThan(0);
    expect(r1.kills).toBeGreaterThan(0);
    expect(a.heroes[0].level).toBeGreaterThan(1);
    const r2 = applyOfflineRewards(newGame(0), OFFLINE_CAP_SECONDS * 3, 1)!;
    expect(r2.seconds).toBe(OFFLINE_CAP_SECONDS);
  });

  it('over-levelling on one map is throttled', () => {
    const s = newGame(0);
    applyOfflineRewards(s, OFFLINE_CAP_SECONDS, 2);
    for (const h of s.heroes) expect(h.level).toBeLessThanOrEqual(12);
  });

  it('round-trips saves, including export codes with Chinese text', () => {
    const s = newGame(0);
    s.gold = 123;
    expect(deserialize(serialize(s))).toEqual(s);
    expect(importSave(exportSave(s))).toEqual(s);
    expect(importSave('garbage!!')).toBeNull();
  });
});
