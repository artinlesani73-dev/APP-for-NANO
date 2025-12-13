# Personalized Presets: ML-Based Style Learning System

## Executive Summary

This document outlines the architecture for a machine learning system that creates personalized architectural visualization presets from studio render datasets. The system learns the distinctive style characteristics of a firm's work—including material choices, lighting preferences, color palettes, spatial proportions, and compositional patterns—and encodes them into reusable presets.

**Key Capabilities:**
- Learn from batches of 50-500+ studio renders
- Extract multi-dimensional style signatures
- Generate deterministic presets that reproduce the learned style
- Update continuously with new renders
- Support multiple style variants per studio

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Options Analysis](#architecture-options-analysis)
3. [Recommended Architecture](#recommended-architecture)
4. [Data Pipeline](#data-pipeline)
5. [Style Extraction Models](#style-extraction-models)
6. [Preset Generation Engine](#preset-generation-engine)
7. [Training Infrastructure](#training-infrastructure)
8. [API Design](#api-design)
9. [Update Mechanism](#update-mechanism)
10. [Deployment Strategy](#deployment-strategy)
11. [Cost Analysis](#cost-analysis)
12. [Implementation Phases](#implementation-phases)

---

## System Overview

### The Challenge

Creating an architectural preset manually requires:
1. Deep understanding of a studio's design language
2. Ability to articulate style in text form (prompts)
3. Trial and error to find optimal parameters
4. Constant refinement as the model evolves

**The ML solution** automates this by:
- Analyzing large datasets of studio renders
- Extracting implicit style patterns
- Generating optimized prompts and parameters
- Continuously improving with new data

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   Studio Renders    ──►   Style Analysis   ──►   Preset Generation   ──►  App  │
│   (50-500+ images)        (ML Pipeline)          (Prompt + Params)             │
│                                                                                 │
│   ┌───────────┐          ┌────────────────┐      ┌────────────────┐            │
│   │           │          │ Vision Models  │      │ Optimized      │            │
│   │ Training  │    ──►   │ + Clustering   │  ──► │ Prompt Text    │            │
│   │ Dataset   │          │ + LLM Analysis │      │ + Parameters   │            │
│   │           │          │                │      │ + Ref Images   │            │
│   └───────────┘          └────────────────┘      └────────────────┘            │
│                                                                                 │
│                    Updateable Pipeline (Add new renders anytime)               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Options Analysis

### Option 1: Fine-Tuned Vision Model

**Approach:** Fine-tune a vision model (CLIP, SigLIP) on studio renders to create style embeddings.

| Aspect | Details |
|--------|---------|
| **Pros** | Most accurate style capture, learns subtle patterns |
| **Cons** | Requires significant compute, complex training pipeline |
| **Data Needed** | 500+ images per style |
| **Compute** | GPU cluster, days of training |
| **Cost** | High ($500-5000+ per style) |
| **Updateability** | Requires retraining (expensive) |

**Verdict:** Overkill for most use cases. Reserved for enterprise clients.

---

### Option 2: Embedding Clustering + LLM Description

**Approach:** Use pre-trained vision models to extract embeddings, cluster similar images, then use an LLM to describe the style patterns.

| Aspect | Details |
|--------|---------|
| **Pros** | No training needed, leverages existing models, fast |
| **Cons** | Less precise than fine-tuning |
| **Data Needed** | 50-200 images per style |
| **Compute** | API calls only, no training |
| **Cost** | Low ($5-50 per style) |
| **Updateability** | Easy (re-run analysis) |

**Verdict:** Best balance of quality and practicality. **RECOMMENDED.**

---

### Option 3: Multimodal RAG System

**Approach:** Store render embeddings in a vector database, retrieve similar images during generation, use retrieved context to guide output.

| Aspect | Details |
|--------|---------|
| **Pros** | Dynamic, no preset generation needed |
| **Cons** | Requires runtime retrieval, less deterministic |
| **Data Needed** | 100+ images per style |
| **Compute** | Vector DB infrastructure |
| **Cost** | Medium (infrastructure + API) |
| **Updateability** | Instant (add to database) |

**Verdict:** Good for dynamic needs but less deterministic than static presets.

---

### Option 4: LoRA/Adapter Fine-Tuning

**Approach:** Train lightweight LoRA adapters on image generation models using studio renders.

| Aspect | Details |
|--------|---------|
| **Pros** | Direct style control in generation |
| **Cons** | Requires access to base model, complex deployment |
| **Data Needed** | 200-1000 images |
| **Compute** | GPU training |
| **Cost** | Medium-High ($100-500) |
| **Updateability** | Requires retraining |

**Verdict:** Not applicable since we use Gemini API (no LoRA support).

---

### Decision Matrix

| Criterion | Option 1 | Option 2 | Option 3 | Option 4 |
|-----------|----------|----------|----------|----------|
| Implementation Complexity | High | Low | Medium | High |
| Cost per Style | High | Low | Medium | Medium |
| Accuracy | Highest | High | Medium | High |
| Updateability | Poor | Good | Excellent | Poor |
| Determinism | High | High | Medium | High |
| Time to First Preset | Weeks | Hours | Days | Days |

**Winner: Option 2 (Embedding Clustering + LLM Description)**

---

## Recommended Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PERSONALIZED PRESET SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐                          │
│  │                     │      │                     │                          │
│  │   Image Upload      │      │   Analysis Service  │                          │
│  │   Service           │─────►│   (Python/FastAPI)  │                          │
│  │                     │      │                     │                          │
│  │   • Validation      │      │   • CLIP Embeddings │                          │
│  │   • Preprocessing   │      │   • Clustering      │                          │
│  │   • S3 Storage      │      │   • LLM Analysis    │                          │
│  │                     │      │                     │                          │
│  └─────────────────────┘      └──────────┬──────────┘                          │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────┐      ┌─────────────────────┐                          │
│  │                     │      │                     │                          │
│  │   Preset Generator  │◄─────│   Style Database    │                          │
│  │                     │      │   (PostgreSQL)      │                          │
│  │   • Prompt Builder  │      │                     │                          │
│  │   • Param Optimizer │      │   • Style Profiles  │                          │
│  │   • Reference Select│      │   • Embeddings      │                          │
│  │                     │      │   • Generated Presets│                          │
│  └──────────┬──────────┘      └─────────────────────┘                          │
│             │                                                                   │
│             ▼                                                                   │
│  ┌─────────────────────┐      ┌─────────────────────┐                          │
│  │                     │      │                     │                          │
│  │   Preset API        │─────►│   Desktop App       │                          │
│  │   (REST/GraphQL)    │      │   (Electron)        │                          │
│  │                     │      │                     │                          │
│  └─────────────────────┘      └─────────────────────┘                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Backend API** | Python + FastAPI | ML ecosystem, async support |
| **Embedding Model** | OpenAI CLIP / Google ViT | Pre-trained, high quality |
| **Clustering** | HDBSCAN + UMAP | Robust clustering, good for visual data |
| **LLM Analysis** | GPT-4 Vision / Claude | Multimodal understanding |
| **Vector Storage** | Pinecone / Qdrant | Efficient similarity search |
| **Database** | PostgreSQL + pgvector | Structured data + embeddings |
| **File Storage** | AWS S3 / GCS | Scalable image storage |
| **Task Queue** | Celery + Redis | Async processing |
| **Deployment** | Docker + Kubernetes | Scalable, portable |

---

## Data Pipeline

### Stage 1: Image Ingestion

```python
# data_pipeline/ingestion.py

class ImageIngestionPipeline:
    """
    Handles upload, validation, and preprocessing of studio renders.
    """

    def __init__(self, storage_client, db_client):
        self.storage = storage_client
        self.db = db_client

    async def ingest_batch(
        self,
        studio_id: str,
        images: List[UploadFile],
        metadata: Optional[Dict] = None
    ) -> IngestionResult:
        """
        Process a batch of studio renders.

        Steps:
        1. Validate image formats (PNG, JPG, TIFF, EXR)
        2. Extract EXIF/metadata if available
        3. Generate multiple resolutions (thumbnail, analysis, original)
        4. Upload to S3 with structured paths
        5. Create database records
        6. Queue for embedding extraction
        """

        validated_images = []

        for image in images:
            # Validate
            if not self._validate_image(image):
                continue

            # Generate resolutions
            resolutions = self._generate_resolutions(image)
            # resolutions = {
            #     'thumbnail': (256, 256),   # For UI
            #     'analysis': (768, 768),    # For embeddings
            #     'original': original_size  # Archive
            # }

            # Upload to S3
            s3_paths = await self.storage.upload_resolutions(
                studio_id=studio_id,
                image_id=generate_id(),
                resolutions=resolutions
            )

            # Create DB record
            image_record = ImageRecord(
                id=s3_paths['id'],
                studio_id=studio_id,
                paths=s3_paths,
                metadata=self._extract_metadata(image),
                status='pending_embedding'
            )

            await self.db.images.insert(image_record)
            validated_images.append(image_record)

        # Queue embedding extraction
        await self._queue_embedding_jobs(validated_images)

        return IngestionResult(
            total=len(images),
            processed=len(validated_images),
            failed=len(images) - len(validated_images)
        )

    def _validate_image(self, image: UploadFile) -> bool:
        """
        Validation rules:
        - Format: PNG, JPG, TIFF, EXR
        - Min resolution: 512x512
        - Max file size: 50MB
        - Not corrupted
        """
        pass

    def _extract_metadata(self, image: UploadFile) -> Dict:
        """
        Extract useful metadata:
        - EXIF data (camera, lens, settings)
        - Render engine info (if available)
        - Project tags (if in filename)
        """
        pass
```

### Stage 2: Embedding Extraction

```python
# data_pipeline/embeddings.py

from transformers import CLIPModel, CLIPProcessor
import torch

class EmbeddingExtractor:
    """
    Extract visual embeddings using CLIP or similar models.
    """

    def __init__(self, model_name: str = "openai/clip-vit-large-patch14"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CLIPModel.from_pretrained(model_name).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(model_name)

    async def extract_batch(
        self,
        image_records: List[ImageRecord]
    ) -> List[EmbeddingRecord]:
        """
        Extract embeddings for a batch of images.

        Returns 768-dimensional vectors capturing:
        - Color palette
        - Composition
        - Lighting characteristics
        - Material textures
        - Spatial arrangement
        - Architectural style
        """

        embeddings = []

        for record in image_records:
            # Load analysis resolution image
            image = await self._load_image(record.paths['analysis'])

            # Process through CLIP
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
                embedding = image_features.cpu().numpy().flatten()

            embeddings.append(EmbeddingRecord(
                image_id=record.id,
                studio_id=record.studio_id,
                vector=embedding.tolist(),
                model_version=self.model_name,
                extracted_at=datetime.utcnow()
            ))

        return embeddings

    def extract_style_components(
        self,
        image: Image
    ) -> StyleComponents:
        """
        Extract specific style components beyond general embedding.

        Components:
        - color_histogram: Dominant colors and distribution
        - edge_density: Complexity of forms
        - symmetry_score: Compositional balance
        - brightness_distribution: Lighting character
        - texture_features: Material richness
        """

        return StyleComponents(
            color_histogram=self._extract_colors(image),
            edge_density=self._compute_edge_density(image),
            symmetry_score=self._compute_symmetry(image),
            brightness_distribution=self._analyze_brightness(image),
            texture_features=self._extract_textures(image)
        )
```

### Stage 3: Style Clustering

```python
# data_pipeline/clustering.py

import hdbscan
import umap
import numpy as np

class StyleClusterer:
    """
    Cluster embeddings to identify distinct style patterns within a studio's work.
    """

    def __init__(self):
        self.umap_reducer = umap.UMAP(
            n_components=50,  # Reduce from 768 to 50
            n_neighbors=15,
            min_dist=0.1,
            metric='cosine'
        )
        self.clusterer = hdbscan.HDBSCAN(
            min_cluster_size=5,
            min_samples=3,
            cluster_selection_epsilon=0.5
        )

    def cluster_studio_styles(
        self,
        embeddings: List[EmbeddingRecord]
    ) -> ClusteringResult:
        """
        Identify style clusters within a studio's renders.

        Many studios have multiple styles:
        - Residential vs Commercial
        - Exterior vs Interior
        - Different project phases (concept vs final)

        This clustering reveals these natural groupings.
        """

        # Convert to numpy array
        vectors = np.array([e.vector for e in embeddings])

        # Dimensionality reduction
        reduced = self.umap_reducer.fit_transform(vectors)

        # Clustering
        labels = self.clusterer.fit_predict(reduced)

        # Analyze clusters
        clusters = []
        for cluster_id in set(labels):
            if cluster_id == -1:  # Noise
                continue

            cluster_mask = labels == cluster_id
            cluster_embeddings = [
                embeddings[i] for i, is_member in enumerate(cluster_mask) if is_member
            ]

            # Compute cluster centroid
            cluster_vectors = vectors[cluster_mask]
            centroid = np.mean(cluster_vectors, axis=0)

            # Find representative images (closest to centroid)
            distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
            representative_indices = np.argsort(distances)[:5]
            representative_images = [
                cluster_embeddings[i].image_id for i in representative_indices
            ]

            clusters.append(StyleCluster(
                id=f"cluster_{cluster_id}",
                size=len(cluster_embeddings),
                centroid=centroid.tolist(),
                representative_images=representative_images,
                image_ids=[e.image_id for e in cluster_embeddings],
                coherence_score=self._compute_coherence(cluster_vectors)
            ))

        return ClusteringResult(
            studio_id=embeddings[0].studio_id,
            total_images=len(embeddings),
            num_clusters=len(clusters),
            clusters=clusters,
            noise_images=[
                embeddings[i].image_id
                for i, label in enumerate(labels) if label == -1
            ]
        )

    def _compute_coherence(self, vectors: np.ndarray) -> float:
        """
        Measure how visually consistent a cluster is.
        Higher coherence = more unified style.
        """
        centroid = np.mean(vectors, axis=0)
        distances = np.linalg.norm(vectors - centroid, axis=1)
        return 1 / (1 + np.std(distances))
```

---

## Style Extraction Models

### Multi-Modal Style Analysis

```python
# analysis/style_analyzer.py

from openai import OpenAI
import anthropic

class MultiModalStyleAnalyzer:
    """
    Use vision-capable LLMs to describe style characteristics in natural language.
    """

    def __init__(self, provider: str = "openai"):
        if provider == "openai":
            self.client = OpenAI()
        elif provider == "anthropic":
            self.client = anthropic.Anthropic()

    async def analyze_cluster(
        self,
        cluster: StyleCluster,
        image_urls: List[str]
    ) -> StyleAnalysis:
        """
        Analyze a cluster of images to extract style characteristics.

        Uses vision LLM to:
        1. Describe common visual patterns
        2. Identify material preferences
        3. Characterize lighting approach
        4. Note compositional tendencies
        5. Identify architectural vocabulary
        """

        # Use representative images (up to 10)
        analysis_images = image_urls[:10]

        prompt = """
        You are an expert architectural visualization analyst. Analyze these renders from
        a single architectural studio to identify their distinctive style characteristics.

        ANALYZE THE FOLLOWING DIMENSIONS:

        1. MATERIALS & FINISHES
        - What materials appear consistently? (concrete, wood, glass, metal, stone)
        - Surface treatments (polished, matte, textured, raw)
        - Color palette tendencies
        - Material combinations and contrasts

        2. LIGHTING APPROACH
        - Natural vs artificial light balance
        - Shadow quality (hard, soft, dramatic)
        - Color temperature preferences
        - Time of day tendencies
        - Light as architectural element

        3. SPATIAL QUALITIES
        - Scale preferences (intimate, grand, human-scale)
        - Proportion systems
        - Ceiling height tendencies
        - Open vs enclosed preferences
        - Spatial flow and continuity

        4. COMPOSITIONAL PATTERNS
        - Camera angles (eye-level, low, high, bird's eye)
        - Framing techniques
        - Focal point placement
        - Depth of field usage
        - Symmetry vs asymmetry

        5. ARCHITECTURAL VOCABULARY
        - Form language (orthogonal, curved, angular)
        - Relationship to context
        - Structural expression
        - Detail level and craftsmanship
        - Similar architects/movements

        6. ATMOSPHERIC QUALITIES
        - Mood and emotional tone
        - Minimalist vs maximalist
        - Warmth vs coolness
        - Static vs dynamic
        - Introverted vs extroverted

        Provide your analysis in structured JSON format.
        """

        # Call vision API with images
        response = await self._call_vision_api(prompt, analysis_images)

        # Parse response into structured format
        return StyleAnalysis(
            cluster_id=cluster.id,
            materials=response['materials'],
            lighting=response['lighting'],
            spatial=response['spatial'],
            composition=response['composition'],
            vocabulary=response['vocabulary'],
            atmosphere=response['atmosphere'],
            similar_architects=response.get('similar_architects', []),
            raw_description=response.get('summary', '')
        )

    async def generate_style_description(
        self,
        analysis: StyleAnalysis
    ) -> str:
        """
        Generate a cohesive natural language description of the style
        suitable for use as a prompt prefix.
        """

        prompt = f"""
        Based on this style analysis, generate a detailed prompt prefix that will
        guide an image generation model to produce renders in this exact style.

        Analysis:
        {json.dumps(analysis.to_dict(), indent=2)}

        The prompt should:
        1. Be written as instructions to an AI image generator
        2. Capture the distinctive characteristics of this style
        3. Be specific enough to produce consistent results
        4. Include material, lighting, spatial, and atmospheric details
        5. Be approximately 100-200 words

        Write the prompt prefix now:
        """

        response = await self._call_text_api(prompt)
        return response

    async def _call_vision_api(
        self,
        prompt: str,
        image_urls: List[str]
    ) -> Dict:
        """Call vision API with multiple images."""

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    *[{"type": "image_url", "image_url": {"url": url}} for url in image_urls]
                ]
            }
        ]

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=4096
        )

        return json.loads(response.choices[0].message.content)
```

### Automatic Parameter Optimization

```python
# analysis/parameter_optimizer.py

class ParameterOptimizer:
    """
    Determine optimal generation parameters for a style.
    """

    async def optimize_parameters(
        self,
        style_analysis: StyleAnalysis,
        sample_images: List[str]
    ) -> OptimizedParameters:
        """
        Determine optimal temperature, top_p, and other parameters
        based on style characteristics.

        Strategy:
        - Highly consistent styles → Lower temperature (0.1-0.3)
        - More varied styles → Higher temperature (0.4-0.6)
        - Complex details → Higher top_p (0.9)
        - Minimalist → Lower top_p (0.7-0.8)
        """

        # Analyze style coherence
        coherence = await self._analyze_coherence(sample_images)

        # Analyze complexity
        complexity = await self._analyze_complexity(style_analysis)

        # Compute optimal parameters
        temperature = self._compute_temperature(coherence)
        top_p = self._compute_top_p(complexity)

        return OptimizedParameters(
            temperature=temperature,
            top_p=top_p,
            reasoning={
                'coherence_score': coherence,
                'complexity_score': complexity,
                'temperature_rationale': self._temperature_rationale(coherence),
                'top_p_rationale': self._top_p_rationale(complexity)
            }
        )

    def _compute_temperature(self, coherence: float) -> float:
        """
        Map coherence to temperature.
        High coherence (consistent style) → Low temperature
        """
        # coherence: 0-1 scale
        # temperature: 0.1-0.6 range for presets
        return 0.1 + (1 - coherence) * 0.5

    def _compute_top_p(self, complexity: float) -> float:
        """
        Map complexity to top_p.
        High complexity (detailed) → Higher top_p
        """
        # complexity: 0-1 scale
        # top_p: 0.7-0.95 range
        return 0.7 + complexity * 0.25
```

---

## Preset Generation Engine

### Automatic Preset Builder

```python
# preset_generator/builder.py

class PresetBuilder:
    """
    Assemble all analysis components into a complete StylePreset.
    """

    def __init__(
        self,
        style_analyzer: MultiModalStyleAnalyzer,
        parameter_optimizer: ParameterOptimizer,
        reference_selector: ReferenceImageSelector
    ):
        self.analyzer = style_analyzer
        self.optimizer = parameter_optimizer
        self.selector = reference_selector

    async def build_preset(
        self,
        studio_id: str,
        cluster: StyleCluster,
        image_records: List[ImageRecord]
    ) -> StylePreset:
        """
        Build a complete preset from a style cluster.

        Steps:
        1. Get representative image URLs
        2. Run multi-modal style analysis
        3. Generate style description (prompt prefix)
        4. Optimize generation parameters
        5. Select reference images
        6. Assemble final preset
        """

        # Get image URLs for analysis
        image_urls = [
            self._get_image_url(r) for r in image_records
            if r.id in cluster.representative_images
        ]

        # Step 1: Analyze style
        style_analysis = await self.analyzer.analyze_cluster(
            cluster=cluster,
            image_urls=image_urls
        )

        # Step 2: Generate prompt prefix
        prompt_prefix = await self.analyzer.generate_style_description(style_analysis)

        # Step 3: Generate prompt suffix
        prompt_suffix = await self._generate_prompt_suffix(style_analysis)

        # Step 4: Optimize parameters
        parameters = await self.optimizer.optimize_parameters(
            style_analysis=style_analysis,
            sample_images=image_urls
        )

        # Step 5: Select reference images
        reference_images = await self.selector.select_references(
            cluster=cluster,
            image_records=image_records,
            max_images=3
        )

        # Step 6: Assemble preset
        preset = StylePreset(
            id=f"custom-{studio_id}-{cluster.id}",
            name=await self._generate_preset_name(style_analysis),
            category='design',  # Custom presets are design presets
            description=await self._generate_description(style_analysis),
            tags=self._extract_tags(style_analysis),
            complexity='advanced',
            parameters={
                'temperature': parameters.temperature,
                'top_p': parameters.top_p
            },
            promptPrefix=prompt_prefix,
            promptSuffix=prompt_suffix,
            negativePrompt=await self._generate_negative_prompt(style_analysis),
            referenceImages=[
                {
                    'url': ref.url,
                    'description': ref.description,
                    'weight': ref.weight
                }
                for ref in reference_images
            ],
            isBuiltIn=False,
            createdBy=studio_id,
            createdAt=datetime.utcnow().isoformat(),
            updatedAt=datetime.utcnow().isoformat(),
            version=1,
            # Additional metadata
            metadata={
                'source_cluster': cluster.id,
                'source_image_count': len(cluster.image_ids),
                'coherence_score': cluster.coherence_score,
                'style_analysis': style_analysis.to_dict(),
                'parameter_reasoning': parameters.reasoning
            }
        )

        return preset

    async def _generate_prompt_suffix(
        self,
        analysis: StyleAnalysis
    ) -> str:
        """Generate a prompt suffix emphasizing key characteristics."""

        prompt = f"""
        Based on this architectural style analysis, generate a brief prompt suffix
        (50-100 words) that reinforces the key distinguishing characteristics.

        Focus on:
        - The most distinctive visual elements
        - What to emphasize in the final render
        - Unique qualities that define this style

        Analysis: {json.dumps(analysis.to_dict(), indent=2)}

        Write the prompt suffix:
        """

        return await self.analyzer._call_text_api(prompt)

    async def _generate_negative_prompt(
        self,
        analysis: StyleAnalysis
    ) -> str:
        """Generate negative prompt based on style analysis."""

        prompt = f"""
        Based on this architectural style, generate a negative prompt listing
        things that should be AVOIDED to maintain style consistency.

        Consider:
        - Conflicting materials (if minimalist, avoid cluttered)
        - Wrong lighting (if warm, avoid cold harsh light)
        - Incompatible styles (if modern, avoid traditional ornament)

        Analysis: {json.dumps(analysis.to_dict(), indent=2)}

        Generate a comma-separated list of things to avoid:
        """

        return await self.analyzer._call_text_api(prompt)

    async def _generate_preset_name(
        self,
        analysis: StyleAnalysis
    ) -> str:
        """Generate a memorable name for the preset."""

        # Use LLM to generate creative but descriptive name
        prompt = f"""
        Generate a short, memorable name (2-4 words) for this architectural style.
        The name should evoke the style's essence without being generic.

        Style characteristics:
        - Materials: {analysis.materials}
        - Atmosphere: {analysis.atmosphere}
        - Similar to: {analysis.similar_architects}

        Examples of good names:
        - "Nordic Serenity"
        - "Concrete Poetry"
        - "Luminous Minimalism"
        - "Warm Industrial"

        Generate one name:
        """

        return await self.analyzer._call_text_api(prompt)

    def _extract_tags(self, analysis: StyleAnalysis) -> List[str]:
        """Extract searchable tags from analysis."""

        tags = []

        # Add material tags
        tags.extend(analysis.materials.get('primary', []))

        # Add atmosphere tags
        if analysis.atmosphere.get('mood'):
            tags.append(analysis.atmosphere['mood'])

        # Add similar architect tags
        tags.extend(analysis.similar_architects[:3])

        # Add vocabulary tags
        tags.extend(analysis.vocabulary.get('keywords', []))

        return list(set(tags))[:15]  # Limit to 15 tags
```

### Reference Image Selection

```python
# preset_generator/reference_selector.py

class ReferenceImageSelector:
    """
    Select the best reference images to include with a preset.
    """

    async def select_references(
        self,
        cluster: StyleCluster,
        image_records: List[ImageRecord],
        max_images: int = 3
    ) -> List[ReferenceImage]:
        """
        Select optimal reference images based on:
        1. Proximity to cluster centroid (representativeness)
        2. Visual clarity and quality
        3. Diversity within the cluster
        4. Avoiding edge cases
        """

        # Get cluster images
        cluster_images = [
            r for r in image_records if r.id in cluster.image_ids
        ]

        # Score each image
        scored_images = []
        for record in cluster_images:
            score = self._compute_reference_score(record, cluster)
            scored_images.append((record, score))

        # Sort by score
        scored_images.sort(key=lambda x: x[1], reverse=True)

        # Select diverse subset
        selected = self._select_diverse(
            candidates=[s[0] for s in scored_images[:10]],
            count=max_images
        )

        # Generate descriptions for selected images
        references = []
        for record in selected:
            description = await self._generate_description(record)
            references.append(ReferenceImage(
                url=record.paths['analysis'],
                description=description,
                weight=0.8  # Default weight
            ))

        return references

    def _compute_reference_score(
        self,
        record: ImageRecord,
        cluster: StyleCluster
    ) -> float:
        """
        Score an image for reference suitability.

        Factors:
        - Distance to centroid (closer = better)
        - Image quality metrics
        - Resolution
        """
        # Implementation details...
        pass

    def _select_diverse(
        self,
        candidates: List[ImageRecord],
        count: int
    ) -> List[ImageRecord]:
        """
        Select a diverse subset using maximal marginal relevance.
        """
        # Implementation details...
        pass
```

---

## Training Infrastructure

### Job Queue System

```python
# infrastructure/job_queue.py

from celery import Celery
from redis import Redis

celery_app = Celery(
    'preset_training',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/1'
)

class PresetTrainingQueue:
    """
    Manage asynchronous preset training jobs.
    """

    @celery_app.task(bind=True, max_retries=3)
    def train_preset_task(
        self,
        studio_id: str,
        image_ids: List[str],
        options: Dict
    ) -> str:
        """
        Full preset training pipeline as a Celery task.

        Stages:
        1. EXTRACTION: Extract embeddings (if not cached)
        2. CLUSTERING: Identify style clusters
        3. ANALYSIS: Multi-modal style analysis
        4. GENERATION: Build preset
        5. VALIDATION: Quality checks
        6. STORAGE: Save preset

        Returns preset_id on success.
        """

        try:
            # Update progress
            self.update_state(state='PROGRESS', meta={'stage': 'extraction'})

            # Stage 1: Embeddings
            embeddings = await extractor.extract_batch(image_ids)

            self.update_state(state='PROGRESS', meta={'stage': 'clustering'})

            # Stage 2: Clustering
            clusters = await clusterer.cluster_studio_styles(embeddings)

            self.update_state(state='PROGRESS', meta={'stage': 'analysis'})

            # Stage 3-4: Analysis and Generation (per cluster)
            presets = []
            for cluster in clusters.clusters:
                analysis = await analyzer.analyze_cluster(cluster, ...)
                preset = await builder.build_preset(studio_id, cluster, ...)
                presets.append(preset)

            self.update_state(state='PROGRESS', meta={'stage': 'validation'})

            # Stage 5: Validation
            validated_presets = await validator.validate_presets(presets)

            self.update_state(state='PROGRESS', meta={'stage': 'storage'})

            # Stage 6: Storage
            for preset in validated_presets:
                await db.presets.insert(preset)

            return {
                'status': 'completed',
                'preset_ids': [p.id for p in validated_presets],
                'clusters_found': len(clusters.clusters)
            }

        except Exception as e:
            self.retry(exc=e, countdown=60)

    @celery_app.task
    def update_preset_task(
        self,
        preset_id: str,
        new_image_ids: List[str]
    ) -> str:
        """
        Incrementally update an existing preset with new images.
        """
        # Implementation details...
        pass
```

### Resource Management

```yaml
# infrastructure/docker-compose.yml

version: '3.8'

services:
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - S3_BUCKET=preset-images
    depends_on:
      - postgres
      - redis

  worker:
    build: ./worker
    command: celery -A tasks worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=presets
      - POSTGRES_USER=preset_user
      - POSTGRES_PASSWORD=secure_password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## API Design

### REST API Endpoints

```yaml
# api/openapi.yaml

openapi: 3.0.0
info:
  title: Personalized Preset API
  version: 1.0.0

paths:
  /studios:
    post:
      summary: Create a new studio account
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                email:
                  type: string

  /studios/{studio_id}/images:
    post:
      summary: Upload images for preset training
      parameters:
        - name: studio_id
          in: path
          required: true
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                images:
                  type: array
                  items:
                    type: string
                    format: binary
                metadata:
                  type: object
      responses:
        202:
          description: Upload accepted, processing started
          content:
            application/json:
              schema:
                type: object
                properties:
                  batch_id:
                    type: string
                  images_accepted:
                    type: integer
                  status_url:
                    type: string

  /studios/{studio_id}/train:
    post:
      summary: Start preset training job
      parameters:
        - name: studio_id
          in: path
          required: true
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                image_ids:
                  type: array
                  items:
                    type: string
                options:
                  type: object
                  properties:
                    min_cluster_size:
                      type: integer
                      default: 5
                    max_presets:
                      type: integer
                      default: 5
      responses:
        202:
          description: Training job started
          content:
            application/json:
              schema:
                type: object
                properties:
                  job_id:
                    type: string
                  estimated_time_minutes:
                    type: integer
                  status_url:
                    type: string

  /jobs/{job_id}:
    get:
      summary: Get training job status
      parameters:
        - name: job_id
          in: path
          required: true
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    enum: [pending, processing, completed, failed]
                  stage:
                    type: string
                  progress:
                    type: number
                  result:
                    type: object

  /studios/{studio_id}/presets:
    get:
      summary: List all presets for a studio
      parameters:
        - name: studio_id
          in: path
          required: true
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/StylePreset'

  /presets/{preset_id}:
    get:
      summary: Get preset details
    put:
      summary: Update preset (manual edits)
    delete:
      summary: Delete preset

  /presets/{preset_id}/update:
    post:
      summary: Incrementally update preset with new images
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                image_ids:
                  type: array
                  items:
                    type: string
                update_mode:
                  enum: [append, replace, refine]

  /presets/export:
    post:
      summary: Export presets for desktop app
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                preset_ids:
                  type: array
                  items:
                    type: string
                format:
                  enum: [json, encrypted]
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  download_url:
                    type: string
                  expires_at:
                    type: string
```

### Desktop App Integration

```typescript
// services/presetSyncService.ts

class PresetSyncService {
  private apiUrl: string;
  private apiKey: string;

  async syncPresets(studioId: string): Promise<StylePreset[]> {
    /**
     * Sync custom presets from cloud to desktop app.
     */

    const response = await fetch(
      `${this.apiUrl}/studios/${studioId}/presets`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const cloudPresets = await response.json();

    // Merge with local presets
    const merged = this.mergePresets(
      await presetsService.getCustomPresets(),
      cloudPresets
    );

    // Save locally
    await presetsService.savePresets(merged);

    return merged;
  }

  async uploadImages(images: File[]): Promise<UploadResult> {
    /**
     * Upload images for preset training.
     */

    const formData = new FormData();
    images.forEach((img, i) => formData.append(`images[${i}]`, img));

    const response = await fetch(
      `${this.apiUrl}/studios/${this.studioId}/images`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      }
    );

    return response.json();
  }

  async startTraining(imageIds: string[]): Promise<TrainingJob> {
    /**
     * Start preset training job.
     */

    const response = await fetch(
      `${this.apiUrl}/studios/${this.studioId}/train`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_ids: imageIds })
      }
    );

    return response.json();
  }

  async pollJobStatus(jobId: string): Promise<JobStatus> {
    /**
     * Poll for training job completion.
     */

    const response = await fetch(
      `${this.apiUrl}/jobs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      }
    );

    return response.json();
  }
}
```

---

## Update Mechanism

### Incremental Learning

```python
# update/incremental.py

class IncrementalPresetUpdater:
    """
    Update existing presets with new renders without full retraining.
    """

    async def update_preset(
        self,
        preset_id: str,
        new_image_ids: List[str],
        mode: UpdateMode = UpdateMode.REFINE
    ) -> StylePreset:
        """
        Update modes:

        APPEND: Add new images to training set, expand style coverage
        REPLACE: Replace old images, shift style direction
        REFINE: Weight new images more heavily, gradual evolution
        """

        # Load existing preset and its training data
        preset = await self.db.presets.get(preset_id)
        existing_embeddings = await self.db.embeddings.get_by_preset(preset_id)

        # Extract embeddings for new images
        new_embeddings = await self.extractor.extract_batch(new_image_ids)

        # Merge embeddings based on mode
        if mode == UpdateMode.APPEND:
            merged = existing_embeddings + new_embeddings
        elif mode == UpdateMode.REPLACE:
            merged = new_embeddings
        elif mode == UpdateMode.REFINE:
            # Weight new embeddings more heavily
            merged = self._weighted_merge(
                existing_embeddings,
                new_embeddings,
                new_weight=0.7
            )

        # Re-analyze style
        analysis = await self.analyzer.analyze_from_embeddings(merged)

        # Update preset
        updated_preset = await self.builder.rebuild_preset(
            preset=preset,
            analysis=analysis,
            embeddings=merged
        )

        # Increment version
        updated_preset.version = preset.version + 1
        updated_preset.updatedAt = datetime.utcnow().isoformat()

        # Save
        await self.db.presets.update(updated_preset)

        return updated_preset

    def _weighted_merge(
        self,
        existing: List[EmbeddingRecord],
        new: List[EmbeddingRecord],
        new_weight: float
    ) -> List[EmbeddingRecord]:
        """
        Merge embeddings with weighting.

        New images contribute more to the final style centroid.
        """

        # Calculate weighted centroid
        existing_vectors = np.array([e.vector for e in existing])
        new_vectors = np.array([e.vector for e in new])

        existing_centroid = np.mean(existing_vectors, axis=0)
        new_centroid = np.mean(new_vectors, axis=0)

        # Weighted combination
        combined_centroid = (
            (1 - new_weight) * existing_centroid +
            new_weight * new_centroid
        )

        # Return all embeddings with adjusted centroid reference
        return existing + new
```

### Batch Processing

```python
# update/batch.py

class BatchUpdateScheduler:
    """
    Schedule and manage batch updates for multiple studios.
    """

    async def schedule_batch_update(
        self,
        studio_id: str,
        schedule: UpdateSchedule
    ):
        """
        Schedule automatic preset updates:
        - Daily: Lightweight refinement
        - Weekly: Full reanalysis
        - Monthly: Complete retraining if significant new content
        """

        job = ScheduledJob(
            studio_id=studio_id,
            type='preset_update',
            schedule=schedule,
            config={
                'mode': UpdateMode.REFINE,
                'threshold_new_images': 10  # Minimum new images to trigger
            }
        )

        await self.scheduler.add_job(job)

    async def run_scheduled_update(self, studio_id: str):
        """
        Execute a scheduled update.
        """

        # Get new images since last update
        new_images = await self.db.images.get_since(
            studio_id=studio_id,
            since=await self._get_last_update_time(studio_id)
        )

        if len(new_images) < self.config['threshold_new_images']:
            return  # Not enough new content

        # Get all presets for studio
        presets = await self.db.presets.get_by_studio(studio_id)

        # Update each preset
        for preset in presets:
            await self.updater.update_preset(
                preset_id=preset.id,
                new_image_ids=[img.id for img in new_images],
                mode=UpdateMode.REFINE
            )
```

---

## Deployment Strategy

### Phase 1: Standalone Service

```
┌─────────────────────────────────────────────────────────────────────┐
│                      INITIAL DEPLOYMENT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Desktop App (Electron)                                            │
│   └── Manual preset sync via export/import                          │
│                                                                     │
│   ┌─────────────────────────────────────────┐                       │
│   │   Preset Training Portal (Web App)      │                       │
│   │   └── Upload renders                    │                       │
│   │   └── Start training                    │                       │
│   │   └── Download presets                  │                       │
│   └─────────────────────────────────────────┘                       │
│                       │                                             │
│                       ▼                                             │
│   ┌─────────────────────────────────────────┐                       │
│   │   Preset Training API (Cloud)           │                       │
│   │   └── Single region (US-East)           │                       │
│   │   └── GPU worker (on-demand)            │                       │
│   │   └── PostgreSQL + S3                   │                       │
│   └─────────────────────────────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Integrated Service

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION DEPLOYMENT                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Desktop App (Electron)                                            │
│   └── Built-in preset management                                    │
│   └── Direct API sync                                               │
│   └── Offline capability                                            │
│                                                                     │
│                       ▲                                             │
│                       │ API Sync                                    │
│                       ▼                                             │
│   ┌─────────────────────────────────────────┐                       │
│   │   API Gateway (Global CDN)              │                       │
│   │   └── Authentication                    │                       │
│   │   └── Rate limiting                     │                       │
│   │   └── Regional routing                  │                       │
│   └─────────────────────────────────────────┘                       │
│                       │                                             │
│                       ▼                                             │
│   ┌─────────────────────────────────────────┐                       │
│   │   Preset Service Cluster                │                       │
│   │   ├── API Servers (auto-scale)          │                       │
│   │   ├── GPU Workers (spot instances)      │                       │
│   │   ├── PostgreSQL (primary + replicas)   │                       │
│   │   ├── Redis (caching + queues)          │                       │
│   │   └── S3 (multi-region)                 │                       │
│   └─────────────────────────────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cost Analysis

### Per-Preset Training Cost

| Component | Cost per Preset | Notes |
|-----------|-----------------|-------|
| Image storage (S3) | $0.10 | 100 images × 10MB × $0.023/GB |
| Embedding extraction | $0.50 | 100 images × GPU time |
| Vision LLM analysis | $2-5 | 10 images × GPT-4o pricing |
| Text LLM prompts | $0.50 | Multiple prompt generations |
| Infrastructure | $1 | Compute, database, queue |
| **Total** | **$4-8** | Per preset |

### Monthly Infrastructure Cost

| Tier | Users | Monthly Cost |
|------|-------|--------------|
| Starter | 1-10 studios | $50-100 |
| Growth | 10-50 studios | $200-500 |
| Scale | 50-200 studios | $500-2000 |

### Pricing Model Options

| Plan | Price | Included |
|------|-------|----------|
| Free | $0 | 1 preset, 50 images, no updates |
| Pro | $29/mo | 5 presets, 500 images, monthly updates |
| Studio | $99/mo | 20 presets, 2000 images, weekly updates |
| Enterprise | Custom | Unlimited, priority processing, SLA |

---

## Implementation Phases

### Phase 1: MVP (4-6 weeks)

**Goal:** Prove the concept works

| Week | Deliverables |
|------|-------------|
| 1-2 | - Setup infrastructure (API, DB, S3)<br>- Implement image upload and storage<br>- Basic embedding extraction |
| 3-4 | - Implement clustering<br>- Basic LLM style analysis<br>- Simple preset generation |
| 5-6 | - Web portal UI<br>- Export/import to desktop app<br>- Testing with real studio data |

**Success Criteria:**
- Generate 3 distinct presets from 100 studio renders
- Presets produce recognizably similar outputs
- End-to-end process completes in < 1 hour

### Phase 2: Production (6-8 weeks)

**Goal:** Production-ready system

| Week | Deliverables |
|------|-------------|
| 1-2 | - User authentication<br>- Studio management<br>- Improved clustering |
| 3-4 | - Enhanced style analysis<br>- Parameter optimization<br>- Reference image selection |
| 5-6 | - Incremental updates<br>- Job queue and monitoring<br>- Desktop app integration |
| 7-8 | - Quality validation<br>- Documentation<br>- Beta testing |

### Phase 3: Scale (Ongoing)

**Goal:** Scalable, profitable system

- Multi-region deployment
- Advanced analytics
- Preset marketplace
- A/B testing framework
- Custom model fine-tuning (enterprise)

---

## Appendix: Research References

### Relevant Papers

1. **CLIP (Radford et al., 2021)** - Learning Transferable Visual Models From Natural Language Supervision
2. **UMAP (McInnes et al., 2018)** - Uniform Manifold Approximation and Projection
3. **HDBSCAN (Campello et al., 2013)** - Density-Based Clustering Based on Hierarchical Density Estimates
4. **Style Transfer (Gatys et al., 2016)** - Image Style Transfer Using Convolutional Neural Networks

### Alternative Approaches Considered

| Approach | Why Not Chosen |
|----------|---------------|
| GAN-based style extraction | Too complex, requires large datasets |
| Diffusion model fine-tuning | Gemini API doesn't support custom models |
| Pure prompt engineering | Too manual, not scalable |
| Human annotation | Expensive, slow, inconsistent |

---

## Conclusion

The recommended architecture (Option 2: Embedding Clustering + LLM Description) provides:

1. **Quality**: Captures multi-dimensional style characteristics
2. **Cost-effectiveness**: $4-8 per preset vs $500+ for fine-tuning
3. **Updateability**: Easy incremental updates with new renders
4. **Scalability**: Handles studios of any size
5. **Speed**: Hours instead of days/weeks

This system transforms the subjective task of style definition into an automated, data-driven process while preserving the nuanced understanding that makes architectural visualization distinctive.
