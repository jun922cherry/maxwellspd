// 实体工厂：创建墙体与粒子，剥离 DOM 依赖
import Matter from '../lib/matter.js';
import { generateMaxwellVelocity, generateSingleSpeedVelocity, generateDualSpeedVelocity } from '../physics/distributions.js';

const { Bodies, Body, Composite } = Matter;

export function createWalls(worldBounds) {
  const { width, height, thickness = 50 } = worldBounds;
  const half = thickness / 2;
  const walls = [
    Bodies.rectangle(width / 2, -half, width, thickness, { isStatic: true, label: 'topWall' }),
    Bodies.rectangle(width / 2, height + half, width, thickness, { isStatic: true, label: 'bottomWall' }),
    Bodies.rectangle(-half, height / 2, thickness, height, { isStatic: true, label: 'leftWall' }),
    Bodies.rectangle(width + half, height / 2, thickness, height, { isStatic: true, label: 'rightWall' })
  ];
  return walls;
}

export function createParticles({ count, width, height, radius = 5, distribution = 'maxwell', temperature = 300, molarMass = 28 }) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * (width - 2 * radius) + radius;
    const y = Math.random() * (height - 2 * radius) + radius;
    const p = Bodies.circle(x, y, radius, { restitution: 1, frictionAir: 0, label: 'particle' });
    let v;
    switch (distribution) {
      case 'single': v = generateSingleSpeedVelocity(temperature, molarMass); break;
      case 'dual': v = generateDualSpeedVelocity(temperature, molarMass); break;
      case 'maxwell':
      default: v = generateMaxwellVelocity(temperature, molarMass); break;
    }
    Body.setVelocity(p, v);
    particles.push(p);
  }
  return particles;
}

export function addBodies(engine, walls, particles) {
  Composite.add(engine.world, [...walls, ...particles]);
}