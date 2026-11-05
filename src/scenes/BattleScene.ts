import Phaser from 'phaser';
import { buildLayer, buildSprite, SPRITE_SIZE } from '../art/sprites';
import { CLASSES } from '../data/classes';
import { DUNGEONS } from '../data/dungeons';
import { MAPS } from '../data/maps';
import { MONSTERS } from '../data/monsters';
import { loadGame, newGame, saveGame, type GameState } from '../game/state';
import { Battle, expToNext, TICK } from '../sim/battle';
import { RARITIES, type Item } from '../sim/items';
import { applyOfflineRewards } from '../sim/offline';
import * as panels from '../ui/panels';
import type { BattleEvent, Unit } from '../sim/types';

const W = 360;
const H = 640;
const ZOOM = 2;
const GROUND_Y = 262;
const BATTLE_TOP = 40;
const BATTLE_BOTTOM = 300;
const PIXEL = 3;
const FONT = '"Zpix", "PingFang SC", "Microsoft YaHei", monospace';
const MAX_LOG = 6;
const AUTOSAVE_MS = 10_000;
let listenersBound = false;
const FRAME_H = 30;

interface UnitView {
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBack: Phaser.GameObjects.Rectangle;
  yOffset: number;
  baseScale: number;
}

interface PartyFrame {
  label: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  mp: Phaser.GameObjects.Rectangle;
  exp: Phaser.GameObjects.Rectangle;
}

