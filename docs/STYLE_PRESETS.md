# Style Presets System

## Overview

The Style Presets System is a deterministic preset mechanism designed specifically for architectural visualization. Unlike generic image generation presets, this system understands that architectural outputs require control over multiple dimensions: the **mood/atmosphere**, the **design language/architect influence**, and the **rendering style**.

This document outlines the complete design for a combinable, architecture-specific preset system.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Preset Categories](#preset-categories)
3. [Preset Data Structure](#preset-data-structure)
4. [Determinism Strategy](#determinism-strategy)
5. [Preset Combinations](#preset-combinations)
6. [Built-in Preset Library](#built-in-preset-library)
7. [User Interface Design](#user-interface-design)
8. [Technical Implementation](#technical-implementation)
9. [Storage & Persistence](#storage--persistence)
10. [Export/Import & Sharing](#exportimport--sharing)

---

## Core Concepts

### What Makes Architectural Presets Different

Standard image generation presets typically modify only visual style (e.g., "watercolor", "cinematic"). Architectural visualization requires a more sophisticated approach:

| Dimension | Description | Example |
|-----------|-------------|---------|
| **Mood** | Atmospheric conditions, emotional tone, lighting scenarios | Winter morning, Mediterranean sunset, Rainy melancholic |
| **Design** | Architectural language, spatial proportions, material choices, formal vocabulary | Zaha Hadid (parametric curves), Tadao Ando (concrete minimalism), Japandi (Japanese-Scandinavian fusion) |
| **Style** | Rendering technique, artistic treatment, output format | Photorealistic ArchViz, Pencil sketch, Watercolor, Cinematic |

### Combinable Architecture

Presets are designed to be **layered and combined**:

```
Final Output = Base Prompt + Mood Preset + Design Preset + Style Preset
```

Example combination:
- **Mood**: "Winter Morning"
- **Design**: "Tadao Ando"
- **Style**: "Cinematic ArchViz"

Result: A concrete-heavy minimalist space with stark morning light filtering through geometric openings, rendered with cinematic color grading and dramatic shadows.

### Determinism

For reproducible results, presets lock specific parameters:

| Parameter | Purpose for Determinism |
|-----------|------------------------|
| `temperature` | Lower values (0.1-0.3) = more deterministic |
| `top_p` | Lower values = less sampling variance |
| `seed` (if supported) | Exact reproduction |
| Prompt prefix/suffix | Consistent style language |

---

## Preset Categories

### 1. Mood Presets

Mood presets control atmospheric and emotional qualities without dictating architectural form.

#### Seasonal & Weather
| Preset | Key Characteristics |
|--------|---------------------|
| **Winter Morning** | Cold light, long shadows, frost, muted colors, crystalline air |
| **Summer Noon** | Harsh overhead light, deep shadows, warm tones, heat haze |
| **Autumn Dusk** | Golden hour, warm oranges, scattered leaves, nostalgic atmosphere |
| **Spring Rain** | Soft overcast, wet surfaces, reflections, fresh greens, renewal |
| **Mediterranean Sunset** | Warm golden light, terracotta tones, deep blues, relaxed elegance |
| **Nordic Twilight** | Blue hour, long shadows, hygge warmth from windows, snow |

#### Emotional & Atmospheric
| Preset | Key Characteristics |
|--------|---------------------|
| **Melancholic** | Overcast, muted palette, solitary mood, contemplative silence |
| **Whimsical** | Playful light, unexpected colors, dreamlike quality |
| **Serene** | Balanced light, calm water, zen-like stillness, harmony |
| **Dramatic** | Strong contrasts, storm clouds, tension, theatrical lighting |
| **Intimate** | Warm pools of light, close quarters, personal scale |
| **Monumental** | Grand scale, heroic perspective, awe-inspiring proportions |

#### Time-Based
| Preset | Key Characteristics |
|--------|---------------------|
| **Dawn** | First light, pink/purple sky, fresh start, quiet |
| **Blue Hour** | Pre-sunrise/post-sunset, deep blue atmosphere, city lights |
| **Golden Hour** | Warm directional light, long shadows, photographic ideal |
| **Night** | Artificial lighting, pools of light, darkness, mystery |
| **Overcast Noon** | Even diffuse light, no harsh shadows, neutral |

---

### 2. Design Presets (Architectural Language)

Design presets influence spatial organization, material choices, proportions, and formal vocabulary. These are the most architecturally significant presets.

#### By Architect/Studio
| Preset | Key Characteristics |
|--------|---------------------|
| **Zaha Hadid** | Fluid parametric forms, continuous surfaces, dramatic cantilevers, white/black contrasts, curved geometries that defy gravity |
| **Tadao Ando** | Exposed concrete, precise geometry, water features, controlled light slots, meditative minimalism |
| **Frank Gehry** | Deconstructed forms, titanium/metal cladding, billowing surfaces, sculptural chaos |
| **Peter Zumthor** | Material authenticity, atmospheric density, haptic surfaces, quiet monumentality |
| **Bjarke Ingels (BIG)** | Playful pragmatism, warped geometries, green integration, social architecture |
| **Kengo Kuma** | Wood lattices, layered transparency, nature integration, delicate screens |
| **Herzog & de Meuron** | Surface experimentation, unconventional materials, contextual response |
| **SANAA (Sejima/Nishizawa)** | Ethereal minimalism, glass transparency, floating volumes, lightness |
| **Renzo Piano** | High-tech refinement, exposed structure, layered facades, crafted details |
| **Norman Foster** | Structural expression, sustainability, glass and steel, optimistic technology |
| **Le Corbusier** | Pilotis, ribbon windows, roof gardens, free plan, purism |
| **Mies van der Rohe** | "Less is more", steel frames, glass curtain walls, universal space |
| **Louis Kahn** | Monumental geometry, light wells, served/servant spaces, brick and concrete |

#### By Style Movement
| Preset | Key Characteristics |
|--------|---------------------|
| **Japandi** | Japanese + Scandinavian fusion, natural materials, muted tones, functional minimalism, craftsmanship |
| **Minimalist** | Reduction to essentials, white space, hidden storage, clean lines |
| **Industrial** | Exposed structure, raw materials, factory aesthetics, metal and brick |
| **Brutalist** | Raw concrete, bold geometric forms, honest materials, monolithic presence |
| **Art Deco** | Geometric ornament, luxurious materials, bold colors, glamour |
| **Mid-Century Modern** | Organic curves, indoor-outdoor flow, optimistic modernism |
| **Mediterranean** | Whitewashed walls, terracotta, arches, courtyards, blue accents |
| **Scandinavian** | Light wood, white walls, warmth, hygge, functional beauty |
| **Biophilic** | Living walls, natural light, organic forms, nature integration |
| **Parametric** | Algorithm-driven forms, complex geometries, digital fabrication |
| **Deconstructivist** | Fragmentation, unpredictability, dynamic instability |

#### By Function/Typology
| Preset | Key Characteristics |
|--------|---------------------|
| **Residential Luxury** | High-end finishes, generous proportions, curated materials |
| **Commercial Modern** | Efficient layouts, branded environments, professional polish |
| **Cultural/Museum** | Neutral galleries, dramatic circulation, art-first design |
| **Hospitality/Hotel** | Welcoming atmosphere, layered lighting, comfort |
| **Educational** | Flexible spaces, natural light, collaborative areas |

---

### 3. Style Presets (Rendering Technique)

Style presets control the visual output technique without affecting architectural content.

#### Photorealistic
| Preset | Key Characteristics |
|--------|---------------------|
| **ArchViz Standard** | Professional architectural visualization, accurate materials, clean composition |
| **Cinematic** | Film color grading, anamorphic lens effects, dramatic framing |
| **Editorial** | Magazine-quality, styled staging, aspirational lifestyle |
| **Documentary** | Authentic, lived-in, realistic imperfections |
| **Real Estate** | Bright, wide-angle, inviting, neutral |

#### Artistic/Illustrative
| Preset | Key Characteristics |
|--------|---------------------|
| **Pencil Sketch** | Hand-drawn line work, gestural marks, design process aesthetic |
| **Watercolor** | Soft washes, bleeding edges, artistic interpretation |
| **Ink Wash** | Bold contrasts, Asian-inspired, atmospheric gradients |
| **Charcoal** | Rich blacks, textured paper, dramatic chiaroscuro |
| **Technical Drawing** | Precise lines, annotations, architectural notation |
| **Collage** | Mixed media, cut-paper, materiality exploration |

#### Stylized
| Preset | Key Characteristics |
|--------|---------------------|
| **Vaporwave** | Retro-futuristic, neon, grids, nostalgic digital |
| **Noir** | Black and white, high contrast, shadows, mystery |
| **Pastel Dream** | Soft colors, gentle light, romantic haze |
| **Neo-Brutalist Graphic** | Bold graphics, limited palette, poster-like |
| **Retro-Futurism** | 1960s vision of future, optimistic, space-age |

---

## Preset Data Structure

### TypeScript Interface

```typescript
// Preset category enumeration
type PresetCategory = 'mood' | 'design' | 'style';

// Preset difficulty/complexity for UI organization
type PresetComplexity = 'basic' | 'advanced' | 'experimental';

// Core preset interface
interface StylePreset {
  // Identification
  id: string;                          // Unique identifier (uuid)
  name: string;                        // Display name
  category: PresetCategory;            // mood | design | style

  // Metadata
  description: string;                 // User-facing description
  tags: string[];                      // Searchable tags
  complexity: PresetComplexity;        // UI organization
  icon?: string;                       // Optional icon/emoji
  thumbnailUrl?: string;               // Preview image

  // Generation parameters (partial - merged with defaults)
  parameters: Partial<GenerationConfig>;

  // Prompt modifications
  promptPrefix?: string;               // Added before user prompt
  promptSuffix?: string;               // Added after user prompt
  promptReplacements?: {               // Find/replace in user prompt
    find: string;
    replace: string;
  }[];

  // Negative prompts (things to avoid)
  negativePrompt?: string;

  // Reference images (optional)
  referenceImages?: {
    url: string;
    description: string;
    weight?: number;                   // 0.0-1.0, influence strength
  }[];

  // Compatibility
  compatibleWith?: {                   // Presets that work well together
    mood?: string[];
    design?: string[];
    style?: string[];
  };
  incompatibleWith?: {                 // Presets that conflict
    mood?: string[];
    design?: string[];
    style?: string[];
  };

  // Source
  isBuiltIn: boolean;                  // System preset vs user-created
  createdBy?: string;                  // User ID for custom presets
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
  version: number;                     // For updates
}

// Combined preset selection
interface PresetSelection {
  mood?: string;                       // Preset ID
  design?: string;                     // Preset ID
  style?: string;                      // Preset ID
}

// Merged preset result (after combining selections)
interface MergedPresetConfig {
  parameters: GenerationConfig;
  promptPrefix: string;
  promptSuffix: string;
  negativePrompt: string;
  referenceImages: StoredImageMeta[];
  sourcePresets: PresetSelection;
}
```

### Example Preset: Zaha Hadid

```typescript
const zahaHadidPreset: StylePreset = {
  id: 'design-zaha-hadid',
  name: 'Zaha Hadid',
  category: 'design',
  description: 'Parametric, fluid forms with continuous surfaces and dramatic spatial experiences',
  tags: ['parametric', 'fluid', 'deconstructivist', 'organic', 'futuristic', 'curvilinear'],
  complexity: 'advanced',
  icon: '〰️',

  parameters: {
    temperature: 0.4,    // Some creativity for organic forms
    top_p: 0.85,
  },

  promptPrefix: `In the distinctive architectural language of Zaha Hadid: featuring fluid parametric forms,
continuous curved surfaces that flow seamlessly between floor, wall and ceiling, dramatic cantilevers
defying gravity, swooping organic geometries, high-contrast materials (white corian, black granite,
polished concrete), dynamic spatial sequences, and futuristic elegance. The space should feel like
a frozen moment of motion, with surfaces that appear to be in perpetual flow.`,

  promptSuffix: `Emphasize the characteristic Hadid vocabulary: striated patterns, gradient lighting
integrated into surfaces, seamless material transitions, and spaces that challenge traditional
architectural conventions while maintaining luxurious refinement.`,

  negativePrompt: 'orthogonal, rectangular, conventional, traditional, sharp corners, 90-degree angles, static, heavy, cluttered',

  compatibleWith: {
    mood: ['dramatic', 'monumental', 'futuristic'],
    style: ['archviz-standard', 'cinematic', 'editorial']
  },

  incompatibleWith: {
    design: ['tadao-ando', 'mies-van-der-rohe', 'japandi'],  // Conflicting formal languages
    style: ['pencil-sketch', 'watercolor']  // Hard to render curves accurately
  },

  isBuiltIn: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  version: 1
};
```

### Example Preset: Winter Morning

```typescript
const winterMorningPreset: StylePreset = {
  id: 'mood-winter-morning',
  name: 'Winter Morning',
  category: 'mood',
  description: 'Crisp cold morning light with frost and snow, creating a serene crystalline atmosphere',
  tags: ['winter', 'morning', 'cold', 'frost', 'snow', 'serene', 'blue'],
  complexity: 'basic',
  icon: '❄️',

  parameters: {
    temperature: 0.3,    // More deterministic for consistent mood
    top_p: 0.8,
  },

  promptPrefix: `Set during a crisp winter morning: low-angle cold sunlight casting long blue-tinged
shadows, frost crystallizing on surfaces, fresh snow on horizontal planes, muted cool color palette
with occasional warm interior glow, crystalline air quality with exceptional clarity, bare tree
silhouettes, and that particular stillness of a cold morning.`,

  promptSuffix: `The atmosphere should evoke the quiet beauty of winter: breath visible in cold air,
warmth visible through windows, the contrast between cold exterior and cozy interior, and the
pristine quality of early morning before the day begins.`,

  negativePrompt: 'summer, tropical, warm colors, green foliage, harsh sunlight, sweating, humid',

  compatibleWith: {
    design: ['tadao-ando', 'scandinavian', 'minimalist', 'japandi'],
    style: ['archviz-standard', 'cinematic', 'editorial', 'noir']
  },

  isBuiltIn: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  version: 1
};
```

---

## Determinism Strategy

### Parameter Locking

For deterministic outputs, presets should enforce:

```typescript
interface DeterministicConfig {
  // Core determinism parameters
  temperature: number;     // 0.1-0.3 for high determinism
  top_p: number;          // 0.7-0.85 for controlled variance

  // If API supports
  seed?: number;          // Exact reproduction

  // Prompt consistency
  promptPrefix: string;   // Always the same prefix
  promptSuffix: string;   // Always the same suffix
}
```

### Determinism Levels

| Level | Temperature | Top P | Use Case |
|-------|-------------|-------|----------|
| **Strict** | 0.1 | 0.7 | Exact reproduction needed |
| **Consistent** | 0.2-0.3 | 0.8 | Slight variation, same style |
| **Balanced** | 0.4-0.5 | 0.85 | Recognizable style, creative freedom |
| **Creative** | 0.6-0.8 | 0.9 | Style influence, high variation |

### Preset Override Behavior

When multiple presets are combined, parameters merge with priority:

```
Priority: Style > Design > Mood > User Config > Defaults
```

Example:
```typescript
// User has temperature: 0.7 in their config
// Mood preset has temperature: 0.3
// Design preset has temperature: 0.4
// Style preset has temperature: 0.2

// Final temperature = 0.2 (Style wins)
```

---

## Preset Combinations

### Combination Rules

1. **One per category**: Maximum one preset per category (mood, design, style)
2. **Compatibility check**: Warn (don't block) for incompatible combinations
3. **Prompt merging**: Concatenate in order: Mood prefix → Design prefix → Style prefix → User prompt → Style suffix → Design suffix → Mood suffix

### Merge Algorithm

```typescript
function mergePresets(
  selections: PresetSelection,
  userPrompt: string,
  userConfig: GenerationConfig
): MergedPresetConfig {

  const presets = {
    mood: selections.mood ? getPreset(selections.mood) : null,
    design: selections.design ? getPreset(selections.design) : null,
    style: selections.style ? getPreset(selections.style) : null,
  };

  // Merge parameters (style > design > mood > userConfig)
  const parameters = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    ...(presets.mood?.parameters || {}),
    ...(presets.design?.parameters || {}),
    ...(presets.style?.parameters || {}),
  };

  // Build prompt with layered prefixes/suffixes
  const promptParts = {
    prefix: [
      presets.mood?.promptPrefix,
      presets.design?.promptPrefix,
      presets.style?.promptPrefix,
    ].filter(Boolean).join('\n\n'),

    suffix: [
      presets.style?.promptSuffix,
      presets.design?.promptSuffix,
      presets.mood?.promptSuffix,
    ].filter(Boolean).join('\n\n'),
  };

  // Combine negative prompts
  const negativePrompt = [
    presets.mood?.negativePrompt,
    presets.design?.negativePrompt,
    presets.style?.negativePrompt,
  ].filter(Boolean).join(', ');

  // Collect reference images
  const referenceImages = [
    ...(presets.mood?.referenceImages || []),
    ...(presets.design?.referenceImages || []),
    ...(presets.style?.referenceImages || []),
  ];

  return {
    parameters,
    promptPrefix: promptParts.prefix,
    promptSuffix: promptParts.suffix,
    negativePrompt,
    referenceImages,
    sourcePresets: selections,
  };
}
```

### Compatibility Warnings

When users select incompatible presets, display a non-blocking warning:

```
⚠️ Compatibility Notice
"Zaha Hadid" (Design) may conflict with "Pencil Sketch" (Style).
Fluid parametric forms are difficult to represent in loose hand-drawn styles.
Result may be unpredictable. Continue anyway?
```

---

## Built-in Preset Library

### Initial Release Presets

#### Mood Presets (12 total)
- Winter Morning
- Summer Noon
- Autumn Dusk
- Spring Rain
- Mediterranean Sunset
- Nordic Twilight
- Melancholic
- Serene
- Dramatic
- Golden Hour
- Blue Hour
- Night Scene

#### Design Presets (20 total)
**By Architect:**
- Zaha Hadid
- Tadao Ando
- Frank Gehry
- Peter Zumthor
- Kengo Kuma
- SANAA
- Norman Foster
- Le Corbusier
- Mies van der Rohe
- Louis Kahn

**By Style:**
- Japandi
- Minimalist
- Industrial
- Brutalist
- Mid-Century Modern
- Scandinavian
- Mediterranean
- Biophilic
- Parametric
- Art Deco

#### Style Presets (10 total)
- ArchViz Standard
- Cinematic
- Editorial
- Pencil Sketch
- Watercolor
- Charcoal
- Technical Drawing
- Noir
- Pastel Dream
- Documentary

---

## User Interface Design

### Preset Selection Panel

Located in the left sidebar, below PromptPanel:

```
┌─────────────────────────────────────┐
│ STYLE PRESETS                    ⚙️ │
├─────────────────────────────────────┤
│                                     │
│ MOOD                          Clear │
│ ┌─────────────────────────────────┐ │
│ │ ❄️ Winter Morning            ▼ │ │
│ └─────────────────────────────────┘ │
│                                     │
│ DESIGN                        Clear │
│ ┌─────────────────────────────────┐ │
│ │ 〰️ Zaha Hadid                ▼ │ │
│ └─────────────────────────────────┘ │
│                                     │
│ STYLE                         Clear │
│ ┌─────────────────────────────────┐ │
│ │ 🎬 Cinematic                 ▼ │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Save as Combo] [Preview Prompt]    │
│                                     │
│ ─────────────────────────────────── │
│ Recent Combos                       │
│ • Winter + Ando + ArchViz           │
│ • Dramatic + Gehry + Cinematic      │
│ • Serene + Japandi + Watercolor     │
└─────────────────────────────────────┘
```

### Dropdown Preset Selector

When clicking a category dropdown:

```
┌─────────────────────────────────────┐
│ 🔍 Search presets...                │
├─────────────────────────────────────┤
│ BASIC                               │
│  ❄️ Winter Morning                  │
│  ☀️ Summer Noon                     │
│  🍂 Autumn Dusk                     │
│  🌧️ Spring Rain                     │
├─────────────────────────────────────┤
│ ADVANCED                            │
│  🌅 Mediterranean Sunset            │
│  🌌 Nordic Twilight                 │
│  😔 Melancholic                     │
│  🧘 Serene                          │
├─────────────────────────────────────┤
│ + Create Custom Preset...           │
└─────────────────────────────────────┘
```

### Preset Details Modal

When clicking the ⚙️ or hovering for details:

```
┌─────────────────────────────────────────────────────────────┐
│ Zaha Hadid                                              ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────┐  Parametric, fluid forms with continuous   │
│ │              │  surfaces and dramatic spatial experiences │
│ │  [Preview]   │                                            │
│ │              │  Category: Design                          │
│ │              │  Complexity: Advanced                      │
│ └──────────────┘                                            │
│                                                             │
│ TAGS                                                        │
│ ┌──────────┐ ┌────────┐ ┌─────────────────┐ ┌──────────┐   │
│ │parametric│ │ fluid  │ │ deconstructivist│ │ organic  │   │
│ └──────────┘ └────────┘ └─────────────────┘ └──────────┘   │
│                                                             │
│ PARAMETERS                                                  │
│ Temperature: 0.4  •  Top P: 0.85                           │
│                                                             │
│ COMPATIBLE WITH                                             │
│ Mood: Dramatic, Monumental, Futuristic                      │
│ Style: ArchViz Standard, Cinematic, Editorial               │
│                                                             │
│ PROMPT PREVIEW                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ In the distinctive architectural language of Zaha       │ │
│ │ Hadid: featuring fluid parametric forms, continuous     │ │
│ │ curved surfaces that flow seamlessly...                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Use Preset]  [Edit Copy]  [Delete]                        │
└─────────────────────────────────────────────────────────────┘
```

### Create/Edit Preset Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Create Custom Preset                                    ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Name                                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ My Studio Style                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Category                                                    │
│ ○ Mood    ● Design    ○ Style                              │
│                                                             │
│ Description                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Our signature residential style with warm materials...  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Prompt Prefix                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ In our studio's signature style: featuring...           │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Prompt Suffix                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Emphasize our characteristic use of...                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Parameters                                                  │
│ Temperature: [====●=====] 0.35                             │
│ Top P:       [======●===] 0.80                             │
│                                                             │
│ Tags (comma-separated)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ warm, residential, natural materials, studio            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Reference Images (Optional)                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │
│ │  +   │ │ img1 │ │ img2 │ │ img3 │                       │
│ └──────┘ └──────┘ └──────┘ └──────┘                       │
│                                                             │
│                        [Cancel]  [Save Preset]              │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### New Files to Create

```
components/
├── PresetPanel.tsx           # Main preset selection panel
├── PresetDropdown.tsx        # Category dropdown selector
├── PresetDetailsModal.tsx    # Preset info/preview modal
├── PresetEditorModal.tsx     # Create/edit preset modal
└── PresetComboSaver.tsx      # Save preset combinations

services/
└── presetsService.ts         # Preset CRUD and merging logic

utils/
└── presetUtils.ts            # Validation, export/import

data/
└── builtInPresets.ts         # Default preset library
```

### Type Definitions (types.ts additions)

```typescript
// Add to types.ts

export type PresetCategory = 'mood' | 'design' | 'style';
export type PresetComplexity = 'basic' | 'advanced' | 'experimental';

export interface StylePreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  tags: string[];
  complexity: PresetComplexity;
  icon?: string;
  thumbnailUrl?: string;
  parameters: Partial<GenerationConfig>;
  promptPrefix?: string;
  promptSuffix?: string;
  promptReplacements?: { find: string; replace: string }[];
  negativePrompt?: string;
  referenceImages?: {
    url: string;
    description: string;
    weight?: number;
  }[];
  compatibleWith?: {
    mood?: string[];
    design?: string[];
    style?: string[];
  };
  incompatibleWith?: {
    mood?: string[];
    design?: string[];
    style?: string[];
  };
  isBuiltIn: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PresetSelection {
  mood?: string;
  design?: string;
  style?: string;
}

export interface PresetCombo {
  id: string;
  name: string;
  selection: PresetSelection;
  createdAt: string;
}

export interface MergedPresetConfig {
  parameters: GenerationConfig;
  promptPrefix: string;
  promptSuffix: string;
  negativePrompt: string;
  referenceImages: StoredImageMeta[];
  sourcePresets: PresetSelection;
}
```

### Preset Service (presetsService.ts)

```typescript
// services/presetsService.ts

import { builtInPresets } from '../data/builtInPresets';

class PresetsService {
  private customPresets: StylePreset[] = [];
  private presetCombos: PresetCombo[] = [];

  // Load presets from storage
  async initialize(): Promise<void>;

  // Get all presets (built-in + custom)
  getAllPresets(): StylePreset[];

  // Get presets by category
  getPresetsByCategory(category: PresetCategory): StylePreset[];

  // Get single preset by ID
  getPreset(id: string): StylePreset | null;

  // CRUD for custom presets
  createPreset(preset: Omit<StylePreset, 'id' | 'createdAt' | 'updatedAt' | 'version'>): StylePreset;
  updatePreset(id: string, updates: Partial<StylePreset>): StylePreset;
  deletePreset(id: string): void;

  // Merge multiple presets into final config
  mergePresets(selections: PresetSelection, userPrompt: string, userConfig: GenerationConfig): MergedPresetConfig;

  // Check compatibility
  checkCompatibility(selections: PresetSelection): { compatible: boolean; warnings: string[] };

  // Preset combos
  saveCombos(combo: Omit<PresetCombo, 'id' | 'createdAt'>): PresetCombo;
  getCombos(): PresetCombo[];
  deleteCombos(id: string): void;

  // Export/Import
  exportPresets(presetIds: string[]): string; // JSON
  importPresets(json: string): StylePreset[];
}

export const presetsService = new PresetsService();
```

### Integration with MixboardView

```typescript
// In MixboardView.tsx

// Add state for preset selection
const [presetSelection, setPresetSelection] = useState<PresetSelection>({});

// Modify handleGenerate to use presets
const handleGenerate = async () => {
  // Get merged preset configuration
  const mergedConfig = presetsService.mergePresets(
    presetSelection,
    prompt,
    config
  );

  // Build final prompt with preset prefixes/suffixes
  const finalPrompt = [
    mergedConfig.promptPrefix,
    prompt,
    mergedConfig.promptSuffix,
  ].filter(Boolean).join('\n\n');

  // Use merged parameters
  const finalConfig = mergedConfig.parameters;

  // Include preset reference images
  const presetReferenceImages = mergedConfig.referenceImages;

  // Continue with generation...
};
```

---

## Storage & Persistence

### Storage Keys

```typescript
const STORAGE_KEYS = {
  CUSTOM_PRESETS: 'nano_custom_presets',
  PRESET_COMBOS: 'nano_preset_combos',
  RECENT_PRESETS: 'nano_recent_presets',
};
```

### Storage Format

```typescript
// Custom presets storage
interface CustomPresetsStorage {
  version: number;
  presets: StylePreset[];
  lastUpdated: string;
}

// Preset combos storage
interface PresetCombosStorage {
  version: number;
  combos: PresetCombo[];
  recentSelections: PresetSelection[]; // Last 10 used combinations
}
```

### Migration Strategy

When updating built-in presets:

1. Increment version number in preset
2. On load, compare versions
3. Update built-in presets while preserving user modifications
4. Never delete user custom presets

---

## Export/Import & Sharing

### Export Format

```json
{
  "version": "1.0",
  "exportedAt": "2024-01-15T10:30:00Z",
  "presets": [
    {
      "id": "custom-my-studio-style",
      "name": "My Studio Style",
      "category": "design",
      // ... full preset object
    }
  ]
}
```

### Import Validation

```typescript
function validatePresetImport(json: string): {
  valid: boolean;
  presets: StylePreset[];
  errors: string[];
} {
  // Parse JSON
  // Validate schema
  // Check for ID conflicts
  // Validate parameter ranges
  // Return validated presets or errors
}
```

### Sharing Options

1. **Copy as JSON**: Export single preset to clipboard
2. **Export File**: Download .json file with multiple presets
3. **Import File**: Upload .json file to import presets
4. **QR Code** (future): Share preset via QR code

---

## Future Considerations

### Phase 2 Features

1. **Preset Marketplace**: Community-shared presets
2. **AI-Generated Presets**: From reference images (see PERSONALIZED_PRESETS_ML_SYSTEM.md)
3. **Preset Versioning**: Track and rollback preset changes
4. **A/B Testing**: Compare results from different presets
5. **Preset Analytics**: Track which presets produce best results

### Performance Optimizations

1. **Lazy Loading**: Load preset details on demand
2. **Thumbnail Generation**: Pre-generate preset preview images
3. **Caching**: Cache merged configs for common combinations
4. **Background Processing**: Pre-compute reference image embeddings

---

## Appendix: Quick Reference Cards

### Common Architect Combinations

| Architect | Best Mood | Best Style | Result Character |
|-----------|-----------|------------|------------------|
| Zaha Hadid | Dramatic | Cinematic | Bold, futuristic |
| Tadao Ando | Serene | ArchViz | Meditative, precise |
| Kengo Kuma | Spring Rain | Editorial | Organic, delicate |
| SANAA | Overcast | ArchViz | Ethereal, minimal |
| Frank Gehry | Dramatic | Documentary | Sculptural, dynamic |

### Mood + Style Pairings

| Mood | Recommended Styles | Avoid |
|------|-------------------|-------|
| Winter Morning | Cinematic, Noir, ArchViz | Watercolor, Pastel |
| Golden Hour | Editorial, Cinematic, Documentary | Noir, Technical |
| Melancholic | Charcoal, Noir, Watercolor | Pastel, Retro |
| Dramatic | Cinematic, Noir, ArchViz | Pastel, Pencil Sketch |
