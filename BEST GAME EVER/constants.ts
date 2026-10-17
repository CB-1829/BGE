export const CONFIG = {
  // Core game initialization
  title: {
    value: 'Voxel Forge Odyssey',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 16.666,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Theming & Audio
  backgroundColor: {
    value: '#090d16',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#38bdf8',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Inter, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Camera & Lighting (3D R3F)
  fov: {
    value: 65,
    type: 'number',
    label: 'Field of View',
    group: 'Camera',
  },
  sunIntensity: {
    value: 3.8,
    type: 'number',
    label: 'Sun Intensity',
    group: 'Lighting',
  },
  ambientIntensity: {
    value: 1.6,
    type: 'number',
    label: 'Ambient Intensity',
    group: 'Lighting',
  },
  hemiSkyColor: {
    value: '#38bdf8',
    type: 'color',
    label: 'Hemi Sky Color',
    group: 'Lighting',
  },
  hemiGroundColor: {
    value: '#334155',
    type: 'color',
    label: 'Hemi Ground Color',
    group: 'Lighting',
  },
  hemiIntensity: {
    value: 1.5,
    type: 'number',
    label: 'Hemi Intensity',
    group: 'Lighting',
  },

  // Gameplay & Rules
  droneSpeed: {
    value: 8.5,
    type: 'number',
    label: 'Drone Move Speed',
    group: 'Rules',
  },
  droneJumpForce: {
    value: 7.0,
    type: 'number',
    label: 'Drone Jump Force',
    group: 'Rules',
  },
  chunkRadius: {
    value: 3,
    type: 'number',
    label: 'Chunk Stream Radius',
    group: 'World',
  },
  waveInterval: {
    value: 45,
    type: 'number',
    label: 'Wave Interval (s)',
    group: 'Rules',
  },
  maxNexusHealth: {
    value: 1000,
    type: 'number',
    label: 'Base Nexus Max HP',
    group: 'Rules',
  },
  maxDroneHealth: {
    value: 200,
    type: 'number',
    label: 'Drone Max HP',
    group: 'Rules',
  },
  startingIron: {
    value: 150,
    type: 'number',
    label: 'Starting Iron',
    group: 'Rules',
  },
  startingEnergy: {
    value: 100,
    type: 'number',
    label: 'Starting Energy',
    group: 'Rules',
  },
};

// Merge customized config values if present (injected by Playground)
const { playgroundConfig } = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], { value });
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const AVAILABLE_MUSIC_TRACKS = [
  {
    name: 'Cosmic Forge',
    url: 'https://assets.mixkit.co/music/preview/mixkit-space-game-668.mp3',
    description: 'Atmospheric synth sci-fi loop',
  },
];
