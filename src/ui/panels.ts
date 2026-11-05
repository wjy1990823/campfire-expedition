import { CLASSES } from '../data/classes';
import { autoEquip, equip, salvage, salvageBelow, unequip, upgradeDelta } from '../game/actions';
import { exportSave, importSave, SAVE_KEY, type GameState } from '../game/state';
import { recordStats } from '../sim/battle';
import { formatStat, RARITIES, SLOT_NAMES, SLOTS, type Item, type StatKey } from '../sim/items';
import type { OfflineReport } from '../sim/offline';

export interface PanelCtx {
  state: GameState;
  /** Called after the state was mutated by the panel. */
  changed(): void;
  /** Replace the whole save (import / reset). */
  replace(s: GameState | null): void;
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
        <small class="stats">生命 ${st.maxHp}　攻击 ${Math.round(st.atk)}　护甲 ${Math.round(st.armor)}　暴击 ${(st.crit * 100).toFixed(1)}%</small></summary>${gear}</details>`;
    })
    .join('');
  const el = open('小队', `<div class="toolbar"><button data-act="auto">一键换装</button></div>${body}`);
  bind(el, (act, d) => {
    if (act === 'unequip') unequip(s, Number(d.hero), d.slot as Item['slot']);
    if (act === 'auto') autoEquip(s);
    ctx.changed();
    openTeam(ctx);
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
