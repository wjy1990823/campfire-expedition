import { CLASSES } from '../data/classes';
import { DUNGEONS } from '../data/dungeons';
import { MAPS, REGIONS } from '../data/maps';
import { MONSTERS } from '../data/monsters';
import { TALENTS } from '../data/talents';
import { autoEquip, dismiss, equip, recruit, recruitCost, salvage, salvageBelow, swapHero, unequip, upgradeDelta } from '../game/actions';
import { autoAssign, canLearn, learn, resetTalents, spent, talentDesc, talentPoints, TALENT_START_LEVEL } from '../sim/talents';
import { BENCH_CAP, DUNGEON_DAILY, dungeonLeft, exportSave, importSave, mapProgress, mapUnlocked, SAVE_KEY, type GameState, type HeroRecord } from '../game/state';
import { recordStats } from '../sim/battle';
import { formatStat, RARITIES, SLOT_NAMES, SLOTS, type Item, type StatKey } from '../sim/items';
import type { OfflineReport } from '../sim/offline';

export interface PanelCtx {
  state: GameState;
  /** Called after the state was mutated by the panel. */
  changed(): void;
  /** Replace the whole save (import / reset). */
  replace(s: GameState | null): void;
  /** Rebuild the battle (after a map change), optionally entering a dungeon. */
  restart(dungeonId?: string): void;
}

let root: HTMLDivElement | null = null;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function itemLine(it: Item): string {
  const r = RARITIES[it.rarity];
  const stats = (Object.entries(it.stats) as [StatKey, number][]).map(([k, v]) => formatStat(k, v)).join('　');
  return `<span style="color:${r.color}">[${r.name}] ${esc(it.name)}</span> <small>${SLOT_NAMES[it.slot]} · iLv${it.ilvl}</small><br><small class="stats">${stats}</small>`;
}

function open(title: string, body: string): HTMLDivElement {
  close();
  root = document.createElement('div');
  root.className = 'panel-mask';
  root.innerHTML = `<div class="panel"><div class="panel-head"><b>${title}</b><button data-act="close">✕</button></div><div class="panel-body">${body}</div></div>`;
  root.addEventListener('click', (e) => {
    if (e.target === root || (e.target as HTMLElement).dataset.act === 'close') close();
  });
  document.body.appendChild(root);
  return root;
}

export function close(): void {
  root?.remove();
  root = null;
}

export function isOpen(): boolean {
  return root !== null;
}

function bind(el: HTMLElement, handler: (act: string, data: DOMStringMap) => void): void {
  el.querySelector('.panel-body')!.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (t) handler(t.dataset.act!, t.dataset);
  });
}

export function openTeam(ctx: PanelCtx): void {
  const s = ctx.state;
  const body = s.heroes
    .map((h, hi) => {
      const st = recordStats(h);
      const gear = SLOTS.map((slot) => {
        const it = h.gear[slot];
        return `<div class="row">${it ? `${itemLine(it)} <button data-act="unequip" data-hero="${hi}" data-slot="${slot}">卸下</button>` : `<small class="muted">${SLOT_NAMES[slot]}：空</small>`}</div>`;
      }).join('');
      return `<details class="card" ${hi === 0 ? 'open' : ''}><summary><b>${esc(h.name)}</b> ${CLASSES[h.classId].name} Lv${h.level}
        <small class="stats">生命 ${st.maxHp}　攻击 ${Math.round(st.atk)}　护甲 ${Math.round(st.armor)}　暴击 ${(st.crit * 100).toFixed(1)}%</small></summary>
        ${h.quote ? `<small class="muted">${esc(h.quote)}</small>` : ''}${gear}${tacticsHtml(h, hi)}</details>`;
    })
    .join('');
  const el = open('小队', `<div class="toolbar"><button data-act="auto">一键换装</button><button data-act="roster">招募 / 替换队员</button></div>${body}`);
  el.querySelectorAll<HTMLSelectElement>('select[data-heal]').forEach((sel) => {
    sel.onchange = () => {
      const v = Number(sel.value);
      s.heroes[Number(sel.dataset.heal)].tactics.healThreshold = v > 0 ? v : null;
      ctx.changed();
    };
  });
  bind(el, (act, d) => {
    if (act === 'roster') return openRoster(ctx);
    if (act === 'skill') {
      const t = s.heroes[Number(d.hero)].tactics;
      t.disabled = t.disabled.includes(d.skill!) ? t.disabled.filter((x) => x !== d.skill) : [...t.disabled, d.skill!];
    }
    if (act === 'unequip') unequip(s, Number(d.hero), d.slot as Item['slot']);
    if (act === 'auto') autoEquip(s);
    ctx.changed();
    openTeam(ctx);
  });
}

