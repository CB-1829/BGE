import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { gameAudio } from './utils/helper';
import { getConfig } from './constants';
import {
  GameState,
  PlacedStructure,
  EnemyEntity,
  VoxelResourceDrop,
  ConveyorItem,
  Projectile,
  ParticleVoxel,
  StructureType,
  PlanetId,
} from './types';

// Noise generation for dynamic voxel chunks
function makeSimpleNoise(seed: number) {
  return (x: number, z: number) => {
    const s = Math.sin(x * 0.15 + seed) * Math.cos(z * 0.15 + seed * 1.3);
    const m = Math.sin(x * 0.05 - z * 0.05 + seed * 2.1) * 2.0;
    return s + m;
  };
}

interface GameSceneProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  isGameMenuOpen: boolean;
  isResearchOpen: boolean;
  isMapOpen: boolean;
  virtualInput: {
    moveX: number;
    moveZ: number;
    lookX: number;
    lookY: number;
    jump: boolean;
    mine: boolean;
    build: boolean;
    demolish: boolean;
  };
  onVictory: () => void;
  onGameOver: () => void;
}

const CHUNK_SIZE = 12;
const MAX_CHUNKS = 9;

export default function GameScene({
  gameState,
  setGameState,
  isGameMenuOpen,
  isResearchOpen,
  isMapOpen,
  virtualInput,
  onVictory,
  onGameOver,
}: GameSceneProps) {
  const { camera } = useThree();

  // Player Drone Physical State
  const playerPos = useRef(new THREE.Vector3(0, 1.8, 0));
  const playerVel = useRef(new THREE.Vector3(0, 0, 0));
  const playerYaw = useRef(0);
  const playerPitch = useRef(0);
  const isGrounded = useRef(true);
  const armSwing = useRef(0);
  const isMiningRef = useRef(false);

  // Entities Ref State (avoid React re-render per frame)
  const structuresRef = useRef<any[]>([
    {
      id: 'nexus-core',
      type: 'SOLAR_PANEL',
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
      health: 1000,
      maxHealth: 1000,
    },
    {
      id: 'init-turret-1',
      type: 'GATLING_TURRET',
      x: 3,
      y: 0,
      z: 3,
      rotation: 0,
      health: 200,
      maxHealth: 200,
    },
    {
      id: 'init-miner-1',
      type: 'MINER',
      x: -4,
      y: 0,
      z: -4,
      rotation: 0,
      health: 200,
      maxHealth: 200,
    },
    {
      id: 'init-conv-1',
      type: 'CONVEYOR',
      x: -3,
      y: 0,
      z: -4,
      rotation: 0,
      health: 100,
      maxHealth: 100,
    },
  ]);

  const enemiesRef = useRef<any[]>([]);
  const dropsRef = useRef<any[]>([]);
  const conveyorItemsRef = useRef<any[]>([]);
  const projectilesRef = useRef<any[]>([]);
  const particlesRef = useRef<any[]>([]);

  // State sync arrays for React render passes
  const [renderedEnemies, setRenderedEnemies] = useState<EnemyEntity[]>([]);
  const [renderedDrops, setRenderedDrops] = useState<VoxelResourceDrop[]>([]);
  const [renderedProjectiles, setRenderedProjectiles] = useState<Projectile[]>([]);
  const [renderedParticles, setRenderedParticles] = useState<ParticleVoxel[]>([]);
  const [renderedStructures, setRenderedStructures] = useState<PlacedStructure[]>([
    {
      id: 'nexus-core',
      type: 'SOLAR_PANEL',
      x: 0,
      y: 0,
      z: 0,
      rotation: 0,
      health: 1000,
      maxHealth: 1000,
    },
    {
      id: 'init-turret-1',
      type: 'GATLING_TURRET',
      x: 3,
      y: 0,
      z: 3,
      rotation: 0,
      health: 200,
      maxHealth: 200,
    },
    {
      id: 'init-miner-1',
      type: 'MINER',
      x: -4,
      y: 0,
      z: -4,
      rotation: 0,
      health: 200,
      maxHealth: 200,
    },
    {
      id: 'init-conv-1',
      type: 'CONVEYOR',
      x: -3,
      y: 0,
      z: -4,
      rotation: 0,
      health: 100,
      maxHealth: 100,
    },
  ]);

  // Voxel Grid Highlight / Reticle
  const hoverGrid = useRef({ x: 0, y: 0, z: 0, valid: true });
  const [reticleState, setReticleState] = useState({ x: 0, y: 0, z: 0, visible: true });

  // Procedural Planet Colors & Voxel Theme
  const planetThemes: Record<
    PlanetId,
    {
      sky: string;
      ground: string;
      groundAccent: string;
      ore: string;
      fog: string;
      ambient: string;
    }
  > = {
    verdant: {
      sky: '#0f2942',
      ground: '#2d6a4f',
      groundAccent: '#40916c',
      ore: '#52b788',
      fog: '#1b4332',
      ambient: '#74c69d',
    },
    magma: {
      sky: '#2b0907',
      ground: '#3a0ca3',
      groundAccent: '#7209b7',
      ore: '#f72585',
      fog: '#38040e',
      ambient: '#ff4d6d',
    },
    cryo: {
      sky: '#0b1d3a',
      ground: '#1d3557',
      groundAccent: '#457b9d',
      ore: '#a8dadc',
      fog: '#0a1128',
      ambient: '#e0fbfc',
    },
  };

  const currentTheme = planetThemes[gameState.currentPlanet];
  const noise = useMemo(() => makeSimpleNoise(gameState.currentPlanet.charCodeAt(0)), [
    gameState.currentPlanet,
  ]);

  // Keys Tracking via Input fallback & Keyboard
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.code === 'Space') {
        keys.current['space'] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      if (e.key === ' ' || e.code === 'Space') {
        keys.current['space'] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sync with App state changes (Planet switch, Reset)
  useEffect(() => {
    if (gameState.status === 'START') {
      playerPos.current.set(0, 1.8, 0);
      playerVel.current.set(0, 0, 0);
      enemiesRef.current = [];
      projectilesRef.current = [];
      particlesRef.current = [];
      dropsRef.current = [];
    }
  }, [gameState.status, gameState.currentPlanet]);

  // Wave Spawner Routine
  const lastWaveCheck = useRef(0);
  const lastMinerTick = useRef(0);

  // Frame Loop
  useFrame((_, delta) => {
    if (
      gameState.status !== 'PLAYING' ||
      isGameMenuOpen ||
      isResearchOpen ||
      isMapOpen
    ) {
      return;
    }

    const dt = Math.min(delta, 0.1);
    const now = performance.now();

    // 1. DRONE MOVEMENT & PHYSICS
    const speedMult = 1 + (gameState.droneUpgrades.thrustersTier - 1) * 0.25;
    const baseSpeed = Number(getConfig('droneSpeed')) * speedMult;
    const isCreative = gameState.mode === 'CREATIVE';

    let moveX = 0;
    let moveZ = 0;

    if (keys.current['w'] || keys.current['arrowup']) moveZ -= 1;
    if (keys.current['s'] || keys.current['arrowdown']) moveZ += 1;
    if (keys.current['a'] || keys.current['arrowleft']) moveX -= 1;
    if (keys.current['d'] || keys.current['arrowright']) moveX += 1;

    // Virtual Joystick Integration
    if (Math.abs(virtualInput.moveX) > 0.1) moveX = virtualInput.moveX;
    if (Math.abs(virtualInput.moveZ) > 0.1) moveZ = virtualInput.moveZ;

    // Virtual Look / Drag Integration
    if (Math.abs(virtualInput.lookX) > 0.001) {
      playerYaw.current -= virtualInput.lookX * 2.0;
    }
    if (Math.abs(virtualInput.lookY) > 0.001) {
      playerPitch.current = Math.max(
        -1.3,
        Math.min(1.3, playerPitch.current - virtualInput.lookY * 2.0)
      );
    }

    // Direction vector aligned to Drone's Yaw
    const sinYaw = Math.sin(playerYaw.current);
    const cosYaw = Math.cos(playerYaw.current);

    const worldMoveX = moveX * cosYaw - moveZ * sinYaw;
    const worldMoveZ = moveX * sinYaw + moveZ * cosYaw;

    const len = Math.hypot(worldMoveX, worldMoveZ);
    if (len > 0.05) {
      const normX = worldMoveX / len;
      const normZ = worldMoveZ / len;
      playerPos.current.x += normX * baseSpeed * dt;
      playerPos.current.z += normZ * baseSpeed * dt;
      armSwing.current += dt * 10;
    } else {
      armSwing.current = 0;
    }

    // Jump & Hand-swing momentum traversal
    const doJump = keys.current['space'] || virtualInput.jump;
    if (doJump) {
      if (isCreative) {
        playerPos.current.y += baseSpeed * dt;
      } else if (isGrounded.current) {
        playerVel.current.y =
          Number(getConfig('droneJumpForce')) +
          (gameState.droneUpgrades.thrustersTier - 1) * 1.2;
        isGrounded.current = false;
        gameAudio.playRetroJump();
      }
    }

    if (isCreative && (keys.current['shift'] || keys.current['c'])) {
      playerPos.current.y -= baseSpeed * dt;
    }

    // Ground Height & Step-climb
    const groundHeight =
      noise(playerPos.current.x, playerPos.current.z) * 0.8;

    if (!isCreative) {
      // Gravity
      playerVel.current.y -= 18 * dt;
      playerPos.current.y += playerVel.current.y * dt;

      if (playerPos.current.y <= groundHeight + 1.6) {
        playerPos.current.y = groundHeight + 1.6;
        playerVel.current.y = 0;
        isGrounded.current = true;
      }
    } else {
      if (playerPos.current.y < groundHeight + 1.5) {
        playerPos.current.y = groundHeight + 1.5;
      }
    }

    // 2. CAMERA POSITIONING & PERSPECTIVES
    if (gameState.perspective === 'FIRST_PERSON') {
      camera.position.set(
        playerPos.current.x,
        playerPos.current.y,
        playerPos.current.z
      );
      // Euler rotation (Yaw & Pitch)
      const euler = new THREE.Euler(
        playerPitch.current,
        playerYaw.current,
        0,
        'YXZ'
      );
      camera.quaternion.setFromEuler(euler);
    } else {
      // Table-top God view over the Drone
      const tableHeight = 22;
      const tableDist = 16;
      camera.position.set(
        playerPos.current.x,
        playerPos.current.y + tableHeight,
        playerPos.current.z + tableDist
      );
      camera.lookAt(
        playerPos.current.x,
        playerPos.current.y + 0.5,
        playerPos.current.z
      );
    }

    // 3. RETICLE & GRID CALCULATION (In front of Drone)
    const forwardX = -Math.sin(playerYaw.current) * Math.cos(playerPitch.current);
    const forwardY = Math.sin(playerPitch.current);
    const forwardZ = -Math.cos(playerYaw.current) * Math.cos(playerPitch.current);

    const reachDist = 4.5 + (gameState.droneUpgrades.miningTier - 1) * 0.8;
    const targetX = Math.round(playerPos.current.x + forwardX * reachDist);
    const targetZ = Math.round(playerPos.current.z + forwardZ * reachDist);
    const targetY = Math.round(groundHeight);

    hoverGrid.current = { x: targetX, y: targetY, z: targetZ, valid: true };

    // 4. PLAYER MINING & INTERACTION
    const isMining = keys.current['e'] || keys.current['f'] || virtualInput.mine;
    if (isMining && !isMiningRef.current) {
      isMiningRef.current = true;
      gameAudio.playArcadeLaser();

      // Spawn mining beam visual & drop ore
      projectilesRef.current.push({
        id: `mine-${now}`,
        fromX: playerPos.current.x + 0.3 * cosYaw,
        fromY: playerPos.current.y - 0.3,
        fromZ: playerPos.current.z + 0.3 * sinYaw,
        toX: targetX,
        toY: targetY + 0.5,
        toZ: targetZ,
        type: 'LASER',
        life: 0.18,
      });

      // Spawn Ore Droplet
      const oreTypes: ('IRON' | 'COPPER' | 'CRYSTAL')[] = [
        'IRON',
        'COPPER',
        'CRYSTAL',
      ];
      const selectedOre =
        oreTypes[Math.floor(Math.random() * oreTypes.length)];

      dropsRef.current.push({
        id: `drop-${now}`,
        type: selectedOre,
        x: targetX,
        y: targetY + 0.8,
        z: targetZ,
        vx: (Math.random() - 0.5) * 2,
        vy: 3 + Math.random() * 2,
        vz: (Math.random() - 0.5) * 2,
      });

      // Spawn Dust Particles
      for (let p = 0; p < 6; p++) {
        particlesRef.current.push({
          x: targetX + (Math.random() - 0.5) * 0.5,
          y: targetY + 0.5,
          z: targetZ + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 3,
          vy: 2 + Math.random() * 2,
          vz: (Math.random() - 0.5) * 3,
          color: currentTheme.ore,
          life: 0.4,
          size: 0.15,
        });
      }
    } else if (!isMining) {
      isMiningRef.current = false;
    }

    // 5. PLAYER BUILDING ON 3D GRID
    const isBuilding =
      keys.current['b'] || keys.current['q'] || virtualInput.build;
    if (isBuilding) {
      // Check collision with existing structures
      const exists = structuresRef.current.some(
        (s) => s.x === targetX && s.z === targetZ
      );
      if (!exists) {
        const buildType = gameState.selectedHotbar;
        const costs: Record<
          StructureType,
          { iron: number; copper: number; crystal: number; energy: number }
        > = {
          CONVEYOR: { iron: 5, copper: 2, crystal: 0, energy: 0 },
          MINER: { iron: 25, copper: 15, crystal: 5, energy: 10 },
          GATLING_TURRET: { iron: 35, copper: 20, crystal: 0, energy: 15 },
          PLASMA_TURRET: { iron: 50, copper: 30, crystal: 20, energy: 25 },
          TESLA_COIL: { iron: 40, copper: 35, crystal: 15, energy: 30 },
          SOLAR_PANEL: { iron: 20, copper: 20, crystal: 10, energy: -25 },
          WALL: { iron: 10, copper: 0, crystal: 0, energy: 0 },
        };

        const cost = costs[buildType];
        const canAfford =
          gameState.mode === 'CREATIVE' ||
          (gameState.resources.iron >= cost.iron &&
            gameState.resources.copper >= cost.copper &&
            gameState.resources.crystal >= cost.crystal &&
            gameState.resources.energy >= cost.energy);

        if (canAfford) {
          structuresRef.current.push({
            id: `struct-${now}`,
            type: buildType,
            x: targetX,
            y: targetY,
            z: targetZ,
            rotation: playerYaw.current,
            health: 200,
            maxHealth: 200,
            lastFireTime: 0,
            inventoryCount: 0,
          });

          gameAudio.playConfirmSelect();

          if (gameState.mode !== 'CREATIVE') {
            setGameState((prev) => ({
              ...prev,
              resources: {
                ...prev.resources,
                iron: prev.resources.iron - cost.iron,
                copper: prev.resources.copper - cost.copper,
                crystal: prev.resources.crystal - cost.crystal,
                energy: prev.resources.energy - cost.energy,
              },
            }));
          }

          // Build Sparks
          for (let p = 0; p < 8; p++) {
            particlesRef.current.push({
              x: targetX,
              y: targetY + 0.5,
              z: targetZ,
              vx: (Math.random() - 0.5) * 4,
              vy: 3 + Math.random() * 2,
              vz: (Math.random() - 0.5) * 4,
              color: '#38bdf8',
              life: 0.5,
              size: 0.12,
            });
          }
        } else {
          gameAudio.playErrorBuzz();
        }
      }
    }

    // 6. DEMOLISH / RECYCLE
    const isDemolish = keys.current['x'] || virtualInput.demolish;
    if (isDemolish) {
      const targetIndex = structuresRef.current.findIndex(
        (s) => s.x === targetX && s.z === targetZ && s.id !== 'nexus-core'
      );
      if (targetIndex !== -1) {
        structuresRef.current.splice(targetIndex, 1);
        gameAudio.playChiptuneExplosion();
      }
    }

    // 7. FACTORY CONVEYORS & MINER LOGISTICS TICK
    if (now - lastMinerTick.current > 1500) {
      lastMinerTick.current = now;

      // Miners generate ore items
      structuresRef.current.forEach((st: any) => {
        if (st.type === 'MINER') {
          // Find adjacent conveyor
          const adjConveyor = structuresRef.current.find(
            (c: any) =>
              c.type === 'CONVEYOR' &&
              Math.hypot(c.x - st.x, c.z - st.z) <= 1.5
          );
          if (adjConveyor) {
            conveyorItemsRef.current.push({
              id: `item-${now}-${Math.random()}`,
              structureId: adjConveyor.id,
              progress: 0,
              type: 'IRON',
            });
          } else {
            // Direct deposit
            setGameState((prev) => ({
              ...prev,
              resources: {
                ...prev.resources,
                iron: prev.resources.iron + 2,
                energy: Math.min(200, prev.resources.energy + 1),
              },
            }));
          }
        } else if (st.type === 'SOLAR_PANEL') {
          setGameState((prev) => ({
            ...prev,
            resources: {
              ...prev.resources,
              energy: Math.min(500, prev.resources.energy + 3),
            },
          }));
        }
      });
    }

    // Move Conveyor Items along belts
    conveyorItemsRef.current.forEach((item: any, index: number) => {
      item.progress += dt * 0.8;
      if (item.progress >= 1.0) {
        const currBelt = structuresRef.current.find((s: any) => s.id === item.structureId);
        if (currBelt) {
          // Pass to next belt or feed turret / base
          const nextBelt = structuresRef.current.find(
            (s: any) =>
              s.id !== currBelt.id &&
              (s.type === 'CONVEYOR' || s.type.includes('TURRET')) &&
              Math.hypot(s.x - currBelt.x, s.z - currBelt.z) <= 1.4
          );
          if (nextBelt) {
            if (nextBelt.type === 'CONVEYOR') {
              item.structureId = nextBelt.id;
              item.progress = 0;
            } else {
              // Fed ammo to turret
              nextBelt.inventoryCount = (nextBelt.inventoryCount || 0) + 5;
              conveyorItemsRef.current.splice(index, 1);
            }
          } else {
            // Reached destination, deposit into player cargo
            setGameState((prev) => ({
              ...prev,
              resources: {
                ...prev.resources,
                iron: prev.resources.iron + 1,
                copper: prev.resources.copper + 1,
              },
            }));
            conveyorItemsRef.current.splice(index, 1);
          }
        }
      }
    });

    // 8. DEFENSE TURRETS AUTO-TARGETING & FIRING
    structuresRef.current.forEach((turret: any) => {
      if (!turret.type.includes('TURRET') && turret.type !== 'TESLA_COIL') return;

      const range = turret.type === 'PLASMA_TURRET' ? 14 : 9;
      const fireCooldown = turret.type === 'GATLING_TURRET' ? 250 : 800;

      if (!turret.lastFireTime) turret.lastFireTime = 0;

      if (now - turret.lastFireTime >= fireCooldown) {
        // Find closest enemy
        let closestDist = range;
        let targetEnemy: any = null;

        enemiesRef.current.forEach((enemy: any) => {
          const d = Math.hypot(enemy.x - turret.x, enemy.z - turret.z);
          if (d < closestDist) {
            closestDist = d;
            targetEnemy = enemy;
          }
        });

        if (targetEnemy) {
          turret.lastFireTime = now;
          targetEnemy.hp -= turret.type === 'PLASMA_TURRET' ? 45 : 18;

          if (turret.type === 'GATLING_TURRET') {
            gameAudio.playGunshotBlast();
            projectilesRef.current.push({
              id: `proj-${now}`,
              fromX: turret.x,
              fromY: turret.y + 0.8,
              fromZ: turret.z,
              toX: targetEnemy.x,
              toY: targetEnemy.y + 0.5,
              toZ: targetEnemy.z,
              type: 'BULLET',
              life: 0.12,
            });
          } else if (turret.type === 'PLASMA_TURRET') {
            gameAudio.playArcadeLaser();
            projectilesRef.current.push({
              id: `proj-${now}`,
              fromX: turret.x,
              fromY: turret.y + 1.2,
              fromZ: turret.z,
              toX: targetEnemy.x,
              toY: targetEnemy.y + 0.5,
              toZ: targetEnemy.z,
              type: 'PLASMA',
              life: 0.25,
            });
          } else {
            // Tesla Zap
            gameAudio.playArcadeLaser();
            projectilesRef.current.push({
              id: `proj-${now}`,
              fromX: turret.x,
              fromY: turret.y + 1.5,
              fromZ: turret.z,
              toX: targetEnemy.x,
              toY: targetEnemy.y + 0.5,
              toZ: targetEnemy.z,
              type: 'TESLA_ZAP',
              life: 0.15,
            });
          }
        }
      }
    });

    // 9. ENEMY WAVE AI & COMBAT
    if (gameState.mode === 'SURVIVAL') {
      // Spawn wave if timer expires
      if (now - lastWaveCheck.current > 1000) {
        lastWaveCheck.current = now;
        setGameState((prev) => {
          const nextTimer = prev.waveTimer - 1;
          if (nextTimer <= 0) {
            // Spawn Wave
            const waveNum = prev.wave + 1;
            const enemyCount = 4 + waveNum * 3;
            for (let i = 0; i < enemyCount; i++) {
              const angle = Math.random() * Math.PI * 2;
              const spawnDist = 28 + Math.random() * 8;
              const type =
                waveNum >= 3 && i % 3 === 0
                  ? 'WYVERN'
                  : waveNum >= 2 && i % 2 === 0
                  ? 'GOLEM'
                  : 'SWARMER';

              enemiesRef.current.push({
                id: `enemy-${now}-${i}`,
                type,
                x: Math.cos(angle) * spawnDist,
                y: type === 'WYVERN' ? 4.5 : groundHeight,
                z: Math.sin(angle) * spawnDist,
                hp: type === 'GOLEM' ? 120 : type === 'WYVERN' ? 60 : 35,
                maxHp: type === 'GOLEM' ? 120 : type === 'WYVERN' ? 60 : 35,
                speed: type === 'SWARMER' ? 3.5 : type === 'WYVERN' ? 4.2 : 2.0,
                damage: type === 'GOLEM' ? 25 : 10,
                targetType: 'NEXUS',
              });
            }
            return {
              ...prev,
              wave: waveNum,
              waveTimer: Number(getConfig('waveInterval')),
              waveActive: true,
            };
          }
          return { ...prev, waveTimer: nextTimer };
        });
      }

      // Update Enemies Movement & Target Nexus/Drone
      enemiesRef.current.forEach((enemy: any, idx: number) => {
        // Check health
        if (enemy.hp <= 0) {
          gameAudio.playChiptuneExplosion();
          // Drop rare Planet Core fragment or Crystal
          dropsRef.current.push({
            id: `drop-${now}-${idx}`,
            type: enemy.type === 'GOLEM' ? 'PLANET_CORE' : 'CRYSTAL',
            x: enemy.x,
            y: enemy.y + 0.5,
            z: enemy.z,
            vx: (Math.random() - 0.5) * 2,
            vy: 2.5,
            vz: (Math.random() - 0.5) * 2,
          });

          // Explosion Shards
          for (let p = 0; p < 8; p++) {
            particlesRef.current.push({
              x: enemy.x,
              y: enemy.y + 0.5,
              z: enemy.z,
              vx: (Math.random() - 0.5) * 4,
              vy: Math.random() * 4,
              vz: (Math.random() - 0.5) * 4,
              color: '#ef4444',
              life: 0.45,
              size: 0.16,
            });
          }

          enemiesRef.current.splice(idx, 1);
          setGameState((prev) => ({
            ...prev,
            score: prev.score + (enemy.type === 'GOLEM' ? 250 : 100),
          }));
          return;
        }

        // Navigate towards Nexus (0,0,0) or Player Drone
        const distToPlayer = Math.hypot(
          enemy.x - playerPos.current.x,
          enemy.z - playerPos.current.z
        );
        let targetX = 0;
        let targetZ = 0;

        if (distToPlayer < 6) {
          targetX = playerPos.current.x;
          targetZ = playerPos.current.z;
        }

        const angle = Math.atan2(targetZ - enemy.z, targetX - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.z += Math.sin(angle) * enemy.speed * dt;

        // Attack Nexus
        const distToNexus = Math.hypot(enemy.x, enemy.z);
        if (distToNexus < 2.0) {
          setGameState((prev) => {
            const nextNexusHp = Math.max(0, prev.nexusHp - enemy.damage * dt * 2);
            if (nextNexusHp <= 0) {
              onGameOver();
            }
            return { ...prev, nexusHp: nextNexusHp };
          });
        }

        // Attack Player Drone
        if (distToPlayer < 1.6) {
          setGameState((prev) => {
            const shieldFactor =
              1 - (prev.droneUpgrades.shieldTier - 1) * 0.15;
            const nextHp = Math.max(
              0,
              prev.droneHp - enemy.damage * dt * shieldFactor
            );
            if (nextHp <= 0) {
              onGameOver();
            }
            return { ...prev, droneHp: nextHp };
          });
        }
      });
    }

    // 10. DROP PICKUPS & INERTIA
    dropsRef.current.forEach((drop: any, dIdx: number) => {
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.z += drop.vz * dt;
      drop.vy -= 9.8 * dt;

      const ground = noise(drop.x, drop.z) * 0.8;
      if (drop.y <= ground + 0.2) {
        drop.y = ground + 0.2;
        drop.vx *= 0.8;
        drop.vz *= 0.8;
      }

      // Magnet to Player Drone
      const dDist = Math.hypot(
        drop.x - playerPos.current.x,
        drop.z - playerPos.current.z
      );
      if (dDist < 3.2) {
        const pullAngle = Math.atan2(
          playerPos.current.z - drop.z,
          playerPos.current.x - drop.x
        );
        drop.x += Math.cos(pullAngle) * 7.0 * dt;
        drop.z += Math.sin(pullAngle) * 7.0 * dt;

        if (dDist < 0.8) {
          gameAudio.playCoinPickup();
          setGameState((prev) => {
            const res = { ...prev.resources };
            if (drop.type === 'IRON') res.iron += 3;
            else if (drop.type === 'COPPER') res.copper += 2;
            else if (drop.type === 'CRYSTAL') res.crystal += 1;
            else if (drop.type === 'PLANET_CORE') {
              res.crystal += 5;
              res.energy += 20;
            }
            return { ...prev, resources: res, score: prev.score + 25 };
          });
          dropsRef.current.splice(dIdx, 1);
        }
      }
    });

    // 11. PROJECTILES & PARTICLES LIFECYCLE
    projectilesRef.current.forEach((proj: any, pIdx: number) => {
      proj.life -= dt;
      if (proj.life <= 0) {
        projectilesRef.current.splice(pIdx, 1);
      }
    });

    particlesRef.current.forEach((part: any, partIdx: number) => {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.z += part.vz * dt;
      part.vy -= 8.0 * dt;
      part.life -= dt;
      if (part.life <= 0) {
        particlesRef.current.splice(partIdx, 1);
      }
    });
  });

  return (
    <>
      {/* Dynamic Hemisphere & Atmospheric Sunlight */}
      <hemisphereLight
        skyColor={currentTheme.sky}
        groundColor={currentTheme.ground}
        intensity={Number(getConfig('hemiIntensity'))}
      />
      <directionalLight
        position={[18, 30, 18]}
        intensity={Number(getConfig('sunIntensity'))}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <fog attach="fog" args={[currentTheme.fog, 20, 75]} />

      {/* INFINITE VOXEL CHUNK STREAMING */}
      <VoxelChunks
        playerX={playerPos.current.x}
        playerZ={playerPos.current.z}
        theme={currentTheme}
        noise={noise}
      />

      {/* COMMAND BASE NEXUS AT WORLD CENTER */}
      <NexusCore
        hp={gameState.nexusHp}
        maxHp={gameState.maxNexusHp}
        planet={gameState.currentPlanet}
      />

      {/* PLACED FACTORY MACHINES & TURRETS */}
      {structuresRef.current.map((st: any) => (
        <FactoryStructureMesh key={st.id} structure={st} theme={currentTheme} />
      ))}

      {/* CONVEYOR ITEMS */}
      {conveyorItemsRef.current.map((item: any) => {
        const st = structuresRef.current.find((s: any) => s.id === item.structureId);
        if (!st) return null;
        return (
          <mesh
            key={item.id}
            position={[
              st.x + (item.progress - 0.5) * 0.8,
              st.y + 0.35,
              st.z,
            ]}>
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial
              color={
                item.type === 'IRON'
                  ? '#94a3b8'
                  : item.type === 'COPPER'
                  ? '#f97316'
                  : '#38bdf8'
              }
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      {/* HOSTILE DEFENSE ENEMIES */}
      {enemiesRef.current.map((enemy: any) => (
        <EnemyMesh key={enemy.id} enemy={enemy} />
      ))}

      {/* ORE PICKUP DROPS */}
      {dropsRef.current.map((drop: any) => (
        <mesh
          key={drop.id}
          position={[drop.x, drop.y, drop.z]}
          rotation={[drop.y * 2, drop.x * 2, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial
            color={
              drop.type === 'IRON'
                ? '#cbd5e1'
                : drop.type === 'COPPER'
                ? '#fb923c'
                : drop.type === 'CRYSTAL'
                ? '#38bdf8'
                : '#ec4899'
            }
            emissive={
              drop.type === 'CRYSTAL' || drop.type === 'PLANET_CORE'
                ? '#38bdf8'
                : '#000000'
            }
            emissiveIntensity={0.6}
            metalness={0.8}
          />
        </mesh>
      ))}

      {/* PROJECTILE BEAMS & LASERS */}
      {projectilesRef.current.map((proj: any) => (
        <line key={proj.id}>
          <bufferGeometry
            attach="geometry"
            onUpdate={(self: any) => {
              const pts = new Float32Array([
                proj.fromX,
                proj.fromY,
                proj.fromZ,
                proj.toX,
                proj.toY,
                proj.toZ,
              ]);
              self.setAttribute('position', new THREE.BufferAttribute(pts, 3));
            }}
          />
          <lineBasicMaterial
            attach="material"
            color={
              proj.type === 'PLASMA'
                ? '#ec4899'
                : proj.type === 'LASER'
                ? '#38bdf8'
                : proj.type === 'TESLA_ZAP'
                ? '#a855f7'
                : '#facc15'
            }
            linewidth={3}
          />
        </line>
      ))}

      {/* PARTICLE SHARDS */}
      {particlesRef.current.map((p: any, i: number) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <boxGeometry args={[p.size, p.size, p.size]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}

      {/* 3D RETICLE GHOST AT HOVER GRID */}
      <mesh
        position={[
          hoverGrid.current.x,
          hoverGrid.current.y + 0.05,
          hoverGrid.current.z,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={
            hoverGrid.current.valid
              ? '#22c55e'
              : '#ef4444'
          }
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* FIRST-PERSON DRONE HUD VISUALS (Hands / Cockpit Blasters) */}
      {gameState.perspective === 'FIRST_PERSON' && (
        <DroneFirstPersonHands
          playerPos={playerPos.current}
          yaw={playerYaw.current}
          pitch={playerPitch.current}
          armSwing={armSwing.current}
          upgrades={gameState.droneUpgrades}
        />
      )}

      {/* TABLETOP OVERVIEW DRONE AVATAR */}
      {gameState.perspective === 'TABLETOP' && (
        <group
          position={[
            playerPos.current.x,
            playerPos.current.y,
            playerPos.current.z,
          ]}
          rotation={[0, playerYaw.current, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.8, 0.5, 1.0]} />
            <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.25, 8, 8]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      )}
    </>
  );
}

// ==========================================
// VOXEL CHUNKS COMPONENT (INFINITE STREAMING)
// ==========================================
function VoxelChunks(props: any) {
  const { playerX, playerZ, theme, noise } = props;
  const currentChunkX = Math.floor((playerX || 0) / CHUNK_SIZE);
  const currentChunkZ = Math.floor((playerZ || 0) / CHUNK_SIZE);

  const chunks = useMemo(() => {
    const list: { cx: number; cz: number; key: string }[] = [];
    const rad = Number(getConfig('chunkRadius'));
    for (let x = -rad; x <= rad; x++) {
      for (let z = -rad; z <= rad; z++) {
        const cx = currentChunkX + x;
        const cz = currentChunkZ + z;
        list.push({ cx, cz, key: `${cx},${cz}` });
      }
    }
    return list;
  }, [currentChunkX, currentChunkZ]);

  return (
    <group>
      {chunks.map(({ cx, cz, key }) => (
        <ChunkMesh
          key={key}
          cx={cx}
          cz={cz}
          theme={theme}
          noise={noise}
        />
      ))}
    </group>
  );
}

function ChunkMesh(props: any) {
  const { cx, cz, theme, noise } = props;
  const meshData = useMemo(() => {
    const voxels: {
      x: number;
      y: number;
      z: number;
      type: 'ground' | 'accent' | 'ore';
    }[] = [];
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x += 2) {
      for (let z = 0; z < CHUNK_SIZE; z += 2) {
        const wx = startX + x;
        const wz = startZ + z;
        const h = Math.round(noise(wx, wz) * 0.8);

        const hasOre = (wx * 17 + wz * 31) % 9 === 0;
        const hasAccent = (wx * 11 + wz * 13) % 4 === 0;

        voxels.push({
          x: wx,
          y: h,
          z: wz,
          type: hasOre ? 'ore' : hasAccent ? 'accent' : 'ground',
        });
      }
    }
    return voxels;
  }, [cx, cz, noise]);

  return (
    <group>
      {meshData.map((v, i) => (
        <mesh key={i} position={[v.x, v.y, v.z]} receiveShadow>
          <boxGeometry args={[1.9, 1.2, 1.9]} />
          <meshStandardMaterial
            color={
              v.type === 'ore'
                ? theme.ore
                : v.type === 'accent'
                ? theme.groundAccent
                : theme.ground
            }
            emissive={v.type === 'ore' ? theme.ore : '#000000'}
            emissiveIntensity={v.type === 'ore' ? 0.4 : 0}
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

// ==========================================
// NEXUS CORE (COMMAND BASE)
// ==========================================
function NexusCore(props: any) {
  const { hp, maxHp } = props;
  const hpPercent = Math.max(0, (hp || 0) / (maxHp || 1));
  return (
    <group position={[0, 0, 0]}>
      {/* Base Platform */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[2.5, 2.8, 0.4, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Energy Core Orb */}
      <mesh position={[0, 1.8, 0]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial
          color={hpPercent > 0.3 ? '#38bdf8' : '#ef4444'}
          emissive={hpPercent > 0.3 ? '#0284c7' : '#b91c1c'}
          emissiveIntensity={1.2}
          wireframe
        />
      </mesh>
      {/* Floating Rotating Rings */}
      <mesh position={[0, 1.8, 0]} rotation={[0.4, 0, 0.4]}>
        <torusGeometry args={[1.5, 0.08, 8, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ==========================================
// FACTORY STRUCTURES PROCEDURAL RENDERER
// ==========================================
function FactoryStructureMesh(props: any) {
  const structure = props.structure || {};
  const { type, x, y, z, rotation } = structure;

  if (type === 'CONVEYOR') {
    return (
      <group position={[x || 0, (y || 0) + 0.1, z || 0]} rotation={[0, rotation || 0, 0]}>
        {/* Belt Base */}
        <mesh receiveShadow>
          <boxGeometry args={[0.9, 0.2, 0.9]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Moving Yellow Arrow Strip */}
        <mesh position={[0, 0.11, 0]}>
          <planeGeometry args={[0.3, 0.6]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
      </group>
    );
  }

  if (type === 'MINER') {
    return (
      <group position={[x || 0, (y || 0) + 0.5, z || 0]} rotation={[0, rotation || 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.4, 0.5, 0.8, 6]} />
          <meshStandardMaterial color="#0f766e" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Drill Head */}
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.3, 0.5, 6]} />
          <meshStandardMaterial color="#14b8a6" metalness={0.9} />
        </mesh>
      </group>
    );
  }

  if (type === 'GATLING_TURRET') {
    return (
      <group position={[x || 0, (y || 0) + 0.5, z || 0]}>
        {/* Stand */}
        <mesh castShadow>
          <cylinderGeometry args={[0.3, 0.45, 0.6, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        {/* Gun Mount */}
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.35, 0.35, 0.5]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        {/* Dual Barrels */}
        <mesh position={[0.1, 0.45, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[-0.1, 0.45, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
      </group>
    );
  }

  if (type === 'PLASMA_TURRET') {
    return (
      <group position={[x || 0, (y || 0) + 0.6, z || 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.35, 0.5, 0.8, 8]} />
          <meshStandardMaterial color="#701a75" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial
            color="#ec4899"
            emissive="#ec4899"
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>
    );
  }

  if (type === 'TESLA_COIL') {
    return (
      <group position={[x || 0, (y || 0) + 0.7, z || 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.15, 0.3, 1.2, 8]} />
          <meshStandardMaterial color="#312e81" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <torusGeometry args={[0.3, 0.08, 8, 16]} />
          <meshStandardMaterial
            color="#818cf8"
            emissive="#6366f1"
            emissiveIntensity={1.0}
          />
        </mesh>
      </group>
    );
  }

  if (type === 'SOLAR_PANEL') {
    return (
      <group position={[x || 0, (y || 0) + 0.3, z || 0]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.3, 6]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.9, 0.05, 0.9]} />
          <meshStandardMaterial
            color="#1d4ed8"
            metalness={0.8}
            roughness={0.1}
          />
        </mesh>
      </group>
    );
  }

  // WALL
  return (
    <mesh position={[x || 0, (y || 0) + 0.5, z || 0]} castShadow receiveShadow>
      <boxGeometry args={[0.95, 1.0, 0.95]} />
      <meshStandardMaterial color="#475569" roughness={0.8} />
    </mesh>
  );
}

// ==========================================
// HOSTILE ENEMY MESH
// ==========================================
function EnemyMesh(props: any) {
  const enemy = (props && props.enemy) ? props.enemy : {};
  const hp = typeof enemy.hp === 'number' ? enemy.hp : 100;
  const maxHp = typeof enemy.maxHp === 'number' ? enemy.maxHp : 100;
  const hpPct = Math.max(0, hp / maxHp);
  const ex = typeof enemy.x === 'number' ? enemy.x : 0;
  const ey = typeof enemy.y === 'number' ? enemy.y : 0;
  const ez = typeof enemy.z === 'number' ? enemy.z : 0;

  return (
    <group position={[ex, ey, ez]}>
      {enemy.type === 'SWARMER' && (
        <mesh castShadow>
          <coneGeometry args={[0.35, 0.7, 4]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {enemy.type === 'GOLEM' && (
        <group>
          <mesh castShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[0.9, 0.9, 0.9]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.9, -0.3]}>
            <sphereGeometry args={[0.2, 6, 6]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </group>
      )}

      {enemy.type === 'WYVERN' && (
        <group>
          <mesh castShadow>
            <octahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial
              color="#9333ea"
              emissive="#a855f7"
              emissiveIntensity={0.8}
            />
          </mesh>
          {/* Wings */}
          <mesh position={[0.6, 0, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.8, 0.05, 0.4]} />
            <meshStandardMaterial color="#581c87" />
          </mesh>
          <mesh position={[-0.6, 0, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.8, 0.05, 0.4]} />
            <meshStandardMaterial color="#581c87" />
          </mesh>
        </group>
      )}

      {/* Floating Tiny HP bar */}
      <mesh position={[0, 1.2, 0]}>
        <planeGeometry args={[0.6 * hpPct, 0.08]} />
        <meshBasicMaterial color={hpPct > 0.4 ? '#22c55e' : '#ef4444'} />
      </mesh>
    </group>
  );
}

// ==========================================
// FIRST-PERSON DRONE HANDS / COCKPIT VIEW
// ==========================================
function DroneFirstPersonHands(props: any) {
  const { playerPos, yaw, pitch, armSwing, upgrades } = props;
  const swingOffset = Math.sin(armSwing || 0) * 0.05;
  const px = playerPos?.x || 0;
  const py = playerPos?.y || 0;
  const pz = playerPos?.z || 0;
  const u = upgrades || {};

  return (
    <group
      position={[px, py, pz]}
      rotation={[pitch || 0, yaw || 0, 0]}>
      {/* Right Drone Multi-tool Emitter Hand */}
      <group position={[0.35, -0.28 + swingOffset, -0.6]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.12, 0.4]} />
          <meshStandardMaterial
            color={u.miningTier >= 3 ? '#0284c7' : '#475569'}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        {/* Laser Tip Ring */}
        <mesh position={[0, 0, -0.22]}>
          <torusGeometry args={[0.06, 0.02, 6, 12]} />
          <meshBasicMaterial
            color={u.miningTier >= 5 ? '#ec4899' : '#38bdf8'}
          />
        </mesh>
      </group>

      {/* Left Drone Arm / Grav-Grabber */}
      <group position={[-0.35, -0.28 - swingOffset, -0.6]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.12, 0.4]} />
          <meshStandardMaterial
            color={u.chassisTier >= 3 ? '#0369a1' : '#334155'}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0, -0.22]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>
    </group>
  );
}
