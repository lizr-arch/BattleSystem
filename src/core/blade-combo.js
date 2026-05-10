import { BladeComboElement, BladeComboStage, CombatEventType } from './enums.js';

function clampInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return x | 0;
}

function createEvent(type, data) {
  return { type, data };
}

function normalizeElement(element) {
  const e = String(element);
  if (e === BladeComboElement.Fire) return BladeComboElement.Fire;
  if (e === BladeComboElement.Water) return BladeComboElement.Water;
  return null;
}

function normalizeLevel(level) {
  return Math.max(0, Math.min(3, clampInt(level)));
}

function stageForStepIndex(stepIndex) {
  switch (stepIndex) {
    case 0: return BladeComboStage.Stage1;
    case 1: return BladeComboStage.Stage2;
    default: return BladeComboStage.None;
  }
}

export class BladeComboState {
  constructor({
    routes = [],
    stage = BladeComboStage.None,
    framesLeft = 0,
    routeId = null,
    stepIndex = -1,
  } = {}) {
    this.routes = Array.isArray(routes) ? routes.slice() : [];
    this.stage = stage;
    this.framesLeft = Math.max(0, clampInt(framesLeft));
    this.routeId = routeId ? String(routeId) : null;
    this.stepIndex = clampInt(stepIndex);
  }

  get activeRoute() {
    if (!this.routeId) return null;
    return this.routes.find((r) => r?.id === this.routeId) ?? null;
  }

  get expectedNext() {
    const route = this.activeRoute;
    if (!route) return null;
    const steps = route.steps ?? [];
    const nextIndex = this.stepIndex + 1;
    return steps[nextIndex] ?? null;
  }

  get durationFrames() {
    const route = this.activeRoute;
    const n = route?.durationFrames ?? 0;
    return Math.max(0, clampInt(n));
  }

  tick(frames = 1) {
    const n = Math.max(0, clampInt(frames));
    if (n <= 0) return null;
    if (this.stage === BladeComboStage.None) return null;
    if (this.framesLeft <= 0) return this.expire({ reason: 'zero' });

    const before = this.framesLeft;
    this.framesLeft = Math.max(0, this.framesLeft - n);

    if (before > 0 && this.framesLeft === 0) {
      return this.expire({ reason: 'timeout' });
    }

    return null;
  }

  apply({ element, level } = {}) {
    const e = normalizeElement(element);
    const lv = normalizeLevel(level);

    if (!e) {
      return { events: [createEvent(CombatEventType.BladeComboFailed, { stage: this.stage, element, level: lv, reason: 'invalid_element' })], token: null };
    }

    if (this.stage === BladeComboStage.None) {
      const start = this.findRouteStart({ element: e, level: lv });
      if (!start) {
        return {
          events: [createEvent(CombatEventType.BladeComboFailed, { stage: this.stage, element: e, level: lv, reason: 'no_route' })],
          token: null,
        };
      }

      this.routeId = start.route.id;
      this.stepIndex = 0;
      this.stage = BladeComboStage.Stage1;
      this.framesLeft = this.durationFrames;
      const expectedNext = this.expectedNext;
      const expectedNextMinLevel = expectedNext ? normalizeLevel(expectedNext?.minLevel) : 0;

      return {
        events: [createEvent(CombatEventType.BladeComboStarted, {
          routeId: this.routeId,
          stage: this.stage,
          element: e,
          level: lv,
          duration: this.durationFrames,
          framesLeft: this.framesLeft,
          expectedNextElement: expectedNext?.element ?? null,
          expectedNextMinLevel,
        })],
        token: null,
      };
    }

    const route = this.activeRoute;
    if (!route) {
      return {
        events: [createEvent(CombatEventType.BladeComboFailed, { stage: this.stage, element: e, level: lv, reason: 'missing_route' })],
        token: null,
      };
    }

    const expected = this.expectedNext;
    if (!expected) {
      return {
        events: [createEvent(CombatEventType.BladeComboFailed, { stage: this.stage, routeId: this.routeId, element: e, level: lv, reason: 'no_expected_next' })],
        token: null,
      };
    }

    const requiredElement = normalizeElement(expected.element);
    const requiredMinLevel = normalizeLevel(expected.minLevel);

    if (e !== requiredElement) {
      return {
        events: [createEvent(CombatEventType.BladeComboFailed, {
          stage: this.stage,
          routeId: this.routeId,
          element: e,
          level: lv,
          requiresElement: requiredElement,
          requiresMinLevel: requiredMinLevel,
          reason: 'wrong_element',
        })],
        token: null,
      };
    }

    if (lv < requiredMinLevel) {
      return {
        events: [createEvent(CombatEventType.BladeComboFailed, {
          stage: this.stage,
          routeId: this.routeId,
          element: e,
          level: lv,
          requiresElement: requiredElement,
          requiresMinLevel: requiredMinLevel,
          reason: 'insufficient_level',
        })],
        token: null,
      };
    }

    const steps = route.steps ?? [];
    const nextIndex = this.stepIndex + 1;
    const isLast = nextIndex >= steps.length - 1;

    if (isLast) {
      const beforeStage = this.stage;
      const beforeStepIndex = this.stepIndex;
      this.stage = BladeComboStage.None;
      this.framesLeft = 0;
      this.routeId = null;
      this.stepIndex = -1;

      const token = {
        id: String(route.tokenId ?? 'FireToken'),
        element: e,
        sourceRouteId: String(route.id ?? ''),
      };

      return {
        events: [createEvent(CombatEventType.BladeComboFinished, {
          routeId: String(route.id ?? ''),
          fromStage: beforeStage,
          fromStepIndex: beforeStepIndex,
          element: e,
          level: lv,
        })],
        token,
      };
    }

    const fromStage = this.stage;
    const fromStepIndex = this.stepIndex;
    this.stepIndex = nextIndex;
    this.stage = stageForStepIndex(this.stepIndex);
    this.framesLeft = this.durationFrames;
    const expectedNext = this.expectedNext;
    const expectedNextMinLevel = expectedNext ? normalizeLevel(expectedNext?.minLevel) : 0;

    return {
      events: [createEvent(CombatEventType.BladeComboAdvanced, {
        routeId: String(route.id ?? ''),
        fromStage,
        toStage: this.stage,
        fromStepIndex,
        toStepIndex: this.stepIndex,
        element: e,
        level: lv,
        duration: this.durationFrames,
        framesLeft: this.framesLeft,
        expectedNextElement: expectedNext?.element ?? null,
        expectedNextMinLevel,
      })],
      token: null,
    };
  }

  expire({ reason = 'timeout' } = {}) {
    const stage = this.stage;
    const routeId = this.routeId;
    const stepIndex = this.stepIndex;
    this.stage = BladeComboStage.None;
    this.framesLeft = 0;
    this.routeId = null;
    this.stepIndex = -1;
    return createEvent(CombatEventType.BladeComboExpired, { stage, routeId, stepIndex, reason });
  }

  findRouteStart({ element, level }) {
    const e = normalizeElement(element);
    const lv = normalizeLevel(level);
    for (const route of this.routes) {
      const steps = route?.steps ?? [];
      const first = steps[0];
      const firstElement = normalizeElement(first?.element);
      const firstMinLevel = normalizeLevel(first?.minLevel);
      if (firstElement === e && lv >= firstMinLevel) return { route };
    }
    return null;
  }
}