function tacticsHtml(h: HeroRecord, hi: number): string {
  const c = CLASSES[h.classId];
  const skills = [...c.skills, ...TALENTS[h.classId].nodes.filter((n) => n.grant && h.talents[n.id]).map((n) => n.grant!)];
  const toggles = skills
    .map((sk) => {
      const off = h.tactics.disabled.includes(sk.id);
      return `<button class="${off ? 'down' : 'up'}" data-act="skill" data-hero="${hi}" data-skill="${sk.id}">${esc(sk.name)}：${off ? '关' : '开'}</button>`;
    })
    .join('');
  let heal = '';
  if (c.role === 'healer') {
    const cur = h.tactics.healThreshold ?? 0;
    const opts = [[0, '默认'], [0.5, '50%'], [0.6, '60%'], [0.7, '70%'], [0.8, '80%'], [0.9, '90%']]
      .map(([v, n]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${n}</option>`)
      .join('');
    heal = `<div class="row"><small>队友血量低于</small> <select data-heal="${hi}">${opts}</select> <small>时治疗</small></div>`;
  }
  return `<div class="row"><b>战术</b></div>${heal}<div class="btns">${toggles}</div>`;
}

export function openRoster(ctx: PanelCtx): void {
  const s = ctx.state;
  const cost = recruitCost(s);
  const classes = Object.values(CLASSES)
    .map((c) => `<button data-act="hire" data-cls="${c.id}" ${s.gold < cost || s.bench.length >= BENCH_CAP ? 'disabled' : ''}>${c.name}</button>`)
    .join('');
  const bench = s.bench
    .map((b, bi) => {
      const swaps = s.heroes.map((h, hi) => `<button data-act="swap" data-bench="${bi}" data-hero="${hi}">换下${esc(h.name)}</button>`).join('');
      return `<div class="card"><b>${esc(b.name)}</b> ${CLASSES[b.classId].name} Lv${b.level}<br><small class="muted">${esc(b.quote ?? '')}</small>
        <div class="btns">${swaps}<button class="danger" data-act="fire" data-bench="${bi}">解雇</button></div></div>`;
    })
    .join('');
  const el = open(
    '招募 / 替换',
    `<div class="card"><b>招募 AI 冒险者</b>　<small>花费 ${cost} 金币（现有 ${s.gold}）</small><br>
     <small class="muted">新队员比小队平均等级低 2 级，会自动分配天赋。替补不参与战斗，也不获得经验。</small>
     <div class="btns">${classes}</div></div>
     <div class="row"><b>替补 ${s.bench.length}/${BENCH_CAP}</b></div>${bench || '<p class="muted">还没有替补队员。</p>'}`,
  );
  bind(el, (act, d) => {
    if (act === 'hire') recruit(s, d.cls!);
    if (act === 'swap') swapHero(s, Number(d.hero), Number(d.bench));
    if (act === 'fire' && confirm('解雇后，此队员的装备会放回背包。确定吗？')) dismiss(s, Number(d.bench));
    ctx.changed();
    openRoster(ctx);
  });
}

let talentHero = 0;

export function openTalents(ctx: PanelCtx): void {
  const s = ctx.state;
  talentHero = Math.min(talentHero, s.heroes.length - 1);
  const h = s.heroes[talentHero];
  const t = TALENTS[h.classId];
  const skillName = (id: string) => CLASSES[h.classId].skills.find((x) => x.id === id)?.name ?? id;
  const free = talentPoints(h.level) - spent(h);
  const tabs = s.heroes.map((x, i) => `<button class="${i === talentHero ? 'up' : ''}" data-act="hero" data-hero="${i}">${esc(x.name)}</button>`).join('');
  const trees = ([0, 1] as const)
    .map((ti) => {
      const nodes = t.nodes
        .filter((n) => n.tree === ti)
        .map((n) => {
          const rank = h.talents[n.id] ?? 0;
          const locked = spent(h, ti) < n.req;
          return `<div class="row talent ${locked ? 'locked' : ''}"><b>${esc(n.name)}</b> ${rank}/${n.max}
            ${locked ? `<small class="muted">（需本系投入 ${n.req} 点）</small>` : ''}<br><small class="stats">${talentDesc(n, skillName)}</small>
            ${canLearn(h, n) ? `<button data-act="learn" data-id="${n.id}">+1</button>` : ''}</div>`;
        })
        .join('');
      return `<div class="card"><b>${t.names[ti]}</b> <small>已投入 ${spent(h, ti)}</small>${nodes}</div>`;
    })
    .join('');
  const el = open(
    '天赋',
    `<div class="btns">${tabs}</div>
     <p>${esc(h.name)} · ${CLASSES[h.classId].name} Lv${h.level}　剩余天赋点 <b>${free}</b>
     <br><small class="muted">${TALENT_START_LEVEL} 级起每升 1 级获得 1 点；重置免费。</small></p>
     <div class="toolbar"><button data-act="auto">自动加点</button><button data-act="autoAll">全队自动加点</button><button data-act="reset">重置</button></div>${trees}`,
  );
  bind(el, (act, d) => {
    if (act === 'hero') talentHero = Number(d.hero);
    if (act === 'learn') learn(h, d.id!);
    if (act === 'auto') autoAssign(h);
    if (act === 'autoAll') s.heroes.forEach(autoAssign);
    if (act === 'reset') resetTalents(h);
    ctx.changed();
    openTalents(ctx);
  });
}

export function openMaps(ctx: PanelCtx): void {
  const s = ctx.state;
  const body = REGIONS.map((region, ri) => {
    const maps = MAPS.filter((m) => m.region === ri)
      .map((m) => {
        const unlocked = mapUnlocked(s, m.id);
        const p = s.maps[m.id];
        const status = !unlocked ? '<small class="muted">未解锁（击败上一张地图的守护者）</small>'
          : p?.bossDefeated ? '<small style="color:#f7c948">灯塔已点燃</small>'
          : `<small>黑雾 ${p?.kills ?? 0}/${m.killsForBoss}</small>`;
        const btn = s.mapId === m.id ? '<button disabled>当前</button>' : unlocked ? `<button data-act="go" data-id="${m.id}">前往</button>` : '';
        return `<div class="row"><b>${m.name}</b> <small>Lv${m.minLevel}-${m.maxLevel} · 守护者 ${MONSTERS[m.boss].name}</small><br>${status} ${btn}</div>`;
      })
      .join('');
    return `<div class="card"><b>${region}</b>${maps}</div>`;
  }).join('');
  const el = open('地图', body);
  bind(el, (act, d) => {
    if (act !== 'go' || !mapUnlocked(s, d.id!)) return;
    s.mapId = d.id!;
    mapProgress(s);
    close();
    ctx.changed();
    ctx.restart();
  });
}

export function openDungeon(ctx: PanelCtx): void {
  const s = ctx.state;
  const body = DUNGEONS.map((dg) => {
    const unlocked = mapUnlocked(s, dg.unlockMap);
    const left = dungeonLeft(s);
    const bosses = dg.stages.filter((st) => st.boss).map((st) => MONSTERS[st.boss!].name).join(' → ');
    return `<div class="card"><b>${dg.name}</b> <small>5 人副本 · 推荐 Lv${dg.minLevel + 2}+</small><br>
      <small>共 ${dg.stages.length} 关：小怪与 3 位首领（${bosses}）。怪物等级随小队等级提升（最低 Lv${dg.minLevel}）。</small><br>
      <small>首领必掉“幽影”装备：前两位至少精良，最终首领至少史诗。</small><br>
      <small>今日剩余次数 <b>${left}/${DUNGEON_DAILY}</b>（每天 0 点重置）　累计通关 ${s.dungeon.clears} 次</small><br>
      ${unlocked ? `<button data-act="enter" data-id="${dg.id}" ${left <= 0 ? 'disabled' : ''}>进入副本</button>` : '<small class="muted">击败微光森林守护者后解锁</small>'}</div>`;
  }).join('');
  const el = open('副本', `${body}<p class="muted">进入即消耗 1 次次数；失败或中途离开不返还。</p>`);
  bind(el, (act, d) => {
    if (act !== 'enter' || dungeonLeft(s) <= 0) return;
    s.dungeon.used++;
    close();
    ctx.changed();
    ctx.restart(d.id);
  });
}

export function openDungeonResult(cleared: boolean, name: string, loot: Item[], onClose: () => void): void {
  const items = loot.map((it) => `<div class="row">${itemLine(it)}</div>`).join('');
  const el = open(
    cleared ? `${name} · 通关！` : `${name} · 挑战失败`,
    `<p>${cleared ? '黑雾领主倒下了，地窟深处重新亮起篝火。' : '小队力竭，撤回了篝火旁。提升等级、装备和天赋后再来吧。'}</p>
     ${items ? `<div class="card"><b>本次获得</b>${items}</div>` : ''}
     <div class="toolbar"><button data-act="back">返回地图</button></div>`,
  );
  el.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset.act;
    if (act === 'back' || act === 'close' || e.target === el) onClose();
  });
}

export function openBag(ctx: PanelCtx): void {
  const s = ctx.state;
  const items = [...s.inventory].sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
  const rows = items
    .map((it) => {
      const heroBtns = s.heroes
        .map((h, hi) => {
          const d = upgradeDelta(s, hi, it);
          const cls = d > 0.01 ? 'up' : d < -0.01 ? 'down' : '';
          return `<button class="${cls}" data-act="equip" data-hero="${hi}" data-id="${it.id}">${esc(h.name)} ${d > 0.01 ? '▲' : d < -0.01 ? '▼' : '＝'}</button>`;
        })
        .join('');
      return `<div class="card">${itemLine(it)}<div class="btns">${heroBtns}<button data-act="salvage" data-id="${it.id}">分解</button></div></div>`;
    })
    .join('');
  const el = open(
    `背包 ${s.inventory.length}/60`,
    `<div class="toolbar"><button data-act="auto">一键换装</button><button data-act="junk">分解优秀以下</button></div>${rows || '<p class="muted">背包是空的，继续挂机打怪吧。</p>'}`,
  );
  bind(el, (act, d) => {
    if (act === 'equip') equip(s, Number(d.hero), Number(d.id));
    if (act === 'salvage') salvage(s, Number(d.id));
    if (act === 'auto') autoEquip(s);
    if (act === 'junk') salvageBelow(s, 2);
    ctx.changed();
    openBag(ctx);
  });
}

export function openSettings(ctx: PanelCtx): void {
  const s = ctx.state;
  const opts = [
    [-1, '不自动分解'],
    [1, '自动分解：粗糙'],
    [2, '自动分解：普通及以下'],
    [3, '自动分解：优秀及以下'],
  ]
    .map(([v, n]) => `<option value="${v}" ${s.autoSalvageBelow === v ? 'selected' : ''}>${n}</option>`)
    .join('');
  const el = open(
    '设置',
    `<div class="card"><b>拾取</b><br><select id="salvage">${opts}</select></div>
     <div class="card"><b>导出存档</b><br><small class="muted">复制保存这段文字，换设备时可导入。</small><textarea readonly id="exp">${exportSave(s)}</textarea><button data-act="copy">复制</button></div>
     <div class="card"><b>导入存档</b><textarea id="imp" placeholder="粘贴存档文字"></textarea><button data-act="import">导入</button> <span id="msg"></span></div>
     <div class="card"><button class="danger" data-act="reset">删除存档，重新开始</button></div>`,
  );
  el.querySelector<HTMLSelectElement>('#salvage')!.onchange = (e) => {
    s.autoSalvageBelow = Number((e.target as HTMLSelectElement).value);
    ctx.changed();
  };
  bind(el, (act) => {
    if (act === 'copy') {
      const ta = el.querySelector<HTMLTextAreaElement>('#exp')!;
      ta.select();
      void navigator.clipboard?.writeText(ta.value);
    }
    if (act === 'import') {
      const imported = importSave(el.querySelector<HTMLTextAreaElement>('#imp')!.value);
      if (!imported) el.querySelector('#msg')!.textContent = '存档无效';
      else {
        close();
        ctx.replace(imported);
      }
    }
    if (act === 'reset' && confirm('确定删除存档吗？此操作不可恢复。')) {
      localStorage.removeItem(SAVE_KEY);
      close();
      ctx.replace(null);
    }
  });
}

function duration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
}

export function openOfflineReport(r: OfflineReport): void {
  const lv = r.levelUps.map((l) => `${esc(l.name)} Lv${l.from} → Lv${l.to}`).join('<br>');
  const items = r.kept.slice(0, 20).map((it) => `<div class="row">${itemLine(it)}</div>`).join('');
  const el = open(
    '篝火日志',
    `<p>小队在篝火旁休整并巡逻了 <b>${duration(r.seconds)}</b>。</p>
     <div class="card">击杀 ${r.kills}　金币 +${r.gold}　每人经验 +${r.exp}<br>
     获得装备 ${r.kept.length} 件，自动分解 ${r.salvaged} 件（+${r.salvageGold} 金币）</div>
     ${lv ? `<div class="card"><b>升级</b><br>${lv}</div>` : ''}
     ${items ? `<div class="card"><b>新装备</b>${items}</div>` : ''}
     <div class="toolbar"><button data-act="close">继续冒险</button></div>`,
  );
  void el;
}
