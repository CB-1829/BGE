import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Zap,
  Activity,
  Trophy,
  Play,
  RotateCw,
  Home,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import GameScene from './Game';
import {
  GameState,
  GameMode,
  ViewPerspective,
  PlanetId,
  StructureType,
  ResearchNode,
} from './types';
import { getConfig } from './constants';
import {
  gameAudio,
  MenuOverlay,
  useIsMobile,
  useAutoFocus,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
} from './utils/usePlayground';
import BackgroundMusic from './utils/BackgroundMusic';

const INITIAL_RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'res-auto-drill',
    title: 'Automated Rotary Drills',
    description: 'Enables high-efficiency automatic ore extraction miners.',
    cost: { iron: 40, copper: 20, crystal: 0, energy: 15 },
    unlocked: true,
    category: 'AUTOMATION',
  },
  {
    id: 'res-hyper-conveyor',
    title: 'Mag-Lev Conveyors',
    description: 'Increases factory conveyor belt speed by 100%.',
    cost: { iron: 60, copper: 40, crystal: 10, energy: 20 },
    unlocked: false,
    category: 'AUTOMATION',
  },
  {
    id: 'res-plasma-turret',
    title: 'Plasma Blast Cannon',
    description: 'Unlocks heavy long-range anti-armor plasma turrets.',
    cost: { iron: 80, copper: 50, crystal: 30, energy: 40 },
    unlocked: false,
    category: 'TURRETS',
  },
  {
    id: 'res-tesla-coil',
    title: 'Chain-Lightning Tesla',
    description: 'Unlocks multi-target high-voltage area defense coils.',
    cost: { iron: 100, copper: 70, crystal: 45, energy: 60 },
    unlocked: false,
    category: 'TURRETS',
  },
  {
    id: 'res-drone-chassis',
    title: 'Reinforced Nanite Chassis',
    description: 'Upgrades Drone Max HP and structural defense.',
    cost: { iron: 70, copper: 40, crystal: 25, energy: 30 },
    unlocked: false,
    category: 'DRONE',
  },
  {
    id: 'res-drone-laser',
    title: 'Sub-Atomic Mining Laser',
    description: 'Expands mining reach and instantly vaporizes rich ores.',
    cost: { iron: 90, copper: 60, crystal: 35, energy: 45 },
    unlocked: false,
    category: 'DRONE',
  },
  {
    id: 'res-drone-boosters',
    title: 'Quantum Jump Thrusters',
    description: 'Unlocks hyper-velocity flight boosters and jump height.',
    cost: { iron: 110, copper: 80, crystal: 50, energy: 60 },
    unlocked: false,
    category: 'DRONE',
  },
  {
    id: 'res-planetary-warp',
    title: 'Omega Planetary Gateway',
    description: 'Synchronizes inter-planetary portals across all 3 realms.',
    cost: { iron: 200, copper: 150, crystal: 100, energy: 120 },
    unlocked: false,
    category: 'PLANETARY',
  },
];

const PLANETS_CONFIG: {
  id: PlanetId;
  name: string;
  themeColor: string;
  desc: string;
}[] = [
  {
    id: 'verdant',
    name: 'Verdant Prime',
    themeColor: '#10b981',
    desc: 'Lush biomass crust rich in iron and copper deposits.',
  },
  {
    id: 'magma',
    name: 'Magma Forge',
    themeColor: '#f97316',
    desc: 'Volcanic core realm brimming with high-density plasma ores.',
  },
  {
    id: 'cryo',
    name: 'Cryo Matrix',
    themeColor: '#06b6d4',
    desc: 'Glacial tundra harboring ancient quantum crystal anomalies.',
  },
];

