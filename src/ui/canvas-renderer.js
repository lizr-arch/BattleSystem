import { ActorState, ActionPhase, DriverComboStage } from '../core/enums.js';

function point(canvas, worldX, worldY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / 1200, rect.height / 800);
  const offsetX = (rect.width - 1200 * scale) / 2;
  const offsetY = (rect.height - 800 * scale) / 2;
  return { x: offsetX + worldX * scale, y: offsetY + worldY * scale, scale };
}

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
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

    this.circle(target.x, target.y, actor.autoAttackRange, 'rgba(121,183,255,.035)', 'rgba(121,183,255,.25)', 1);
    this.circle(target.x, target.y, actor.artRange, 'rgba(127,216,141,.02)', 'rgba(127,216,141,.16)', 1);
    this.line(actor.position.x, actor.position.y, target.x, target.y, actor.inAutoRange ? 'rgba(121,183,255,.55)' : 'rgba(255,255,255,.12)', 2);

    this.circle(target.x, target.y, target.radius, '#30242a', '#ff7b7b', 3);
    this.text('DUMMY', target.x, target.y, '#ffd5d5', 13);
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

    for (const fx of actor.vfx) {
      const color = fx.kind === 'hit'
        ? '#ffd166'
        : fx.kind === 'smash'
          ? '#ff4d6d'
          : '#ff9dff';
      const size = fx.kind === 'smash' ? 28 : 22;
      this.text(fx.text, fx.x, fx.y, color, size);
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
