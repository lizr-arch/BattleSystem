import { createHpDamageTrait } from './skill-trait.js';

export const RoutineId = Object.freeze({
  FireRoutine: 'FireRoutine',
});

export const RoutineSkillId = Object.freeze({
  FireSkill1: 'FireSkill1',
  FireSkill2: 'FireSkill2',
  FireSkill3: 'FireSkill3',
});

export function getRoutineSkillByArtId(artId) {
  const id = String(artId ?? '');
  if (id === 'Art1') {
    return {
      routineId: RoutineId.FireRoutine,
      skillId: RoutineSkillId.FireSkill1,
      layer: 1,
      traits: [createHpDamageTrait(30)],
    };
  }
  if (id === 'Art2') {
    return {
      routineId: RoutineId.FireRoutine,
      skillId: RoutineSkillId.FireSkill2,
      layer: 2,
      traits: [createHpDamageTrait(40)],
    };
  }
  if (id === 'Art3') {
    return {
      routineId: RoutineId.FireRoutine,
      skillId: RoutineSkillId.FireSkill3,
      layer: 3,
      traits: [createHpDamageTrait(50)],
    };
  }
  return null;
}

