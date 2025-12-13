# Style Presets Implementation Guide

## Overview

This guide provides step-by-step implementation instructions for integrating the Style Presets system into the existing APP-for-NANO application. It covers both the immediate built-in presets feature and the groundwork for the ML-based personalized presets system.

---

## Table of Contents

1. [Implementation Priority](#implementation-priority)
2. [Phase 1: Built-in Presets](#phase-1-built-in-presets)
3. [Phase 2: Custom Presets](#phase-2-custom-presets)
4. [Phase 3: ML Integration](#phase-3-ml-integration)
5. [Code Examples](#code-examples)
6. [Testing Strategy](#testing-strategy)

---

## Implementation Priority

### Immediate (Phase 1)
1. Type definitions for presets
2. Built-in preset data files
3. Preset selection UI component
4. Prompt/parameter merging logic
5. Integration with generation flow

### Short-term (Phase 2)
1. Custom preset creation UI
2. Preset storage and persistence
3. Preset combination saving
4. Export/import functionality

### Long-term (Phase 3)
1. ML backend infrastructure
2. Cloud sync service
3. Training portal integration
4. Automatic preset updates

---

## Phase 1: Built-in Presets

### Step 1: Add Type Definitions

Add to `types.ts`:

```typescript
// Preset Types
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
  negativePrompt?: string;
  referenceImages?: PresetReferenceImage[];
  compatibleWith?: PresetCompatibility;
  incompatibleWith?: PresetCompatibility;
  isBuiltIn: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PresetReferenceImage {
  url: string;
  description: string;
  weight?: number;
}

export interface PresetCompatibility {
  mood?: string[];
  design?: string[];
  style?: string[];
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
  sourcePresets: PresetSelection;
}
```

### Step 2: Create Built-in Preset Data

Create `data/builtInPresets.ts`:

```typescript
import { StylePreset } from '../types';

// ==========================================
// MOOD PRESETS
// ==========================================

export const moodPresets: StylePreset[] = [
  {
    id: 'mood-winter-morning',
    name: 'Winter Morning',
    category: 'mood',
    description: 'Crisp cold morning light with frost and snow, serene crystalline atmosphere',
    tags: ['winter', 'morning', 'cold', 'frost', 'snow', 'serene'],
    complexity: 'basic',
    icon: '❄️',
    parameters: {
      temperature: 0.3,
      top_p: 0.8,
    },
    promptPrefix: `Set during a crisp winter morning: low-angle cold sunlight casting long blue-tinged shadows, frost crystallizing on surfaces, fresh snow on horizontal planes, muted cool color palette with occasional warm interior glow, crystalline air quality with exceptional clarity.`,
    promptSuffix: `The atmosphere should evoke the quiet beauty of winter: breath visible in cold air, warmth visible through windows, the contrast between cold exterior and cozy interior.`,
    negativePrompt: 'summer, tropical, warm colors, green foliage, harsh sunlight, humid',
    compatibleWith: {
      design: ['tadao-ando', 'scandinavian', 'minimalist', 'japandi'],
      style: ['archviz-standard', 'cinematic', 'noir']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'mood-golden-hour',
    name: 'Golden Hour',
    category: 'mood',
    description: 'Warm directional sunlight during the magic hour, long shadows, photographic ideal',
    tags: ['golden', 'sunset', 'warm', 'dramatic', 'shadows'],
    complexity: 'basic',
    icon: '🌅',
    parameters: {
      temperature: 0.35,
      top_p: 0.85,
    },
    promptPrefix: `During golden hour with warm, directional sunlight: honey-colored light streaming through windows, long dramatic shadows, surfaces glowing with warm amber tones, dust particles visible in light beams, rich contrast between lit and shadowed areas.`,
    promptSuffix: `Capture the magical quality of golden hour: the warmth, the depth, the way light transforms ordinary materials into something special.`,
    negativePrompt: 'overcast, flat lighting, harsh noon sun, cool tones, artificial light only',
    compatibleWith: {
      design: ['mediterranean', 'mid-century-modern', 'biophilic'],
      style: ['editorial', 'cinematic', 'archviz-standard']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'mood-dramatic',
    name: 'Dramatic',
    category: 'mood',
    description: 'High contrast, theatrical lighting, storm clouds, tension and power',
    tags: ['dramatic', 'contrast', 'storm', 'theatrical', 'moody'],
    complexity: 'advanced',
    icon: '⚡',
    parameters: {
      temperature: 0.4,
      top_p: 0.85,
    },
    promptPrefix: `With dramatic, theatrical atmosphere: high contrast lighting with deep shadows and bright highlights, storm clouds gathering in the sky, tension in the air, shafts of light breaking through darkness, powerful and imposing presence.`,
    promptSuffix: `The mood should be cinematic and powerful: emphasize contrast, depth, and the interplay of light and shadow.`,
    negativePrompt: 'flat, even lighting, calm, peaceful, bright, cheerful',
    compatibleWith: {
      design: ['zaha-hadid', 'brutalist', 'frank-gehry'],
      style: ['cinematic', 'noir', 'archviz-standard']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'mood-serene',
    name: 'Serene',
    category: 'mood',
    description: 'Balanced, calm atmosphere with zen-like stillness and harmony',
    tags: ['serene', 'calm', 'zen', 'peaceful', 'harmony'],
    complexity: 'basic',
    icon: '🧘',
    parameters: {
      temperature: 0.25,
      top_p: 0.75,
    },
    promptPrefix: `With serene, meditative atmosphere: balanced soft lighting, calm still water reflections, zen-like tranquility, harmonious proportions, gentle diffused light, sense of peace and contemplation.`,
    promptSuffix: `The space should invite quiet reflection: no visual noise, everything in its place, timeless calm.`,
    negativePrompt: 'busy, cluttered, harsh, dynamic, chaotic, bright colors',
    compatibleWith: {
      design: ['tadao-ando', 'japandi', 'minimalist', 'kengo-kuma'],
      style: ['archviz-standard', 'editorial']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'mood-melancholic',
    name: 'Melancholic',
    category: 'mood',
    description: 'Overcast, muted palette, solitary and contemplative atmosphere',
    tags: ['melancholic', 'overcast', 'muted', 'solitary', 'contemplative'],
    complexity: 'advanced',
    icon: '🌫️',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `With melancholic, contemplative atmosphere: overcast sky with soft diffused light, muted desaturated color palette, solitary emptiness, gentle rain or fog, sense of quiet longing and introspection.`,
    promptSuffix: `Evoke a poetic sadness: beautiful in its quiet isolation, spaces that invite reflection on absence and memory.`,
    negativePrompt: 'bright, cheerful, sunny, crowded, vibrant colors, energetic',
    compatibleWith: {
      design: ['brutalist', 'tadao-ando', 'minimalist'],
      style: ['noir', 'charcoal', 'documentary']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
];

// ==========================================
// DESIGN PRESETS (ARCHITECTS)
// ==========================================

export const designPresets: StylePreset[] = [
  {
    id: 'design-zaha-hadid',
    name: 'Zaha Hadid',
    category: 'design',
    description: 'Fluid parametric forms, continuous curved surfaces, dramatic spatial experiences',
    tags: ['parametric', 'fluid', 'futuristic', 'organic', 'curvilinear', 'deconstructivist'],
    complexity: 'advanced',
    icon: '〰️',
    parameters: {
      temperature: 0.4,
      top_p: 0.85,
    },
    promptPrefix: `In the distinctive architectural language of Zaha Hadid: featuring fluid parametric forms, continuous curved surfaces that flow seamlessly between floor, wall and ceiling, dramatic cantilevers defying gravity, swooping organic geometries, high-contrast materials (white corian, black granite, polished concrete), dynamic spatial sequences, and futuristic elegance. The space should feel like a frozen moment of motion, with surfaces that appear to be in perpetual flow.`,
    promptSuffix: `Emphasize the characteristic Hadid vocabulary: striated patterns, gradient lighting integrated into surfaces, seamless material transitions, and spaces that challenge traditional architectural conventions while maintaining luxurious refinement.`,
    negativePrompt: 'orthogonal, rectangular, conventional, traditional, sharp corners, 90-degree angles, static, heavy, cluttered',
    compatibleWith: {
      mood: ['dramatic', 'futuristic'],
      style: ['archviz-standard', 'cinematic', 'editorial']
    },
    incompatibleWith: {
      design: ['tadao-ando', 'mies-van-der-rohe', 'japandi'],
      style: ['pencil-sketch', 'watercolor']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-tadao-ando',
    name: 'Tadao Ando',
    category: 'design',
    description: 'Exposed concrete, precise geometry, controlled light, meditative minimalism',
    tags: ['concrete', 'minimal', 'japanese', 'geometric', 'meditative', 'light'],
    complexity: 'advanced',
    icon: '⬜',
    parameters: {
      temperature: 0.25,
      top_p: 0.75,
    },
    promptPrefix: `In the architectural language of Tadao Ando: featuring smooth exposed concrete walls with precise formwork patterns, geometric purity with clean intersecting planes, dramatic controlled light entering through calculated slots and openings, water features as meditative elements, minimal material palette (concrete, glass, water, wood), and profound sense of quiet contemplation. Spaces that frame nature and sky as art.`,
    promptSuffix: `Emphasize the Ando signature: the sensuality of concrete surfaces catching light, the spiritual quality of carefully framed views, the dialogue between solid mass and ethereal light, absolute precision in every detail.`,
    negativePrompt: 'ornate, decorative, colorful, busy, curved, organic, cluttered, warm colors',
    compatibleWith: {
      mood: ['serene', 'melancholic', 'winter-morning'],
      style: ['archviz-standard', 'editorial', 'noir']
    },
    incompatibleWith: {
      design: ['zaha-hadid', 'frank-gehry', 'art-deco'],
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-kengo-kuma',
    name: 'Kengo Kuma',
    category: 'design',
    description: 'Delicate wood lattices, layered transparency, nature integration, screens',
    tags: ['wood', 'lattice', 'japanese', 'nature', 'layered', 'delicate'],
    complexity: 'advanced',
    icon: '🎋',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `In the architectural language of Kengo Kuma: featuring delicate wooden lattice screens creating filtered light and layered transparency, integration with natural surroundings, use of local materials (wood, stone, bamboo), stacked and layered elements creating depth and texture, dissolution of boundaries between inside and outside, crafted details that honor traditional Japanese techniques while remaining contemporary.`,
    promptSuffix: `Emphasize the Kuma sensibility: the play of light through screens, the warmth of natural materials, the sense of being embraced by nature, weightlessness despite material presence.`,
    negativePrompt: 'heavy, solid, opaque, industrial, cold, metal, stark, minimalist without warmth',
    compatibleWith: {
      mood: ['serene', 'spring-rain', 'golden-hour'],
      style: ['archviz-standard', 'editorial', 'watercolor']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-frank-gehry',
    name: 'Frank Gehry',
    category: 'design',
    description: 'Deconstructed sculptural forms, titanium cladding, dynamic chaos',
    tags: ['deconstructivist', 'sculptural', 'titanium', 'dynamic', 'expressive'],
    complexity: 'experimental',
    icon: '🌀',
    parameters: {
      temperature: 0.5,
      top_p: 0.9,
    },
    promptPrefix: `In the architectural language of Frank Gehry: featuring dramatically deconstructed forms that appear to be in dynamic motion, billowing metallic surfaces (titanium, stainless steel), sculptural volumes that defy conventional building logic, controlled chaos with underlying structural rigor, play of reflections on curved metal surfaces, unexpected juxtapositions of materials.`,
    promptSuffix: `Capture the Gehry energy: buildings as sculpture, movement frozen in metal, the joy of architectural rebellion while maintaining inhabitable space.`,
    negativePrompt: 'conventional, orthogonal, symmetrical, traditional, static, predictable',
    compatibleWith: {
      mood: ['dramatic', 'golden-hour'],
      style: ['archviz-standard', 'cinematic', 'documentary']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-japandi',
    name: 'Japandi',
    category: 'design',
    description: 'Japanese-Scandinavian fusion, natural materials, functional minimalism',
    tags: ['japanese', 'scandinavian', 'minimal', 'natural', 'warm', 'crafted'],
    complexity: 'basic',
    icon: '🍃',
    parameters: {
      temperature: 0.3,
      top_p: 0.8,
    },
    promptPrefix: `In Japandi style, blending Japanese and Scandinavian design: featuring natural materials (light oak, pale ash, linen, clay), muted earth tones with occasional deep accents, functional minimalism with warmth, clean lines softened by organic textures, crafted objects with visible handwork, negative space as a design element, indoor plants as living sculpture.`,
    promptSuffix: `The space should feel calm yet warm: not sterile minimalism but lived-in simplicity, where every object has purpose and beauty, merging wabi-sabi imperfection with Scandinavian hygge comfort.`,
    negativePrompt: 'ornate, industrial, cold, synthetic materials, bright colors, cluttered, high-tech',
    compatibleWith: {
      mood: ['serene', 'winter-morning', 'golden-hour'],
      style: ['archviz-standard', 'editorial']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-minimalist',
    name: 'Minimalist',
    category: 'design',
    description: 'Reduction to essentials, white space, clean lines, hidden complexity',
    tags: ['minimal', 'white', 'clean', 'simple', 'essential'],
    complexity: 'basic',
    icon: '◻️',
    parameters: {
      temperature: 0.2,
      top_p: 0.7,
    },
    promptPrefix: `In minimalist architectural style: reduction to absolute essentials, dominant white and neutral palette, clean geometric lines, flush surfaces with hidden storage and mechanisms, carefully curated objects (few but perfect), abundant natural light, seamless material transitions, architecture as background for life.`,
    promptSuffix: `Less is more: every element must earn its place, negative space is as important as positive, the beauty of restraint and precision.`,
    negativePrompt: 'decorative, ornate, colorful, busy, textured, pattern, vintage, rustic',
    compatibleWith: {
      mood: ['serene', 'winter-morning'],
      style: ['archviz-standard', 'editorial', 'noir']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-brutalist',
    name: 'Brutalist',
    category: 'design',
    description: 'Raw concrete, bold geometric forms, honest materials, monolithic presence',
    tags: ['concrete', 'raw', 'bold', 'geometric', 'monolithic', 'honest'],
    complexity: 'advanced',
    icon: '🏛️',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `In Brutalist architectural style: raw exposed concrete (béton brut) with visible formwork textures, bold geometric massing, monolithic presence, honest expression of structure and materials, dramatic interplay of solid and void, powerful sculptural forms, minimal applied decoration, architecture as statement.`,
    promptSuffix: `Embrace the brutal honesty: the weight and texture of concrete, the drama of massive forms, the beauty found in rawness and structural truth.`,
    negativePrompt: 'delicate, refined, polished, colorful, ornate, light, airy, decorative',
    compatibleWith: {
      mood: ['dramatic', 'melancholic', 'winter-morning'],
      style: ['archviz-standard', 'noir', 'documentary']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-industrial',
    name: 'Industrial',
    category: 'design',
    description: 'Exposed structure, raw materials, factory aesthetics, metal and brick',
    tags: ['industrial', 'exposed', 'brick', 'metal', 'loft', 'raw'],
    complexity: 'basic',
    icon: '🏭',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `In industrial style: exposed structural elements (steel beams, columns, ductwork), raw brick walls, metal finishes (blackened steel, copper, iron), factory-style windows with black frames, concrete floors (polished or raw), vintage industrial lighting, open floor plans with high ceilings, honest materiality celebrating the building's bones.`,
    promptSuffix: `The space should feel converted rather than designed: authentic industrial character, patina of age, the romance of repurposed spaces.`,
    negativePrompt: 'refined, delicate, new, pristine, soft, traditional, ornate',
    compatibleWith: {
      mood: ['dramatic', 'golden-hour'],
      style: ['archviz-standard', 'documentary', 'editorial']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-biophilic',
    name: 'Biophilic',
    category: 'design',
    description: 'Living walls, abundant plants, organic forms, nature integration',
    tags: ['biophilic', 'plants', 'green', 'nature', 'organic', 'wellness'],
    complexity: 'basic',
    icon: '🌿',
    parameters: {
      temperature: 0.4,
      top_p: 0.85,
    },
    promptPrefix: `In biophilic design: abundant living plants integrated throughout (living walls, planters, hanging gardens), natural materials (wood, stone, water), organic flowing forms, maximum natural light, visual and physical connections to nature, natural patterns and textures, interior landscapes, the building as living ecosystem.`,
    promptSuffix: `Nature is not decoration but integral: plants as architecture, bringing the outside in, spaces that breathe and grow, architecture in service of wellbeing.`,
    negativePrompt: 'sterile, artificial, synthetic, stark, windowless, dead, clinical',
    compatibleWith: {
      mood: ['serene', 'golden-hour', 'spring-rain'],
      style: ['archviz-standard', 'editorial']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'design-mediterranean',
    name: 'Mediterranean',
    category: 'design',
    description: 'Whitewashed walls, terracotta, arches, courtyards, blue accents',
    tags: ['mediterranean', 'white', 'terracotta', 'arch', 'courtyard', 'warm'],
    complexity: 'basic',
    icon: '🏛️',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `In Mediterranean architectural style: whitewashed stucco walls, terracotta roof tiles and floor tiles, graceful arches and columns, interior courtyards with fountains, blue accents (doors, shutters, tiles), thick walls for thermal mass, deep shaded porticos, bougainvillea and olive trees, relaxed indoor-outdoor living.`,
    promptSuffix: `Capture the Mediterranean spirit: the play of strong sunlight on white walls, the cool refuge of shaded spaces, the timeless elegance of classical forms adapted for warm climates.`,
    negativePrompt: 'modern, industrial, cold, minimal, stark, northern, dark',
    compatibleWith: {
      mood: ['golden-hour', 'mediterranean-sunset'],
      style: ['archviz-standard', 'editorial', 'watercolor']
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
];

// ==========================================
// STYLE PRESETS (RENDERING)
// ==========================================

export const stylePresets: StylePreset[] = [
  {
    id: 'style-archviz-standard',
    name: 'ArchViz Standard',
    category: 'style',
    description: 'Professional architectural visualization, accurate materials, clean composition',
    tags: ['archviz', 'professional', 'realistic', 'clean', 'accurate'],
    complexity: 'basic',
    icon: '📐',
    parameters: {
      temperature: 0.3,
      top_p: 0.8,
    },
    promptPrefix: `Rendered as professional architectural visualization: photorealistic materials with accurate physical properties, clean crisp composition, correct architectural scale and proportions, professional photography-style framing, attention to material authenticity (wood grain, concrete texture, glass reflections).`,
    promptSuffix: `The render should meet professional ArchViz standards: publication-ready quality, accurate light behavior, believable materiality, architectural precision.`,
    negativePrompt: 'artistic, stylized, illustrated, sketch, cartoon, unrealistic proportions',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-cinematic',
    name: 'Cinematic',
    category: 'style',
    description: 'Film color grading, dramatic framing, anamorphic lens effects',
    tags: ['cinematic', 'film', 'dramatic', 'graded', 'movie'],
    complexity: 'basic',
    icon: '🎬',
    parameters: {
      temperature: 0.4,
      top_p: 0.85,
    },
    promptPrefix: `Rendered with cinematic quality: film-style color grading with rich shadows and controlled highlights, dramatic composition following cinematographic principles, subtle lens effects (anamorphic flare, depth of field, subtle vignette), movie-quality atmosphere.`,
    promptSuffix: `Like a frame from a beautifully photographed film: intentional color story, emotional lighting, the kind of image that would work as a still from a prestige production.`,
    negativePrompt: 'flat, documentary, harsh, overexposed, amateur photography',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-editorial',
    name: 'Editorial',
    category: 'style',
    description: 'Magazine-quality, styled staging, aspirational lifestyle aesthetic',
    tags: ['editorial', 'magazine', 'styled', 'aspirational', 'luxury'],
    complexity: 'basic',
    icon: '📰',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `Styled for editorial publication: magazine-quality composition, carefully curated objects and staging, aspirational lifestyle aesthetic, perfect balance of designed and lived-in, bright but sophisticated lighting, attention to lifestyle storytelling.`,
    promptSuffix: `Ready for Architectural Digest: styled but not sterile, luxurious but approachable, the kind of space readers aspire to inhabit.`,
    negativePrompt: 'empty, clinical, dark, moody, unstaged, messy',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-pencil-sketch',
    name: 'Pencil Sketch',
    category: 'style',
    description: 'Hand-drawn line work, gestural marks, design process aesthetic',
    tags: ['sketch', 'pencil', 'hand-drawn', 'line', 'architectural'],
    complexity: 'basic',
    icon: '✏️',
    parameters: {
      temperature: 0.5,
      top_p: 0.9,
    },
    promptPrefix: `Rendered as an architectural pencil sketch: hand-drawn line work with varying line weights, gestural marks showing construction lines and design thinking, subtle shading with hatching and cross-hatching, white paper showing through, the aesthetic of a designer's sketchbook.`,
    promptSuffix: `Like a beautiful architect's sketch: confident lines, thoughtful composition, the romance of hand-drawing, design process made visible.`,
    negativePrompt: 'photorealistic, rendered, colored, polished, digital',
    incompatibleWith: {
      design: ['zaha-hadid', 'frank-gehry']  // Complex curves hard to sketch
    },
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-watercolor',
    name: 'Watercolor',
    category: 'style',
    description: 'Soft washes, bleeding edges, artistic interpretation',
    tags: ['watercolor', 'artistic', 'wash', 'soft', 'painterly'],
    complexity: 'basic',
    icon: '🎨',
    parameters: {
      temperature: 0.5,
      top_p: 0.9,
    },
    promptPrefix: `Rendered as architectural watercolor: soft color washes with transparent layers, bleeding edges where colors meet, visible paper texture, loose brushwork suggesting rather than defining details, luminous white paper preserved for highlights.`,
    promptSuffix: `The romantic quality of watercolor: soft, atmospheric, interpretive, the building as a dream rather than documentation.`,
    negativePrompt: 'sharp, photorealistic, hard edges, digital, precise',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-noir',
    name: 'Noir',
    category: 'style',
    description: 'Black and white, high contrast, shadows, mystery and drama',
    tags: ['noir', 'black-white', 'contrast', 'shadow', 'dramatic'],
    complexity: 'advanced',
    icon: '🖤',
    parameters: {
      temperature: 0.35,
      top_p: 0.8,
    },
    promptPrefix: `Rendered in noir style: black and white with high contrast, deep rich blacks and bright whites, dramatic shadows creating mystery, film noir lighting with strong directional sources, architectural forms revealed through light and shadow.`,
    promptSuffix: `Capture noir drama: the romance of shadows, architecture as stage for light, mystery and atmosphere, timeless black and white sophistication.`,
    negativePrompt: 'colorful, flat, evenly lit, bright, cheerful',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-documentary',
    name: 'Documentary',
    category: 'style',
    description: 'Authentic, lived-in, realistic with natural imperfections',
    tags: ['documentary', 'authentic', 'realistic', 'lived-in', 'honest'],
    complexity: 'basic',
    icon: '📷',
    parameters: {
      temperature: 0.4,
      top_p: 0.85,
    },
    promptPrefix: `Rendered with documentary authenticity: realistic lived-in quality with signs of habitation, natural imperfections, honest lighting conditions (not idealized), authentic material aging and wear, the space as it actually exists rather than as styled.`,
    promptSuffix: `Real architecture in real conditions: not a sales image but documentation, the beauty of everyday occupation, architecture tested by life.`,
    negativePrompt: 'styled, perfect, sterile, idealized, magazine-ready',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
  {
    id: 'style-charcoal',
    name: 'Charcoal',
    category: 'style',
    description: 'Rich blacks, textured paper, dramatic chiaroscuro drawing',
    tags: ['charcoal', 'drawing', 'dramatic', 'texture', 'artistic'],
    complexity: 'advanced',
    icon: '🖌️',
    parameters: {
      temperature: 0.45,
      top_p: 0.85,
    },
    promptPrefix: `Rendered as charcoal drawing: rich velvety blacks, visible textured paper grain, dramatic chiaroscuro lighting, smudged soft transitions, bold gestural marks, the atmosphere of a master architectural drawing.`,
    promptSuffix: `The drama of charcoal: dense shadows, luminous highlights, texture and depth, architectural forms emerging from darkness.`,
    negativePrompt: 'colorful, sharp, digital, clean, polished',
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  },
];

// Combined export
export const builtInPresets: StylePreset[] = [
  ...moodPresets,
  ...designPresets,
  ...stylePresets,
];

// Helper to get presets by category
export const getPresetsByCategory = (category: PresetCategory): StylePreset[] => {
  return builtInPresets.filter(p => p.category === category);
};

// Helper to get preset by ID
export const getPresetById = (id: string): StylePreset | undefined => {
  return builtInPresets.find(p => p.id === id);
};
```

### Step 3: Create Preset Service

Create `services/presetsService.ts`:

```typescript
import { StylePreset, PresetSelection, MergedPresetConfig, GenerationConfig, PresetCombo, PresetCategory } from '../types';
import { builtInPresets, getPresetById, getPresetsByCategory } from '../data/builtInPresets';

const STORAGE_KEYS = {
  CUSTOM_PRESETS: 'nano_custom_presets',
  PRESET_COMBOS: 'nano_preset_combos',
  RECENT_SELECTIONS: 'nano_recent_preset_selections',
};

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  top_p: 0.95,
  aspect_ratio: '1:1',
  image_size: '1K',
  safety_filter: 'medium',
  model: 'gemini-2.5-flash-image'
};

class PresetsService {
  private customPresets: StylePreset[] = [];
  private presetCombos: PresetCombo[] = [];
  private recentSelections: PresetSelection[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const customPresetsJson = localStorage.getItem(STORAGE_KEYS.CUSTOM_PRESETS);
      if (customPresetsJson) {
        this.customPresets = JSON.parse(customPresetsJson);
      }

      const combosJson = localStorage.getItem(STORAGE_KEYS.PRESET_COMBOS);
      if (combosJson) {
        this.presetCombos = JSON.parse(combosJson);
      }

      const recentJson = localStorage.getItem(STORAGE_KEYS.RECENT_SELECTIONS);
      if (recentJson) {
        this.recentSelections = JSON.parse(recentJson);
      }
    } catch (error) {
      console.error('Failed to load presets from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PRESETS, JSON.stringify(this.customPresets));
      localStorage.setItem(STORAGE_KEYS.PRESET_COMBOS, JSON.stringify(this.presetCombos));
      localStorage.setItem(STORAGE_KEYS.RECENT_SELECTIONS, JSON.stringify(this.recentSelections));
    } catch (error) {
      console.error('Failed to save presets to storage:', error);
    }
  }

  // Get all presets (built-in + custom)
  getAllPresets(): StylePreset[] {
    return [...builtInPresets, ...this.customPresets];
  }

  // Get presets by category
  getPresetsByCategory(category: PresetCategory): StylePreset[] {
    const builtIn = getPresetsByCategory(category);
    const custom = this.customPresets.filter(p => p.category === category);
    return [...builtIn, ...custom];
  }

  // Get single preset by ID
  getPreset(id: string): StylePreset | null {
    const builtIn = getPresetById(id);
    if (builtIn) return builtIn;
    return this.customPresets.find(p => p.id === id) || null;
  }

  // Create custom preset
  createPreset(preset: Omit<StylePreset, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isBuiltIn'>): StylePreset {
    const newPreset: StylePreset = {
      ...preset,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    this.customPresets.push(newPreset);
    this.saveToStorage();
    return newPreset;
  }

  // Update custom preset
  updatePreset(id: string, updates: Partial<StylePreset>): StylePreset | null {
    const index = this.customPresets.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.customPresets[index] = {
      ...this.customPresets[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      version: this.customPresets[index].version + 1,
    };
    this.saveToStorage();
    return this.customPresets[index];
  }

  // Delete custom preset
  deletePreset(id: string): boolean {
    const index = this.customPresets.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.customPresets.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  // Merge multiple presets into final config
  mergePresets(
    selections: PresetSelection,
    userConfig: GenerationConfig
  ): MergedPresetConfig {
    const presets = {
      mood: selections.mood ? this.getPreset(selections.mood) : null,
      design: selections.design ? this.getPreset(selections.design) : null,
      style: selections.style ? this.getPreset(selections.style) : null,
    };

    // Merge parameters (priority: style > design > mood > userConfig > defaults)
    const parameters: GenerationConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      ...(presets.mood?.parameters || {}),
      ...(presets.design?.parameters || {}),
      ...(presets.style?.parameters || {}),
    };

    // Build prompt prefix (mood → design → style)
    const promptPrefix = [
      presets.mood?.promptPrefix,
      presets.design?.promptPrefix,
      presets.style?.promptPrefix,
    ].filter(Boolean).join('\n\n');

    // Build prompt suffix (style → design → mood)
    const promptSuffix = [
      presets.style?.promptSuffix,
      presets.design?.promptSuffix,
      presets.mood?.promptSuffix,
    ].filter(Boolean).join('\n\n');

    // Combine negative prompts
    const negativePrompt = [
      presets.mood?.negativePrompt,
      presets.design?.negativePrompt,
      presets.style?.negativePrompt,
    ].filter(Boolean).join(', ');

    // Track selection
    this.trackSelection(selections);

    return {
      parameters,
      promptPrefix,
      promptSuffix,
      negativePrompt,
      sourcePresets: selections,
    };
  }

  // Check preset compatibility
  checkCompatibility(selections: PresetSelection): { compatible: boolean; warnings: string[] } {
    const warnings: string[] = [];

    const presets = {
      mood: selections.mood ? this.getPreset(selections.mood) : null,
      design: selections.design ? this.getPreset(selections.design) : null,
      style: selections.style ? this.getPreset(selections.style) : null,
    };

    // Check design vs style compatibility
    if (presets.design && presets.style) {
      if (presets.design.incompatibleWith?.style?.includes(presets.style.id)) {
        warnings.push(`"${presets.design.name}" may conflict with "${presets.style.name}" rendering style.`);
      }
      if (presets.style.incompatibleWith?.design?.includes(presets.design.id)) {
        warnings.push(`"${presets.style.name}" style may not work well with "${presets.design.name}" architecture.`);
      }
    }

    // Check mood vs design compatibility
    if (presets.mood && presets.design) {
      if (presets.design.incompatibleWith?.mood?.includes(presets.mood.id)) {
        warnings.push(`"${presets.design.name}" typically doesn't match "${presets.mood.name}" mood.`);
      }
    }

    return {
      compatible: warnings.length === 0,
      warnings,
    };
  }

  // Track recent selection
  private trackSelection(selection: PresetSelection): void {
    // Don't track empty selections
    if (!selection.mood && !selection.design && !selection.style) return;

    // Remove duplicates
    this.recentSelections = this.recentSelections.filter(
      s => !(s.mood === selection.mood && s.design === selection.design && s.style === selection.style)
    );

    // Add to front
    this.recentSelections.unshift(selection);

    // Keep only last 10
    this.recentSelections = this.recentSelections.slice(0, 10);

    this.saveToStorage();
  }

  // Get recent selections
  getRecentSelections(): PresetSelection[] {
    return this.recentSelections;
  }

  // Save preset combo
  saveCombo(name: string, selection: PresetSelection): PresetCombo {
    const combo: PresetCombo = {
      id: `combo-${Date.now()}`,
      name,
      selection,
      createdAt: new Date().toISOString(),
    };
    this.presetCombos.push(combo);
    this.saveToStorage();
    return combo;
  }

  // Get all combos
  getCombos(): PresetCombo[] {
    return this.presetCombos;
  }

  // Delete combo
  deleteCombo(id: string): boolean {
    const index = this.presetCombos.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.presetCombos.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  // Export presets
  exportPresets(presetIds: string[]): string {
    const presets = presetIds
      .map(id => this.customPresets.find(p => p.id === id))
      .filter(Boolean);

    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      presets,
    }, null, 2);
  }

  // Import presets
  importPresets(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(json);

      if (!data.presets || !Array.isArray(data.presets)) {
        errors.push('Invalid preset file format');
        return { imported, errors };
      }

      for (const preset of data.presets) {
        // Validate required fields
        if (!preset.name || !preset.category) {
          errors.push(`Skipped preset: missing required fields`);
          continue;
        }

        // Create new preset with new ID
        this.createPreset({
          ...preset,
          name: `${preset.name} (Imported)`,
        });
        imported++;
      }
    } catch (e) {
      errors.push('Failed to parse preset file');
    }

    return { imported, errors };
  }
}

export const presetsService = new PresetsService();
```

### Step 4: Integration Points

In `MixboardView.tsx`, add:

```typescript
// Add imports
import { presetsService } from '../services/presetsService';
import { PresetSelection, MergedPresetConfig } from '../types';

// Add state
const [presetSelection, setPresetSelection] = useState<PresetSelection>({});
const [mergedPresetConfig, setMergedPresetConfig] = useState<MergedPresetConfig | null>(null);

// Update merged config when selection changes
useEffect(() => {
  const merged = presetsService.mergePresets(presetSelection, config);
  setMergedPresetConfig(merged);
}, [presetSelection, config]);

// Modify handleGenerate to use presets
const handleGenerate = async () => {
  // ... existing validation ...

  // Apply preset modifications to prompt
  let finalPrompt = prompt;
  if (mergedPresetConfig) {
    const parts = [];
    if (mergedPresetConfig.promptPrefix) {
      parts.push(mergedPresetConfig.promptPrefix);
    }
    parts.push(prompt);
    if (mergedPresetConfig.promptSuffix) {
      parts.push(mergedPresetConfig.promptSuffix);
    }
    finalPrompt = parts.join('\n\n');
  }

  // Use merged parameters
  const finalConfig = mergedPresetConfig?.parameters || config;

  // Continue with generation using finalPrompt and finalConfig...
};
```

---

## Code Examples

### PresetPanel Component

```typescript
// components/PresetPanel.tsx

import React, { useState } from 'react';
import { Sliders, ChevronDown, X, Save, Eye } from 'lucide-react';
import { presetsService } from '../services/presetsService';
import { PresetSelection, StylePreset, PresetCategory } from '../types';

interface PresetPanelProps {
  selection: PresetSelection;
  onSelectionChange: (selection: PresetSelection) => void;
}

export const PresetPanel: React.FC<PresetPanelProps> = ({
  selection,
  onSelectionChange,
}) => {
  const [expandedCategory, setExpandedCategory] = useState<PresetCategory | null>(null);

  const categories: { key: PresetCategory; label: string }[] = [
    { key: 'mood', label: 'Mood' },
    { key: 'design', label: 'Design' },
    { key: 'style', label: 'Style' },
  ];

  const handlePresetSelect = (category: PresetCategory, presetId: string | undefined) => {
    onSelectionChange({
      ...selection,
      [category]: presetId,
    });
    setExpandedCategory(null);
  };

  const handleClear = (category: PresetCategory) => {
    const newSelection = { ...selection };
    delete newSelection[category];
    onSelectionChange(newSelection);
  };

  const getSelectedPreset = (category: PresetCategory): StylePreset | null => {
    const id = selection[category];
    return id ? presetsService.getPreset(id) : null;
  };

  const compatibility = presetsService.checkCompatibility(selection);

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Style Presets
        </h3>
      </div>

      {/* Category Selectors */}
      {categories.map(({ key, label }) => {
        const selectedPreset = getSelectedPreset(key);
        const presets = presetsService.getPresetsByCategory(key);

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400 uppercase tracking-wide">
                {label}
              </label>
              {selectedPreset && (
                <button
                  onClick={() => handleClear(key)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setExpandedCategory(expandedCategory === key ? null : key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                  selectedPreset
                    ? 'bg-blue-900/30 border-blue-600 text-blue-300'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className="flex items-center gap-2">
                  {selectedPreset?.icon && <span>{selectedPreset.icon}</span>}
                  <span>{selectedPreset?.name || `Select ${label}...`}</span>
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${
                  expandedCategory === key ? 'rotate-180' : ''
                }`} />
              </button>

              {/* Dropdown */}
              {expandedCategory === key && (
                <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {/* None option */}
                  <button
                    onClick={() => handlePresetSelect(key, undefined)}
                    className="w-full px-3 py-2 text-left text-gray-400 hover:bg-gray-600 border-b border-gray-600"
                  >
                    None
                  </button>

                  {/* Basic presets */}
                  <div className="px-2 py-1 text-xs text-gray-500 uppercase bg-gray-750">
                    Basic
                  </div>
                  {presets
                    .filter(p => p.complexity === 'basic')
                    .map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetSelect(key, preset.id)}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-600 flex items-center gap-2 ${
                          selection[key] === preset.id ? 'bg-blue-900/30 text-blue-300' : 'text-gray-200'
                        }`}
                      >
                        {preset.icon && <span>{preset.icon}</span>}
                        <span>{preset.name}</span>
                      </button>
                    ))}

                  {/* Advanced presets */}
                  <div className="px-2 py-1 text-xs text-gray-500 uppercase bg-gray-750">
                    Advanced
                  </div>
                  {presets
                    .filter(p => p.complexity === 'advanced')
                    .map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetSelect(key, preset.id)}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-600 flex items-center gap-2 ${
                          selection[key] === preset.id ? 'bg-blue-900/30 text-blue-300' : 'text-gray-200'
                        }`}
                      >
                        {preset.icon && <span>{preset.icon}</span>}
                        <span>{preset.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Compatibility Warnings */}
      {!compatibility.compatible && (
        <div className="p-2 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <p className="text-xs text-yellow-400">
            {compatibility.warnings[0]}
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <button className="flex-1 text-xs py-1.5 px-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center gap-1">
          <Save className="w-3 h-3" />
          Save Combo
        </button>
        <button className="flex-1 text-xs py-1.5 px-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center gap-1">
          <Eye className="w-3 h-3" />
          Preview
        </button>
      </div>
    </div>
  );
};
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/presetsService.test.ts

describe('PresetsService', () => {
  describe('mergePresets', () => {
    it('should merge mood and design presets correctly', () => {
      const selection = {
        mood: 'mood-winter-morning',
        design: 'design-tadao-ando',
      };
      const config = { temperature: 0.7, top_p: 0.95 };

      const merged = presetsService.mergePresets(selection, config);

      // Design preset should override mood for temperature
      expect(merged.parameters.temperature).toBe(0.25); // Tadao Ando's value
      expect(merged.promptPrefix).toContain('winter morning');
      expect(merged.promptPrefix).toContain('Tadao Ando');
    });

    it('should apply style preset parameters last', () => {
      const selection = {
        mood: 'mood-dramatic',
        style: 'style-cinematic',
      };

      const merged = presetsService.mergePresets(selection, {});

      // Style should win
      expect(merged.parameters.temperature).toBe(0.4); // Cinematic's value
    });
  });

  describe('checkCompatibility', () => {
    it('should warn about incompatible presets', () => {
      const selection = {
        design: 'design-zaha-hadid',
        style: 'style-pencil-sketch',
      };

      const result = presetsService.checkCompatibility(selection);

      expect(result.compatible).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/presetIntegration.test.ts

describe('Preset Integration', () => {
  it('should generate with preset-modified prompt', async () => {
    // Setup
    const selection = { design: 'design-japandi' };
    const userPrompt = 'a living room';

    // Merge
    const merged = presetsService.mergePresets(selection, {});

    // Build final prompt
    const finalPrompt = [
      merged.promptPrefix,
      userPrompt,
      merged.promptSuffix,
    ].filter(Boolean).join('\n\n');

    // Verify
    expect(finalPrompt).toContain('Japandi');
    expect(finalPrompt).toContain('living room');
    expect(finalPrompt).toContain('natural materials');
  });
});
```

---

## Summary

This implementation guide provides:

1. **Type definitions** for the preset system
2. **Built-in preset data** with 20+ architectural presets
3. **Preset service** for CRUD operations and merging
4. **UI component example** for preset selection
5. **Integration points** with the existing generation flow
6. **Testing strategy** for validation

The system is designed to be:
- **Extensible**: Easy to add new presets
- **Combinable**: Mix mood + design + style
- **Deterministic**: Locked parameters for consistent results
- **User-friendly**: Clear UI with compatibility warnings
