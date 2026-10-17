import { GamePhase, MusicTrack } from './utils/helper';

export type GameMode = 'SURVIVAL' | 'CREATIVE';
export type ViewPerspective = 'FIRST_PERSON' | 'TABLETOP';
export type PlanetId = 'verdant' | 'magma' | 'cryo';

export interface PlanetInfo {
  id: PlanetId;
  name: string;
  themeColor: string;
  groundColor: string;
  skyColor: string;
  mineralName: string;
  sectorsCount: number;
  description: string;
}

export interface DroneUpgrades {
  chassisTier: number; // 1-5 (Max 5)
  miningTier: number;  // 1-5 (Max 5)
  thrustersTier: number; // 1-5 (Max 5)
  shieldTier: number;  // 1-5 (Max 5)
}

export type StructureType =
  | 'MINER'
  | 'CONVEYOR'
  | 'GATLING_TURRET'
  | 'PLASMA_TURRET'
  | 'TESLA_COIL'
  | 'SOLAR_PANEL'
  | 'WALL';

export interface PlacedStructure {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  z: number;
  rotation: number; // 0, Math.PI/2, Math.PI, -Math.PI/2
  health: number;
  maxHealth: number;
  targetEnemyId?: string | null;
  lastFireTime?: number;
  inventoryCount?: number;
}

export interface EnemyEntity {
  id: string;
  type: 'SWARMER' | 'GOLEM' | 'WYVERN';
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  targetType: 'NEXUS' | 'DRONE' | 'STRUCTURE';
}

export interface VoxelResourceDrop {
  id: string;
  type: 'IRON' | 'COPPER' | 'CRYSTAL' | 'PLANET_CORE';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface ConveyorItem {
  id: string;
  structureId: string;
  progress: number; // 0 to 1 along conveyor
  type: 'IRON' | 'COPPER' | 'CRYSTAL';
}

export interface ResearchNode {
  id: string;
  title: string;
  description: string;
  cost: { iron: number; copper: number; crystal: number; energy: number };
  unlocked: boolean;
  category: 'AUTOMATION' | 'TURRETS' | 'DRONE' | 'PLANETARY';
  planetLock?: PlanetId;
}

export interface Projectile {
  id: string;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  type: 'BULLET' | 'PLASMA' | 'TESLA_ZAP' | 'LASER';
  life: number; // in seconds
}

export interface ParticleVoxel {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number;
  size: number;
}

export interface GameState {
  status: GamePhase;
  mode: GameMode;
  score: number;
  level: number;
  currentPlanet: PlanetId;
  sectorsConquered: Record<PlanetId, number>; // e.g. { verdant: 3, magma: 2, cryo: 1 } (Max 3 each)
  resources: {
    iron: number;
    copper: number;
    crystal: number;
    energy: number;
  };
  nexusHp: number;
  maxNexusHp: number;
  droneHp: number;
  maxDroneHp: number;
  droneUpgrades: DroneUpgrades;
  wave: number;
  waveTimer: number;
  waveActive: boolean;
  totalResearchCount: number;
  unlockedResearchCount: number;
  perspective: ViewPerspective;
  selectedHotbar: StructureType;
  [key: string]: any;
}