function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 10, color = '#f4f4f4') {
  return scene.add
    .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: ZOOM * 2, stroke: '#1a1c2c', strokeThickness: 2 })
    .setResolution(ZOOM * 2);
}

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private state!: GameState;
  private views = new Map<number, UnitView>();
  private frames: PartyFrame[] = [];
  private logLines: Phaser.GameObjects.Text[] = [];
  private log: { s: string; c: string }[] = [];
  private layers: { ts: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private acc = 0;
  private speed = 1;
  private goldText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;

  constructor() {
    super('battle');
  }

  create(data: { dungeon?: string } = {}): void {
    this.views = new Map();
    this.frames = [];
    this.logLines = [];
    this.layers = [];
    this.log = [];
    this.acc = 0;
    this.dungeonLoot = [];
    this.bossId = '';
    this.cameras.main.setZoom(ZOOM).centerOn(W / 2, H / 2);
    this.state = loadGame() ?? newGame();
    const offline = applyOfflineRewards(this.state, (Date.now() - this.state.lastSeen) / 1000);
    this.speed = this.state.speed || 1;
    const dungeon = DUNGEONS.find((d) => d.id === data.dungeon);
    this.battle = new Battle(this.state, Date.now(), dungeon);
    const map = this.battle.map;
    saveGame(this.state);
    if (offline) panels.openOfflineReport(offline);
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => saveGame(this.state) });
    if (!listenersBound) {
      listenersBound = true;
      const flush = () => saveGame(this.state);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
      window.addEventListener('pagehide', flush);
    }

    for (const c of Object.values(CLASSES)) this.canvasTex(`u_${c.id}`, buildSprite(c.look));
    for (const m of Object.values(MONSTERS)) this.canvasTex(`u_${m.id}`, buildSprite(m.look));

    this.buildBackground();
    this.buildHud();
    if (dungeon) this.addLog(`小队进入【${dungeon.name}】，共 ${dungeon.stages.length} 关。`, '#b45cff');
    else this.addLog(`小队抵达【${map.name}】，点燃篝火，开始巡逻。`, '#f7c948');
  }

  private dungeonLoot: Item[] = [];
  private bossId = '';

  private canvasTex(key: string, c: HTMLCanvasElement): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, c);
  }

  private restartBattle(dungeonId?: string): void {
    panels.close();
    saveGame(this.state);
    this.scene.restart({ dungeon: dungeonId });
  }

  private buildBackground(): void {
    const t = this.battle.map.theme;
    const sky = this.add.graphics();
    const bands = 8;
    const c0 = Phaser.Display.Color.HexStringToColor(t.sky[0]);
    const c1 = Phaser.Display.Color.HexStringToColor(t.sky[1]);
    const bandH = (GROUND_Y - BATTLE_TOP) / bands;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, bands - 1, i);
      sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      sky.fillRect(0, BATTLE_TOP + i * bandH, W, bandH + 1);
    }
    const mk = (key: string, canvas: HTMLCanvasElement, y: number, speed: number) => {
      this.canvasTex(key, canvas);
      const ts = this.add.tileSprite(0, y, W, canvas.height * PIXEL, key).setOrigin(0, 0).setTileScale(PIXEL);
      this.layers.push({ ts, speed });
    };
    mk('bg_far', buildLayer('far', t.far, t.far, 120, 40), GROUND_Y - 110, 8);
    mk('bg_mid', buildLayer('mid', t.mid, t.groundDark, 120, 30), GROUND_Y - 90, 25);
    mk('bg_ground', buildLayer('ground', t.ground, t.groundDark, 60, 13), GROUND_Y - 4, 60);
  }

  private buildHud(): void {
    const g = this.add.graphics().setDepth(900);
    g.fillStyle(0x262b44).fillRect(0, 0, W, BATTLE_TOP);
    g.fillStyle(0x1a1c2c).fillRect(0, BATTLE_BOTTOM, W, H - BATTLE_BOTTOM);
    g.lineStyle(2, 0x5d4a3a).strokeRect(1, 1, W - 2, BATTLE_TOP - 2);
    txt(this, 8, 6, '篝火远征队', 13, '#f7c948').setDepth(901);
    txt(this, 8, 23, `${this.battle.map.name}  ${this.battle.dungeon ? '5人副本' : `Lv${this.battle.map.minLevel}-${this.battle.map.maxLevel}`}`, 9, '#a7f070').setDepth(901);
    this.goldText = txt(this, W - 8, 8, '金币 0', 11, '#f7c948').setOrigin(1, 0).setDepth(901);

    const sb = this.add.rectangle(W - 26, BATTLE_TOP + 14, 36, 18, 0x262b44).setStrokeStyle(1, 0xf7c948).setDepth(901);
    this.speedText = txt(this, W - 26, BATTLE_TOP + 14, `${this.speed}x`, 10, '#f7c948').setOrigin(0.5).setDepth(902);
    sb.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      this.state.speed = this.speed;
      this.speedText.setText(`${this.speed}x`);
    });

    const py = BATTLE_BOTTOM + 6;
    this.add.rectangle(10, py, W - 20, 12, 0x333c57).setOrigin(0, 0).setDepth(901);
    this.progressBar = this.add.rectangle(10, py, 0, 12, 0xef7d57).setOrigin(0, 0).setDepth(902);
    this.progressText = txt(this, W / 2, py + 6, '', 9).setOrigin(0.5).setDepth(903);

    const fy = BATTLE_BOTTOM + 24;
    this.battle.heroes.forEach((h, i) => {
      const y = fy + i * FRAME_H;
      this.add.rectangle(8, y, W - 16, FRAME_H - 3, 0x262b44).setOrigin(0, 0).setStrokeStyle(1, 0x3e4766).setDepth(901);
      const icon = this.add.image(24, y + 13, `u_${h.defId}`).setScale(1.5).setDepth(902);
      icon.setCrop(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const label = txt(this, 40, y + 1, '', 8).setDepth(902);
      this.add.rectangle(40, y + 13, 200, 6, 0x5d275d).setOrigin(0, 0).setDepth(902);
      const hp = this.add.rectangle(40, y + 13, 200, 6, 0x38b764).setOrigin(0, 0).setDepth(903);
      const hpText = txt(this, 246, y + 10, '', 8).setDepth(903);
      this.add.rectangle(40, y + 21, 200, 3, 0x29366f).setOrigin(0, 0).setDepth(902).setVisible(h.stats.maxMana > 0);
      const mp = this.add.rectangle(40, y + 21, 200, 3, 0x41a6f6).setOrigin(0, 0).setDepth(903);
      const exp = this.add.rectangle(8, y + FRAME_H - 4, 0, 1, 0xf7c948).setOrigin(0, 0).setDepth(903);
      this.frames.push({ label, hp, hpText, mp, exp });
    });

    const ly = fy + this.battle.heroes.length * FRAME_H + 3;
    this.add.rectangle(8, ly, W - 16, MAX_LOG * 14 + 22, 0x14151f).setOrigin(0, 0).setStrokeStyle(1, 0x3e4766).setDepth(901);
    txt(this, 14, ly + 3, '冒险日志', 9, '#94b0c2').setDepth(902);
    for (let i = 0; i < MAX_LOG; i++) this.logLines.push(txt(this, 14, ly + 18 + i * 14, '', 9).setDepth(902));

    const tabs = ['小队', '背包', '天赋', '地图', '副本', '更多'];
    const tw = W / tabs.length;
    tabs.forEach((name, i) => {
      const r = this.add.rectangle(i * tw, H - 40, tw, 40, 0x3b5dc9).setOrigin(0, 0).setStrokeStyle(1, 0x1a1c2c).setDepth(901);
      txt(this, i * tw + tw / 2, H - 20, name, 11, '#f4f4f4').setOrigin(0.5).setDepth(902);
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        const ctx = this.panelCtx();
        if (name === '小队') panels.openTeam(ctx);
        else if (name === '背包') panels.openBag(ctx);
        else if (name === '天赋') panels.openTalents(ctx);
        else if (name === '地图') panels.openMaps(ctx);
        else if (name === '副本') panels.openDungeon(ctx);
        else panels.openSettings(ctx);
      });
    });
  }

  private panelCtx(): panels.PanelCtx {
    return {
      state: this.state,
      changed: () => {
        this.battle.refreshHeroStats();
        saveGame(this.state);
      },
      replace: (s) => {
        if (s) saveGame(s);
        window.location.reload();
      },
      restart: (id) => this.restartBattle(id),
    };
  }

  update(_t: number, delta: number): void {
    this.acc += (delta / 1000) * this.speed;
    let steps = 0;
    while (this.acc >= TICK && steps < 60) {
      this.battle.tick(TICK);
      for (const e of this.battle.drainEvents()) this.onEvent(e);
      this.acc -= TICK;
      steps++;
    }
    if (steps >= 60) this.acc = 0;
    this.render(delta / 1000);
  }

  private render(dt: number): void {
    const b = this.battle;
    const travelling = b.phase === 'travel';
    for (const l of this.layers) if (travelling) l.ts.tilePositionX += (l.speed * dt * this.speed) / PIXEL;

    for (const u of b.units) {
      const v = this.views.get(u.uid);
      if (!v) continue;
      const walking = travelling || Math.abs(v.root.x - u.x) > 0.5;
      v.root.x = u.x;
      const bob = u.alive && walking ? Math.abs(Math.sin(this.time.now / 90)) * -2 : 0;
      v.sprite.y = bob;
      v.root.y = GROUND_Y + v.yOffset;
      v.root.setDepth(100 + v.root.y);
      v.hpBar.width = (v.hpBack.width * u.hp) / u.stats.maxHp;
      v.hpBar.setVisible(u.alive);
      v.hpBack.setVisible(u.alive);
    }

    this.goldText.setText(`金币 ${b.gold}`);
    if (b.dungeon) {
      const n = b.dungeon.stages.length;
      this.progressBar.width = (W - 20) * Math.min(1, b.stage / n);
      this.progressBar.fillColor = 0xb45cff;
      const boss = b.bossWave && this.bossId ? ` · 首领：${MONSTERS[this.bossId].name}` : '';
      this.progressText.setText(b.result ? (b.result === 'cleared' ? '副本通关！' : '挑战失败') : `第 ${Math.min(b.stage + 1, n)}/${n} 关${boss}`);
    } else if (b.bossDefeated) {
      this.progressBar.width = W - 20;
      this.progressBar.fillColor = 0xf7c948;
      this.progressText.setText(`灯塔篝火已点燃 · 击杀 ${b.kills}`);
    } else if (b.bossWave) {
      this.progressBar.width = W - 20;
      this.progressText.setText(`挑战灯塔守护者：${MONSTERS[b.map.boss].name}`);
    } else {
      this.progressBar.width = (W - 20) * b.bossProgress;
      this.progressText.setText(`黑雾浓度 ${b.kills}/${b.map.killsForBoss}（击杀怪物召唤守护者）`);
    }

    b.heroes.forEach((h, i) => {
      const f = this.frames[i];
      if (!f) return;
      f.label.setText(`${h.name}  ${CLASSES[h.defId].name}  Lv${h.level}${h.alive ? '' : '  (阵亡)'}`);
      f.hp.width = (200 * h.hp) / h.stats.maxHp;
      f.hp.fillColor = h.hp / h.stats.maxHp < 0.35 ? 0xb13e53 : 0x38b764;
      f.hpText.setText(`${Math.round(h.hp)}/${h.stats.maxHp}`);
      f.mp.width = h.stats.maxMana ? (200 * h.mana) / h.stats.maxMana : 0;
      f.exp.width = ((W - 16) * h.exp) / expToNext(h.level);
    });
  }

  private createView(u: Unit): void {
    const key = `u_${u.defId}`;
    const scale = PIXEL * (u.team === 'enemy' ? MONSTERS[u.defId]?.scale ?? 1 : 1);
    const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(scale).setFlipX(u.team === 'enemy');
    const barW = u.isBoss ? 60 : 26;
    const top = -SPRITE_SIZE * scale - 4;
    const hpBack = this.add.rectangle(-barW / 2, top, barW, 3, 0x1a1c2c).setOrigin(0, 0.5);
    const hpBar = this.add.rectangle(-barW / 2, top, barW, 3, u.team === 'hero' ? 0x38b764 : 0xb13e53).setOrigin(0, 0.5);
    const root = this.add.container(u.x, GROUND_Y, [sprite, hpBack, hpBar]);
    if (u.isBoss) root.add(txt(this, 0, top - 10, u.name, 9, '#ff6688').setOrigin(0.5));
    const yOffset = u.team === 'hero' ? { tank: 4, dps: -6, healer: 0 }[u.role] : ((u.uid * 7) % 3) * 5 - 2;
    this.views.set(u.uid, { root, sprite, hpBar, hpBack, yOffset, baseScale: scale });
    if (u.team === 'enemy') {
      root.setAlpha(0);
      this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    }
  }

  private float(uid: number, s: string, color: string, size = 10): void {
    const v = this.views.get(uid);
    if (!v) return;
    const t = txt(this, v.root.x + Phaser.Math.Between(-8, 8), v.root.y - SPRITE_SIZE * v.baseScale - 6, s, size, color)
      .setOrigin(0.5)
      .setDepth(800);
    this.tweens.add({ targets: t, y: t.y - 22, alpha: 0, duration: 900 / Math.sqrt(this.speed), ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private banner(s: string, color: string, ms = 1800): void {
    const t = txt(this, W / 2, BATTLE_TOP + 60, s, 14, color).setOrigin(0.5).setDepth(950).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 6, duration: 250, yoyo: true, hold: ms, onComplete: () => t.destroy() });
  }

  private addLog(s: string, c = '#f4f4f4'): void {
    this.log.push({ s, c });
    if (this.log.length > MAX_LOG) this.log.shift();
    this.logLines.forEach((l, i) => {
      const e = this.log[i];
      l.setText(e ? e.s : '').setColor(e ? e.c : '#f4f4f4');
    });
  }

  private onEvent(e: BattleEvent): void {
    const b = this.battle;
    switch (e.type) {
      case 'spawn': {
        const u = b.unit(e.uid);
        if (u) this.createView(u);
        break;
      }
      case 'despawn': {
        this.views.get(e.uid)?.root.destroy();
        this.views.delete(e.uid);
        break;
      }
      case 'cast': {
        const src = b.unit(e.src);
        const v = this.views.get(e.src);
        if (!src || !v) break;
        const isBasic = e.skill.id === src.basicAttack.id;
        if (!isBasic) this.float(e.src, e.skill.name, src.team === 'hero' ? '#73eff7' : '#ff6688', 9);
        if (e.skill.kind === 'aoeDamage' && src.team === 'enemy') this.cameras.main.shake(200, 0.006);
        if (e.skill.ranged && (e.skill.kind === 'damage' || e.skill.kind === 'aoeDamage')) {
          const color = src.defId === 'priest' ? 0xf7c948 : e.skill.id === 'm_fireball' ? 0xef7d57 : 0x73eff7;
          for (const tid of e.targets) {
            const tv = this.views.get(tid);
            if (!tv) continue;
            const p = this.add.rectangle(v.root.x + 10, v.root.y - 26, 5, 5, color).setDepth(700);
            this.tweens.add({ targets: p, x: tv.root.x, y: tv.root.y - 18, duration: 220 / this.speed, onComplete: () => p.destroy() });
          }
        } else if (e.skill.kind === 'damage' || e.skill.kind === 'aoeDamage') {
          const dir = src.team === 'hero' ? 1 : -1;
          this.tweens.add({ targets: v.sprite, x: 8 * dir, duration: 80 / this.speed, yoyo: true });
        }
        break;
      }
      case 'damage': {
        const tgt = b.unit(e.tgt);
        const v = this.views.get(e.tgt);
        if (!tgt || !v) break;
        const color = tgt.team === 'hero' ? '#ff5f5f' : e.crit ? '#f7c948' : '#f4f4f4';
        this.float(e.tgt, e.crit ? `${e.amount}!` : `${e.amount}`, color, e.crit ? 14 : 10);
        v.sprite.setTint(0xff9999);
        this.time.delayedCall(70, () => v.sprite.active && v.sprite.clearTint());
        break;
      }
      case 'heal':
        if (e.amount > 0) this.float(e.tgt, `+${e.amount}`, '#a7f070', e.crit ? 13 : 10);
        break;
      case 'death': {
        const u = b.unit(e.uid);
        const v = this.views.get(e.uid);
        if (!u || !v) break;
        if (u.team === 'hero') {
          v.sprite.setTint(0x666666).setAngle(-90).setOrigin(0.5, 0.6);
          this.addLog(`${u.name} 倒下了！`, '#ff5f5f');
        } else {
          this.tweens.add({ targets: v.root, alpha: 0, duration: 400 });
        }
        break;
      }
      case 'loot': {
        const u = b.unit(e.uid);
        this.float(e.uid, `+${e.gold}金`, '#f7c948', 9);
        if (u) this.addLog(`击败 ${u.name}(Lv${u.level})，经验 +${e.exp}，金币 +${e.gold}`, '#c2c3c7');
        break;
      }
      case 'drop': {
        const r = RARITIES[e.item.rarity];
        if (this.battle.dungeon && !e.salvaged) this.dungeonLoot.push(e.item);
        if (e.salvaged) this.addLog(`拾取 [${r.name}]${e.item.name}，自动分解 +${e.gold}金`, '#8b93a8');
        else {
          this.float(e.uid, e.item.name, r.color, 9);
          this.addLog(`获得 [${r.name}]${e.item.name}`, r.color);
        }
        break;
      }
      case 'levelUp': {
        const u = b.unit(e.uid);
        this.float(e.uid, '升级！', '#f7c948', 13);
        const v = this.views.get(e.uid);
        if (v) {
          const beam = this.add.rectangle(v.root.x, v.root.y, 20, 80, 0xf7c948, 0.5).setOrigin(0.5, 1).setDepth(650);
          this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.2, duration: 700, onComplete: () => beam.destroy() });
        }
        if (u) this.addLog(`${u.name} 升到了 ${e.level} 级！`, '#f7c948');
        break;
      }
      case 'waveStart':
        this.bossId = e.bossId ?? '';
        if (e.boss && b.dungeon) {
          this.banner(`首领【${MONSTERS[this.bossId].name}】挡住了去路！`, '#ff6688');
          this.addLog(`第 ${e.wave} 关：首领 ${MONSTERS[this.bossId].name}`, '#ff6688');
        } else if (b.dungeon) this.addLog(`第 ${e.wave} 关：黑雾中的爪牙`, '#b45cff');
        else if (e.boss) {
          this.banner(`灯塔守护者【${MONSTERS[this.bossId].name}】出现了！`, '#ff6688');
          this.addLog(`黑雾凝聚……灯塔守护者现身！`, '#ff6688');
        }
        break;
      case 'bossDefeated':
        this.banner('灯塔篝火已点燃！', '#f7c948', 2400);
        this.addLog(`击败守护者，${b.map.name}的灯塔篝火重新燃起！`, '#f7c948');
        {
          const next = MAPS[MAPS.findIndex((m) => m.id === b.map.id) + 1];
          if (next) this.addLog(`新地图解锁：【${next.name}】（底部“地图”前往）`, '#a7f070');
        }
        saveGame(this.state);
        break;
      case 'dungeonEnd':
        saveGame(this.state);
        this.banner(e.cleared ? '副本通关！' : '小队力竭，撤离副本', e.cleared ? '#f7c948' : '#ff5f5f', 2000);
        this.addLog(e.cleared ? `${b.map.name} 通关！` : `${b.map.name} 挑战失败。`, e.cleared ? '#f7c948' : '#ff5f5f');
        this.time.delayedCall(1500, () =>
          panels.openDungeonResult(e.cleared, b.map.name, this.dungeonLoot, () => this.restartBattle()),
        );
        break;
      case 'wipe':
        this.banner('小队全灭……回到篝火休整', '#ff5f5f');
        this.addLog('小队全灭，正在篝火旁休整。', '#ff5f5f');
        break;
      case 'revive':
        for (const h of b.heroes) {
          const v = this.views.get(h.uid);
          v?.sprite.clearTint().setAngle(0).setOrigin(0.5, 1);
        }
        this.addLog('休整完毕，小队重新出发。', '#a7f070');
        break;
    }
  }
}
