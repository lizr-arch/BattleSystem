import { ActorState, ActionPhase, BladeComboStage, DriverComboStage } from '../core/enums.js';

function point(canvas, worldX, worldY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / 1200, rect.height / 800);
  const offsetX = (rect.width - 1200 * scale) / 2;
  const offsetY = (rect.height - 800 * scale) / 2;
  return { x: offsetX + worldX * scale, y: offsetY + worldY * scale, scale };
}

function rgba(hex, a) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function parseEventLine(line) {
  const m = /^F(\d+)\s+(.+)$/.exec(String(line || '').trim());
  if (!m) return null;
  return { frame: Number(m[1]) | 0, message: String(m[2] || '') };
}

function parseRouteStepTotal(routeId) {
  const s = String(routeId || '');
  const hits = s.match(/Fire|Water/g);
  return Array.isArray(hits) ? hits.length : 0;
}

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.lastSmashEventFrame = -1;
    this.lastTokenEventFrame = -1;
    this.smashFlashUntilFrame = 0;
    this.tokenFlashUntilFrame = 0;
    this.lastEnemyOutcomeFrame = -1;
    this.enemyOutcomeKind = null;
    this.enemyOutcomeFlashUntilFrame = 0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(snapshot) {
    const rect = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, rect.width, rect.height);

    const actor = snapshot;
    const target = actor.target;
    const enemy = actor.enemy ?? null;
    const frame = Number(actor.frame ?? 0) | 0;

    this.circle(target.x, target.y, actor.autoAttackRange, 'rgba(121,183,255,.035)', 'rgba(121,183,255,.25)', 1);
    this.circle(target.x, target.y, actor.artRange, 'rgba(127,216,141,.02)', 'rgba(127,216,141,.16)', 1);
    this.line(actor.position.x, actor.position.y, target.x, target.y, actor.inAutoRange ? 'rgba(121,183,255,.55)' : 'rgba(255,255,255,.12)', 2);

    this.circle(target.x, target.y, target.radius, '#30242a', '#ff7b7b', 3);
    this.text('DUMMY', target.x, target.y, '#ffd5d5', 13);

    const hp = Math.max(0, Number(target.hp ?? 0));
    const maxHp = Math.max(0, Number(target.maxHp ?? 0));
    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    {
      const anchor = point(this.canvas, target.x, target.y - target.radius - 18);
      const w = 180;
      const h = 10;
      const x = anchor.x - w / 2;
      const y = anchor.y - h / 2;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = target.dead ? 'rgba(152,162,179,.9)' : 'rgba(255,123,123,.9)';
      ctx.fillRect(x, y, Math.round(w * hpRatio), h);
      ctx.font = '12px ui-monospace, Consolas, monospace';
      ctx.fillStyle = '#0d1017';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${hp | 0}/${maxHp | 0}`, anchor.x, anchor.y);
    }

    const playerHp = Math.max(0, Number(actor.player?.hp ?? 0));
    const playerMaxHp = Math.max(0, Number(actor.player?.maxHp ?? 0));
    const playerHpRatio = playerMaxHp > 0 ? Math.max(0, Math.min(1, playerHp / playerMaxHp)) : 0;
    {
      const anchor = point(this.canvas, actor.position.x, actor.position.y - actor.radius - 40);
      const w = 160;
      const h = 10;
      const x = anchor.x - w / 2;
      const y = anchor.y - h / 2;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = actor.player?.dead ? 'rgba(152,162,179,.9)' : 'rgba(121,183,255,.9)';
      ctx.fillRect(x, y, Math.round(w * playerHpRatio), h);
      ctx.font = '12px ui-monospace, Consolas, monospace';
      ctx.fillStyle = '#0d1017';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const deadSuffix = actor.player?.dead ? ' DEAD' : '';
      ctx.fillText(`${playerHp | 0}/${playerMaxHp | 0}${deadSuffix}`, anchor.x, anchor.y);
    }

    const driverStage = actor.driverCombo?.stage ?? DriverComboStage.None;
    if (driverStage !== DriverComboStage.None) {
      const stageLabel = String(driverStage).toUpperCase();
      const stageColor = driverStage === DriverComboStage.Break
        ? '#79b7ff'
        : driverStage === DriverComboStage.Topple
          ? '#ffd166'
          : '#c59cff';
      this.text(stageLabel, target.x, target.y - target.radius - 42, stageColor, 18);
    }

    const bladeStage = actor.bladeCombo?.stage ?? BladeComboStage.None;
    const bcRouteId = actor.bladeCombo?.routeId ?? null;
    const bcStepIndex = Number(actor.bladeCombo?.stepIndex ?? -1) | 0;
    if (bladeStage !== BladeComboStage.None && bcRouteId) {
      const stepNow = Math.max(0, bcStepIndex + 1);
      const stepTotal = parseRouteStepTotal(bcRouteId);
      const label = stepTotal > 0 ? `${String(bcRouteId)} ${stepNow}/${stepTotal}` : `${String(bcRouteId)} ${stepNow}/?`;
      this.text(label, target.x, target.y - target.radius - 66, '#ff9dff', 14);
    }

    const spCharge = actor.specialGauge?.charge ?? 0;
    const spLv = actor.specialGauge?.readyLevel ?? 0;
    const tokens = Array.isArray(actor.tokens) ? actor.tokens : [];
    const tokenIds = tokens.map((t) => String(t?.id ?? 'Token'));
    const tokenLabel = tokenIds.length > 0 ? tokenIds.slice(-3).join(',') : '-';
    const orb = actor.routineOrb;
    const orbLabel = orb ? `${String(orb.routineId ?? '?')} L${Number(orb.totalLayer ?? 0) | 0}` : '-';
    const debuffs = Array.isArray(actor.debuffs) ? actor.debuffs : [];
    const burn = debuffs.find((d) => d?.type === 'Burn' && (d?.framesLeft ?? 0) > 0) ?? null;
    const burnLabel = burn ? `${(burn.framesLeft ?? 0) | 0}f` : '-';
    const hudX = 120;
    this.text(`SP ${spCharge}/300 L${spLv}`, hudX, 40, '#7fd88d', 12);
    if (bladeStage !== BladeComboStage.None && bcRouteId) {
      const stepNow = Math.max(0, bcStepIndex + 1);
      const stepTotal = parseRouteStepTotal(bcRouteId);
      const bcHud = stepTotal > 0 ? `BC ${String(bcRouteId)} ${stepNow}/${stepTotal}` : `BC ${String(bcRouteId)} ${stepNow}/?`;
      this.text(bcHud, hudX, 60, '#ff9dff', 12);
    } else {
      this.text('BC -', hudX, 60, '#ff9dff', 12);
    }
    this.text(`TOK ${tokenLabel}`, hudX, 80, '#e8ecf3', 12);
    this.text(`ORB ${orbLabel}`, hudX, 100, '#ff9dff', 12);
    this.text(`BURN ${burnLabel}`, hudX, 120, '#ffd166', 12);
    this.text(`ENEMY ${String(enemy?.state ?? '-')}`, hudX, 140, '#ff7b7b', 12);
    if (enemy?.currentAction?.phase === ActionPhase.Startup) {
      this.text('ENEMY WINDUP', hudX, 160, '#ffd166', 12);
    }
    if (actor.battle?.result === 'Victory') {
      this.text('VICTORY', 600, 120, '#7fd88d', 42);
    }
    if (actor.battle?.result === 'Defeat') {
      this.text('DEFEAT', 600, 120, '#ff4d6d', 42);
      if (actor.paused) {
        this.text('Press R to Reset', 600, 172, '#9aa3b2', 16);
      }
    }

    let fill = '#273244';
    let stroke = actor.inAutoRange ? '#7fd88d' : '#98a2b3';

    if (actor.state === ActorState.AutoAttack && actor.action) {
      const phase = actor.action.phase;
      if (phase === ActionPhase.Startup) { fill = '#343051'; stroke = '#c59cff'; }
      if (phase === ActionPhase.Active) { fill = '#4a3822'; stroke = '#ffd166'; }
      if (phase === ActionPhase.Recovery) { fill = '#263d33'; stroke = '#7fd88d'; }
    }

    if (actor.state === ActorState.Art) {
      fill = '#47304c';
      stroke = '#ff9dff';
    }

    this.circle(actor.position.x, actor.position.y, actor.radius, fill, stroke, 3);
    this.text('PLAYER', actor.position.x, actor.position.y - 38, '#e8ecf3', 13);

    const dx = target.x - actor.position.x;
    const dy = target.y - actor.position.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.line(
      actor.position.x,
      actor.position.y,
      actor.position.x + dx / dist * 42,
      actor.position.y + dy / dist * 42,
      stroke,
      3
    );

    const actionLabel = actor.action ? `${actor.action.id} / ${actor.action.phase}` : actor.state;
    this.text(actionLabel, actor.position.x, actor.position.y + 42, '#cfd6e4', 12);

    const logText = typeof actor.eventLogText === 'string' ? actor.eventLogText : '';
    if (logText) {
      const lines = logText.split('\n');
      const head = lines.slice(0, 18);
      for (const line of head) {
        const parsed = parseEventLine(line);
        if (!parsed) continue;
        if (parsed.message.startsWith('DriverComboFinished')) {
          if (parsed.frame > this.lastSmashEventFrame) {
            this.lastSmashEventFrame = parsed.frame;
            this.smashFlashUntilFrame = parsed.frame + 24;
          }
        }
        if (parsed.message.startsWith('TokenCreated')) {
          if (parsed.frame > this.lastTokenEventFrame) {
            this.lastTokenEventFrame = parsed.frame;
            this.tokenFlashUntilFrame = parsed.frame + 24;
          }
        }
      }
    }

    const enemyOutcome = actor.lastEnemyOutcome;
    if (enemyOutcome && enemyOutcome.frame !== this.lastEnemyOutcomeFrame) {
      this.lastEnemyOutcomeFrame = enemyOutcome.frame;
      this.enemyOutcomeKind = enemyOutcome.kind;
      this.enemyOutcomeFlashUntilFrame = enemyOutcome.frame + 24;
    }

    if (frame < this.smashFlashUntilFrame) {
      const left = Math.max(0, this.smashFlashUntilFrame - frame);
      const a = Math.max(0, Math.min(1, left / 24));
      this.text('SMASH!', target.x, target.y - target.radius - 110, rgba('#ff4d6d', a), 30);
    }
    if (frame < this.tokenFlashUntilFrame) {
      const left = Math.max(0, this.tokenFlashUntilFrame - frame);
      const a = Math.max(0, Math.min(1, left / 24));
      this.text('TOKEN!', target.x, target.y - target.radius - 140, rgba('#ff9dff', a), 26);
    }
    if (frame < this.enemyOutcomeFlashUntilFrame && this.enemyOutcomeKind) {
      const left = Math.max(0, this.enemyOutcomeFlashUntilFrame - frame);
      const a = Math.max(0, Math.min(1, left / 24));
      const label = this.enemyOutcomeKind === 'hit' ? 'HIT!' : 'MISS';
      const color = this.enemyOutcomeKind === 'hit' ? '#ffd166' : '#98a2b3';
      this.text(label, actor.position.x, actor.position.y - actor.radius - 72, rgba(color, a), 26);
    }

    for (const fx of actor.vfx) {
      const color = fx.kind === 'hit'
        ? '#ffd166'
        : fx.kind === 'smash'
          ? '#ff4d6d'
          : '#ff9dff';
      const size = fx.kind === 'smash' ? 28 : 22;
      this.text(fx.text, fx.x, fx.y, color, size);
    }

    const bladeRuntimes = Array.isArray(actor.bladeRuntimes) ? actor.bladeRuntimes : [];
    for (const br of bladeRuntimes) {
      const bx = actor.position.x + 30 + (bladeRuntimes.indexOf(br) * 30);
      const by = actor.position.y + 40;
      this.circle(bx, by, 8, 'rgba(255,178,100,.25)', '#ffb264', 2);
      if (br.element !== 'Neutral') {
        this.text(br.element, bx, by - 16, '#ff9d78', 11);
      }
      if (br.species) {
        this.text(br.species, bx + 14, by - 8, '#ffe066', 9);
      }
      if (br.cooldownLeft > 0) {
        this.text(String(br.cooldownLeft), bx + 12, by + 4, '#98a2b3', 10);
      }
      if (br.bond?.sync > 0) {
        this.text(`Sync ${br.bond.sync}`, bx, by + 16, '#c59cff', 9);
      }
    }

    if (actor.paused) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.font = '32px system-ui';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', rect.width / 2, rect.height / 2);
    }
  }

  circle(x, y, r, fill, stroke, lineWidth = 2) {
    const p = point(this.canvas, x, y);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * p.scale, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  line(x1, y1, x2, y2, stroke, lineWidth = 2) {
    const a = point(this.canvas, x1, y1);
    const b = point(this.canvas, x2, y2);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  text(text, x, y, fill = '#e8ecf3', size = 13) {
    const p = point(this.canvas, x, y);
    const ctx = this.ctx;
    ctx.font = `${size}px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = fill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x, p.y);
  }
}