export default function App() {
  const { sdk } = usePlayground();
  const isMobile = useIsMobile();

  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    mode: 'SURVIVAL',
    score: 0,
    level: 1,
    currentPlanet: 'verdant',
    sectorsConquered: { verdant: 1, magma: 0, cryo: 0 },
    resources: {
      iron: Number(getConfig('startingIron')),
      copper: 80,
      crystal: 20,
      energy: Number(getConfig('startingEnergy')),
    },
    nexusHp: Number(getConfig('maxNexusHealth')),
    maxNexusHp: Number(getConfig('maxNexusHealth')),
    droneHp: Number(getConfig('maxDroneHealth')),
    maxDroneHp: Number(getConfig('maxDroneHealth')),
    droneUpgrades: {
      chassisTier: 1,
      miningTier: 1,
      thrustersTier: 1,
      shieldTier: 1,
    },
    wave: 1,
    waveTimer: Number(getConfig('waveInterval')),
    waveActive: false,
    totalResearchCount: INITIAL_RESEARCH_NODES.length,
    unlockedResearchCount: 1,
    perspective: 'FIRST_PERSON',
    selectedHotbar: 'GATLING_TURRET',
  });

  const [researchNodes, setResearchNodes] = useState<ResearchNode[]>(
    INITIAL_RESEARCH_NODES
  );

  // Overlay States
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [isPlanetMapOpen, setIsPlanetMapOpen] = useState(false);
  const [isDroneUpgradeOpen, setIsDroneUpgradeOpen] = useState(false);

  // Audio Toggles (placed inside Game Menu overlay)
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Mobile Touch Virtual Joystick & Action States
  const [virtualInput, setVirtualInput] = useState({
    moveX: 0,
    moveZ: 0,
    lookX: 0,
    lookY: 0,
    jump: false,
    mine: false,
    build: false,
    demolish: false,
  });

  // Window back-key integration
  useEffect(() => {
    (window as unknown as Record<string, unknown>).canHandleBackKey = [
      'PLAYING',
      'PAUSED',
    ].includes(gameState.status);
  }, [gameState.status]);

  // SDK Lifecycle integration
  usePlaygroundGameLifecycle(gameState, sdk);

  // Sound triggers on state changes
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    }
  }, [gameState.status]);

  // Auto-Focus for start button
  const startBtnRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START'
  );

  // Keyboard Escape Handler for Game Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isResearchOpen || isPlanetMapOpen || isDroneUpgradeOpen) {
          setIsResearchOpen(false);
          setIsPlanetMapOpen(false);
          setIsDroneUpgradeOpen(false);
        } else if (gameState.status === 'PLAYING') {
          setIsGameMenuOpen((prev) => !prev);
        }
      }
      if (gameState.status === 'PLAYING') {
        if (e.key === 'v' || e.key === 'V') {
          togglePerspective();
        } else if (e.key === 'r' || e.key === 'R') {
          setIsResearchOpen((prev) => !prev);
        } else if (e.key === 'm' || e.key === 'M') {
          setIsPlanetMapOpen((prev) => !prev);
        } else if (e.key === 'u' || e.key === 'U') {
          setIsDroneUpgradeOpen((prev) => !prev);
        } else if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) {
          const hotbars: StructureType[] = [
            'CONVEYOR',
            'MINER',
            'GATLING_TURRET',
            'PLASMA_TURRET',
            'TESLA_COIL',
            'SOLAR_PANEL',
            'WALL',
          ];
          const idx = parseInt(e.key, 10) - 1;
          if (hotbars[idx]) {
            setGameState((prev) => ({ ...prev, selectedHotbar: hotbars[idx] }));
            gameAudio.playCrispClick();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState.status,
    isResearchOpen,
    isPlanetMapOpen,
    isDroneUpgradeOpen,
  ]);

  // Check Master Campaign Victory Condition
  const checkMasterVictory = (
    sectors: Record<PlanetId, number>,
    nodes: ResearchNode[],
    upgrades: typeof gameState.droneUpgrades
  ) => {
    const allSectors =
      sectors.verdant >= 3 && sectors.magma >= 3 && sectors.cryo >= 3;
    const allResearch = nodes.every((n) => n.unlocked);
    const maxDrone =
      upgrades.chassisTier >= 5 &&
      upgrades.miningTier >= 5 &&
      upgrades.thrustersTier >= 5 &&
      upgrades.shieldTier >= 5;

    if (allSectors && allResearch && maxDrone) {
      setGameState((prev) => ({ ...prev, status: 'VICTORY' }));
    }
  };

  const handleStartGame = (mode: GameMode) => {
    gameAudio.playConfirmSelect();
    if (sdk) sdk.startGame();
    setGameState({
      status: 'PLAYING',
      mode,
      score: 0,
      level: 1,
      currentPlanet: 'verdant',
      sectorsConquered: { verdant: 1, magma: 0, cryo: 0 },
      resources: {
        iron:
          mode === 'CREATIVE'
            ? 99999
            : Number(getConfig('startingIron')),
        copper: mode === 'CREATIVE' ? 99999 : 80,
        crystal: mode === 'CREATIVE' ? 99999 : 20,
        energy:
          mode === 'CREATIVE'
            ? 99999
            : Number(getConfig('startingEnergy')),
      },
      nexusHp: Number(getConfig('maxNexusHealth')),
      maxNexusHp: Number(getConfig('maxNexusHealth')),
      droneHp: Number(getConfig('maxDroneHealth')),
      maxDroneHp: Number(getConfig('maxDroneHealth')),
      droneUpgrades: {
        chassisTier: mode === 'CREATIVE' ? 5 : 1,
        miningTier: mode === 'CREATIVE' ? 5 : 1,
        thrustersTier: mode === 'CREATIVE' ? 5 : 1,
        shieldTier: mode === 'CREATIVE' ? 5 : 1,
      },
      wave: 1,
      waveTimer: Number(getConfig('waveInterval')),
      waveActive: false,
      totalResearchCount: INITIAL_RESEARCH_NODES.length,
      unlockedResearchCount: 1,
      perspective: 'FIRST_PERSON',
      selectedHotbar: 'GATLING_TURRET',
    });
    setIsGameMenuOpen(false);
  };

  const togglePerspective = () => {
    gameAudio.playCrispClick();
    setGameState((prev) => ({
      ...prev,
      perspective:
        prev.perspective === 'FIRST_PERSON' ? 'TABLETOP' : 'FIRST_PERSON',
    }));
  };

  const handleUnlockResearch = (nodeId: string) => {
    const node = researchNodes.find((n) => n.id === nodeId);
    if (!node || node.unlocked) return;

    if (
      gameState.mode === 'CREATIVE' ||
      (gameState.resources.iron >= node.cost.iron &&
        gameState.resources.copper >= node.cost.copper &&
        gameState.resources.crystal >= node.cost.crystal &&
        gameState.resources.energy >= node.cost.energy)
    ) {
      gameAudio.playLevelUpStinger();
      const updated = researchNodes.map((n) =>
        n.id === nodeId ? { ...n, unlocked: true } : n
      );
      setResearchNodes(updated);

      const unlockedCount = updated.filter((n) => n.unlocked).length;

      setGameState((prev) => {
        const nextRes =
          prev.mode === 'CREATIVE'
            ? prev.resources
            : {
                iron: prev.resources.iron - node.cost.iron,
                copper: prev.resources.copper - node.cost.copper,
                crystal: prev.resources.crystal - node.cost.crystal,
                energy: prev.resources.energy - node.cost.energy,
              };

        const nextScore = prev.score + 500;
        return {
          ...prev,
          resources: nextRes,
          score: nextScore,
          unlockedResearchCount: unlockedCount,
        };
      });

      checkMasterVictory(
        gameState.sectorsConquered,
        updated,
        gameState.droneUpgrades
      );
    } else {
      gameAudio.playErrorBuzz();
    }
  };

  const handleUpgradeDrone = (
    stat: 'chassisTier' | 'miningTier' | 'thrustersTier' | 'shieldTier'
  ) => {
    const currentTier = gameState.droneUpgrades[stat];
    if (currentTier >= 5) return;

    const cost = {
      iron: currentTier * 40,
      copper: currentTier * 30,
      crystal: currentTier * 15,
      energy: currentTier * 20,
    };

    if (
      gameState.mode === 'CREATIVE' ||
      (gameState.resources.iron >= cost.iron &&
        gameState.resources.copper >= cost.copper &&
        gameState.resources.crystal >= cost.crystal &&
        gameState.resources.energy >= cost.energy)
    ) {
      gameAudio.playPowerupChime();
      const nextUpgrades = {
        ...gameState.droneUpgrades,
        [stat]: currentTier + 1,
      };

      setGameState((prev) => ({
        ...prev,
        droneUpgrades: nextUpgrades,
        resources:
          prev.mode === 'CREATIVE'
            ? prev.resources
            : {
                iron: prev.resources.iron - cost.iron,
                copper: prev.resources.copper - cost.copper,
                crystal: prev.resources.crystal - cost.crystal,
                energy: prev.resources.energy - cost.energy,
              },
        score: prev.score + 300,
        maxDroneHp: 200 + nextUpgrades.chassisTier * 50,
      }));

      checkMasterVictory(
        gameState.sectorsConquered,
        researchNodes,
        nextUpgrades
      );
    } else {
      gameAudio.playErrorBuzz();
    }
  };

  const handleConquerSector = (planet: PlanetId) => {
    const currentConquered = gameState.sectorsConquered[planet] || 0;
    if (currentConquered >= 3) return;

    gameAudio.playVictoryFanfare();
    const nextSectors = {
      ...gameState.sectorsConquered,
      [planet]: currentConquered + 1,
    };

    setGameState((prev) => ({
      ...prev,
      sectorsConquered: nextSectors,
      score: prev.score + 1000,
      level: prev.level + 1,
    }));

    checkMasterVictory(nextSectors, researchNodes, gameState.droneUpgrades);
  };

  const handleSwitchPlanet = (planet: PlanetId) => {
    gameAudio.playConfirmSelect();
    setGameState((prev) => ({
      ...prev,
      currentPlanet: planet,
    }));
    setIsPlanetMapOpen(false);
  };

  const HOTBAR_ITEMS: { type: StructureType; label: string; icon: string }[] = [
    { type: 'CONVEYOR', label: 'Conveyor', icon: '⚡' },
    { type: 'MINER', label: 'Ore Miner', icon: '⛏' },
    { type: 'GATLING_TURRET', label: 'Gatling', icon: '🔫' },
    { type: 'PLASMA_TURRET', label: 'Plasma', icon: '🔮' },
    { type: 'TESLA_COIL', label: 'Tesla', icon: '⚡' },
    { type: 'SOLAR_PANEL', label: 'Solar', icon: '☀️' },
    { type: 'WALL', label: 'Wall', icon: '🧱' },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col bg-slate-950 text-white font-sans select-none">
      {/* Background Music Player */}
      <BackgroundMusic
        url="https://assets.mixkit.co/music/preview/mixkit-space-game-668.mp3"
        isPlaying={gameState.status === 'PLAYING'}
        isMuted={isMusicMuted}
      />

      {/* TOP HEADER / HUD BAR */}
      <header className="w-full bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-sky-400 text-xs tracking-wider uppercase">
            {gameState.currentPlanet.toUpperCase()} SECTOR [
            {gameState.sectorsConquered[gameState.currentPlanet]}/3]
          </span>
          <div className="flex items-center gap-1.5 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            <span className="text-slate-400">FE:</span>
            <span className="text-slate-200 font-bold">
              {gameState.resources.iron}
            </span>
            <span className="text-amber-500 ml-1">CU:</span>
            <span className="text-amber-300 font-bold">
              {gameState.resources.copper}
            </span>
            <span className="text-cyan-400 ml-1">CR:</span>
            <span className="text-cyan-200 font-bold">
              {gameState.resources.crystal}
            </span>
            <span className="text-yellow-400 ml-1">PWR:</span>
            <span className="text-yellow-200 font-bold">
              {gameState.resources.energy}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-rose-400 font-semibold">
              Nexus: {Math.round(gameState.nexusHp)}/
              {gameState.maxNexusHp}
            </span>
            {gameState.mode === 'SURVIVAL' && (
              <span className="text-emerald-400 font-semibold">
                Drone: {Math.round(gameState.droneHp)}/
                {gameState.maxDroneHp}
              </span>
            )}
            <span className="text-yellow-400">
              Wave: {gameState.wave} ({gameState.waveTimer}s)
            </span>
          </div>
        </div>

        {/* TOP RIGHT GAME MENU & HUD BUTTONS */}
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <button
            onClick={() => setIsDroneUpgradeOpen(true)}
            className="px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded text-xs font-bold transition flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Drone
          </button>
          <button
            onClick={() => setIsResearchOpen(true)}
            className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-xs font-bold transition flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> Tech [
            {gameState.unlockedResearchCount}/{gameState.totalResearchCount}]
          </button>
          <button
            onClick={() => setIsPlanetMapOpen(true)}
            className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded text-xs font-bold transition">
            Planets
          </button>
          <button
            onClick={() => setIsGameMenuOpen(true)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-bold transition">
            Menu ≡
          </button>
        </div>
      </header>

      {/* 3D WEBGL CANVAS CONTAINER */}
      <div className="flex-1 w-full min-h-0 relative bg-slate-950 overflow-hidden">
        <Canvas
          shadows
          camera={{ position: [0, 5, 10], fov: Number(getConfig('fov')) }}
          className="w-full h-full block">
          <GameScene
            gameState={gameState}
            setGameState={setGameState}
            isGameMenuOpen={isGameMenuOpen}
            isResearchOpen={isResearchOpen}
            isMapOpen={isPlanetMapOpen}
            virtualInput={virtualInput}
            onVictory={() =>
              setGameState((prev) => ({ ...prev, status: 'VICTORY' }))
            }
            onGameOver={() =>
              setGameState((prev) => ({ ...prev, status: 'GAME_OVER' }))
            }
          />
        </Canvas>

        {/* BOTTOM FACTORY HOTBAR (IN-CANVAS OVERLAY SAFE ZONE) */}
        {gameState.status === 'PLAYING' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700/80 px-2 py-1.5 rounded-xl shadow-2xl flex items-center gap-1.5 z-20 pointer-events-auto">
            {HOTBAR_ITEMS.map((item, idx) => {
              const active = gameState.selectedHotbar === item.type;
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    gameAudio.playCrispClick();
                    setGameState((prev) => ({
                      ...prev,
                      selectedHotbar: item.type,
                    }));
                  }}
                  className={`flex flex-col items-center justify-center px-2 py-1 min-w-[48px] min-h-[48px] rounded-lg transition-all ${
                    active
                      ? 'bg-sky-500 text-black font-bold scale-105 shadow-lg shadow-sky-500/50'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}>
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-[9px] leading-tight">
                    {idx + 1}. {item.label}
                  </span>
                </button>
              );
            })}

            <button
              onClick={togglePerspective}
              className="ml-2 px-2.5 py-1 min-h-[48px] bg-amber-600 hover:bg-amber-500 rounded-lg text-[10px] font-bold text-white transition flex flex-col items-center justify-center">
              <span>🔄</span>
              <span>
                {gameState.perspective === 'FIRST_PERSON'
                  ? 'Tabletop'
                  : '1st Person'}
              </span>
            </button>
          </div>
        )}

        {/* MOBILE ON-SCREEN TOUCH CONTROLS */}
        {isMobile && gameState.status === 'PLAYING' && (
          <div className="absolute inset-0 pointer-events-none z-20 flex justify-between items-end p-4">
            {/* Left D-pad / Joystick Locomotion */}
            <div className="pointer-events-auto flex flex-col items-center gap-1 bg-slate-900/60 p-2 rounded-2xl border border-slate-700">
              <button
                onPointerDown={() =>
                  setVirtualInput((prev) => ({ ...prev, moveZ: -1 }))
                }
                onPointerUp={() =>
                  setVirtualInput((prev) => ({ ...prev, moveZ: 0 }))
                }
                className="w-12 h-12 min-w-[48px] min-h-[48px] bg-slate-800 text-white rounded-lg flex items-center justify-center font-bold active:bg-sky-500">
                ▲
              </button>
              <div className="flex gap-1">
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, moveX: -1 }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, moveX: 0 }))
                  }
                  className="w-12 h-12 min-w-[48px] min-h-[48px] bg-slate-800 text-white rounded-lg flex items-center justify-center font-bold active:bg-sky-500">
                  ◀
                </button>
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, moveZ: 1 }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, moveZ: 0 }))
                  }
                  className="w-12 h-12 min-w-[48px] min-h-[48px] bg-slate-800 text-white rounded-lg flex items-center justify-center font-bold active:bg-sky-500">
                  ▼
                </button>
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, moveX: 1 }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, moveX: 0 }))
                  }
                  className="w-12 h-12 min-w-[48px] min-h-[48px] bg-slate-800 text-white rounded-lg flex items-center justify-center font-bold active:bg-sky-500">
                  ▶
                </button>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, mine: true }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, mine: false }))
                  }
                  className="w-14 h-14 min-w-[48px] min-h-[48px] bg-cyan-600 text-white rounded-full flex flex-col items-center justify-center font-bold text-xs shadow-lg active:bg-cyan-400">
                  <span>⛏</span>
                  <span>Mine</span>
                </button>
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, build: true }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, build: false }))
                  }
                  className="w-14 h-14 min-w-[48px] min-h-[48px] bg-emerald-600 text-white rounded-full flex flex-col items-center justify-center font-bold text-xs shadow-lg active:bg-emerald-400">
                  <span>🏗</span>
                  <span>Build</span>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, jump: true }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, jump: false }))
                  }
                  className="w-14 h-14 min-w-[48px] min-h-[48px] bg-sky-600 text-white rounded-full flex flex-col items-center justify-center font-bold text-xs shadow-lg active:bg-sky-400">
                  <span>🚀</span>
                  <span>Jump</span>
                </button>
                <button
                  onPointerDown={() =>
                    setVirtualInput((prev) => ({ ...prev, demolish: true }))
                  }
                  onPointerUp={() =>
                    setVirtualInput((prev) => ({ ...prev, demolish: false }))
                  }
                  className="w-14 h-14 min-w-[48px] min-h-[48px] bg-rose-600 text-white rounded-full flex flex-col items-center justify-center font-bold text-xs shadow-lg active:bg-rose-400">
                  <span>💥</span>
                  <span>Recycle</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* START GAME SCREEN OVERLAY */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-sky-500/50 rounded-2xl p-6 m-4 shadow-2xl flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl font-black text-sky-400 mb-2 tracking-wide uppercase">
              Voxel Forge Odyssey
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mb-6">
              Infinite Voxel Factory Automation &amp; Planetary Defense. Build 3D
              conveyor networks, pilot your customizable drone, research cosmic
              tech, and conquer all 3 planetary sectors!
            </p>

            <div className="w-full flex flex-col gap-3 mb-6">
              <button
                ref={startBtnRef}
                autoFocus
                onClick={() => handleStartGame('SURVIVAL')}
                className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-black font-black text-base md:text-lg rounded-xl transition shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 min-h-[48px]">
                <Play className="w-5 h-5 fill-current" /> PLAY SURVIVAL MODE
              </button>
              <button
                onClick={() => handleStartGame('CREATIVE')}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm md:text-base rounded-xl transition shadow-lg min-h-[48px]">
                CREATIVE SANDBOX MODE
              </button>
              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 min-h-[48px]">
                HOW TO PLAY &amp; CONTROLS
              </button>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/70 p-3 rounded-lg border border-slate-800 w-full text-left">
              <div className="font-bold text-sky-400 mb-1">
                ⭐ Grand Victory Milestones:
              </div>
              <div>• Conquer all 3 Sectors across 3 Planets</div>
              <div>• Unlock 100% of the Tech Research Tree</div>
              <div>• Upgrade your Builder Drone to Level MAX (Tier 5)</div>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* GAME OVER SCREEN OVERLAY */}
      {gameState.status === 'GAME_OVER' && (
        <MenuOverlay tone="danger" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-red-500 rounded-2xl p-6 m-4 shadow-2xl flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl font-black text-red-400 mb-2">
              BASE DESTROYED
            </h1>
            <p className="text-xs text-slate-300 mb-4">
              The Nexus was overwhelmed by dimensional swarms.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 w-full mb-6 text-sm">
              <div className="text-slate-400">
                Final Score:{' '}
                <span className="text-yellow-400 font-bold">
                  {gameState.score}
                </span>
              </div>
              <div className="text-slate-400">
                Waves Survived:{' '}
                <span className="text-sky-400 font-bold">{gameState.wave}</span>
              </div>
            </div>
            <button
              onClick={() => handleStartGame('SURVIVAL')}
              autoFocus
              className="w-full py-3 bg-red-500 hover:bg-red-400 text-black font-black text-base rounded-xl transition flex items-center justify-center gap-2 min-h-[48px]">
              <RotateCw className="w-5 h-5" /> RETRY MISSION
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* GRAND VICTORY SCREEN OVERLAY */}
      {gameState.status === 'VICTORY' && (
        <MenuOverlay tone="victory" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500 rounded-2xl p-6 m-4 shadow-2xl flex flex-col items-center text-center">
            <Trophy className="w-14 h-14 text-yellow-400 mb-2 animate-bounce" />
            <h1 className="text-3xl md:text-4xl font-black text-emerald-400 mb-2">
              ODYSSEY CONQUERED!
            </h1>
            <p className="text-xs text-slate-300 mb-4">
              All sectors secured, technologies researched, and builder drone
              fully maxed out. You are the ultimate cosmic architect!
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 w-full mb-6 text-sm">
              <div className="text-yellow-400 font-bold text-lg mb-1">
                Score: {gameState.score}
              </div>
              <div className="text-xs text-slate-400">
                Total Sectors: 9/9 | Tech Tree: 100% | Drone: Tier 5
              </div>
            </div>
            <button
              onClick={() => handleStartGame('SURVIVAL')}
              autoFocus
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base rounded-xl transition flex items-center justify-center gap-2 min-h-[48px]">
              <Play className="w-5 h-5 fill-current" /> PLAY AGAIN
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* TECH RESEARCH MODAL */}
      {isResearchOpen && (
        <MenuOverlay tone="neutral" zIndex={45}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-indigo-500/70 rounded-2xl p-5 m-4 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-black text-indigo-400 flex items-center gap-2">
                <Activity className="w-5 h-5" /> Tech Research Matrix
              </h2>
              <button
                onClick={() => setIsResearchOpen(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">
                Close ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {researchNodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    node.unlocked
                      ? 'bg-emerald-950/40 border-emerald-600/50'
                      : 'bg-slate-950 border-slate-800'
                  }`}>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100">
                        {node.title}
                      </span>
                      {node.unlocked && (
                        <span className="text-[9px] bg-emerald-700 px-1.5 py-0.2 rounded font-bold text-white">
                          UNLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {node.description}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-slate-300 mt-1">
                      <span>FE: {node.cost.iron}</span>
                      <span>CU: {node.cost.copper}</span>
                      <span>CR: {node.cost.crystal}</span>
                      <span>PWR: {node.cost.energy}</span>
                    </div>
                  </div>

                  {!node.unlocked && (
                    <button
                      onClick={() => handleUnlockResearch(node.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition shrink-0 min-h-[40px]">
                      Research
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* PLANET / SECTOR MAP MODAL */}
      {isPlanetMapOpen && (
        <MenuOverlay tone="neutral" zIndex={45}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-emerald-500/70 rounded-2xl p-5 m-4 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-black text-emerald-400">
                Planetary Expedition Map
              </h2>
              <button
                onClick={() => setIsPlanetMapOpen(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">
                Close ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {PLANETS_CONFIG.map((p) => {
                const conquered = gameState.sectorsConquered[p.id] || 0;
                const isCurrent = gameState.currentPlanet === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                      isCurrent
                        ? 'bg-slate-800 border-emerald-400'
                        : 'bg-slate-950 border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: p.themeColor }}
                        />
                        {p.name} {isCurrent && '(Active)'}
                      </span>
                      <span className="text-xs font-bold text-yellow-400">
                        Sectors: {conquered}/3
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{p.desc}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {!isCurrent && (
                        <button
                          onClick={() => handleSwitchPlanet(p.id)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold transition">
                          Warp to Planet
                        </button>
                      )}
                      {conquered < 3 && isCurrent && (
                        <button
                          onClick={() => handleConquerSector(p.id)}
                          className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 rounded text-xs font-bold transition">
                          Claim Sector {conquered + 1}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* DRONE UPGRADE WORKSHOP MODAL */}
      {isDroneUpgradeOpen && (
        <MenuOverlay tone="neutral" zIndex={45}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-sky-500/70 rounded-2xl p-5 m-4 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-black text-sky-400 flex items-center gap-2">
                <Zap className="w-5 h-5" /> Drone Hangar Workshop
              </h2>
              <button
                onClick={() => setIsDroneUpgradeOpen(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  key: 'chassisTier' as const,
                  label: 'Reinforced Chassis',
                  desc: 'Increases Max HP & structural integrity',
                },
                {
                  key: 'miningTier' as const,
                  label: 'Sub-Atomic Mining Laser',
                  desc: 'Expands mining reach & ore extraction rate',
                },
                {
                  key: 'thrustersTier' as const,
                  label: 'Quantum Jump Thrusters',
                  desc: 'Increases flight speed & vertical jump power',
                },
                {
                  key: 'shieldTier' as const,
                  label: 'Nanite Forcefield',
                  desc: 'Reduces all incoming hostile damage',
                },
              ].map((up) => {
                const tier = gameState.droneUpgrades[up.key];
                return (
                  <div
                    key={up.key}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-sky-300">
                          {up.label}
                        </span>
                        <span className="text-[10px] bg-sky-900 text-sky-200 px-1.5 py-0.5 rounded font-bold">
                          Tier {tier}/5
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-2">
                        {up.desc}
                      </p>
                    </div>

                    {tier < 5 ? (
                      <button
                        onClick={() => handleUpgradeDrone(up.key)}
                        className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 rounded text-xs font-bold transition">
                        Upgrade (FE:{tier * 40} CU:{tier * 30})
                      </button>
                    ) : (
                      <div className="text-center text-xs font-black text-emerald-400 py-1 bg-emerald-950/50 rounded">
                        MAX LEVEL (TIER 5)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* GAME MENU OVERLAY (ESC / Menu Button) */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 m-4 shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl md:text-3xl font-black text-yellow-400 mb-4 tracking-wide">
              GAME MENU
            </h2>

            <div className="w-full flex flex-col gap-3 mb-6">
              <button
                onClick={() => setIsGameMenuOpen(false)}
                autoFocus
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-black font-bold text-sm rounded-xl transition min-h-[48px]">
                RESUME EXPEDITION
              </button>

              {/* AUDIO MUTE TOGGLES */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const newMuted = gameAudio.toggleMute();
                    setIsSfxMuted(newMuted);
                  }}
                  className="py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 min-h-[48px]">
                  {isSfxMuted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                  SFX: {isSfxMuted ? 'Off' : 'On'}
                </button>
                <button
                  onClick={() => setIsMusicMuted((prev) => !prev)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 min-h-[48px]">
                  {isMusicMuted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                  Music: {isMusicMuted ? 'Off' : 'On'}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  handleStartGame(gameState.mode);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold border border-slate-700 min-h-[48px]">
                RESTART SECTOR
              </button>

              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold border border-slate-700 min-h-[48px]">
                HOW TO PLAY
              </button>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({ ...prev, status: 'START' }));
                }}
                className="w-full py-2 bg-rose-900/60 hover:bg-rose-800 rounded-xl text-xs font-bold border border-rose-700 text-rose-200 min-h-[48px]">
                QUIT TO MAIN MENU
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY SCREEN OVERLAY */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 m-4 shadow-2xl flex flex-col text-left">
            <h2 className="text-xl font-black text-sky-400 mb-3 text-center">
              HOW TO PLAY
            </h2>
            <div className="text-xs text-slate-300 space-y-2 mb-6 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                <b className="text-sky-300">1. Dual Perspective Navigation:</b>{' '}
                Explore in <b>First-Person</b> piloting your builder drone with
                physical arm-swings or switch to <b>Tabletop God view</b> (Key V
                or toggle button) to manage layout.
              </p>
              <p>
                <b className="text-amber-300">2. Mining &amp; Logistics:</b> Aim
                at voxel terrain and press <b>E / Mine Button</b> to extract
                ores. Place <b>Conveyor Belts</b> (Key 1) and <b>Drills</b> (Key
                2) on the 3D grid to automate delivery straight to base.
              </p>
              <p>
                <b className="text-rose-300">3. Defense Turrets:</b> Build{' '}
                <b>Gatling, Plasma, and Tesla turrets</b> (Keys 3-5) to
                automatically target and repel hostile dimensional creeps before
                they breach your Command Nexus.
              </p>
              <p>
                <b className="text-emerald-300">
                  4. Planets, Research &amp; Upgrades:
                </b>{' '}
                Unlock technologies in the <b>Tech Tree (R)</b>, conquer all 3
                sectors on each of the 3 planets (M), and max out your drone
                hangar stats (U) to achieve complete victory!
              </p>
            </div>
            <button
              onClick={() => setIsHowToPlayOpen(false)}
              autoFocus
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-black font-bold text-sm rounded-xl transition min-h-[48px]">
              CLOSE GUIDE
            </button>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
