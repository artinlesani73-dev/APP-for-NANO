import { CanvasImage, MixboardGeneration, MixboardSession, Session, SessionGeneration, StoredImageMeta } from '../types';

export type LoadImageFn = (role: 'control' | 'reference' | 'output', id: string, filename: string) => string | null;

export const LegacySessionConverter = {
  isLegacyGeneration(gen: any): boolean {
    const hasControlOrReference =
      gen?.control_images !== undefined ||
      gen?.reference_images !== undefined;

    const hasInputImages = gen?.input_images !== undefined;

    return Boolean(hasControlOrReference && !hasInputImages);
  },

  isLegacySession(session: any): boolean {
    if (!session || !Array.isArray(session.generations) || session.generations.length === 0) {
      return false;
    }

    const firstGen = session.generations[0];
    return this.isLegacyGeneration(firstGen);
  },

  unifyImages(controlImages?: StoredImageMeta[], referenceImages?: StoredImageMeta[]): StoredImageMeta[] {
    const unified: StoredImageMeta[] = [];

    if (controlImages) unified.push(...controlImages);
    if (referenceImages) unified.push(...referenceImages);

    return unified;
  },

  migrateGeneration(oldGen: SessionGeneration): MixboardGeneration {
    const inputImages = this.unifyImages(
      oldGen.control_images,
      oldGen.reference_images
    );

    const outputImages = oldGen.output_images ||
      (oldGen.output_image ? [oldGen.output_image] : []);

    return {
      generation_id: oldGen.generation_id,
      timestamp: oldGen.timestamp,
      status: oldGen.status,
      prompt: oldGen.prompt,
      input_images: inputImages,
      output_images: outputImages,
      parameters: oldGen.parameters,
      output_texts: oldGen.output_texts,
      generation_time_ms: oldGen.generation_time_ms,
      error_message: oldGen.error,
      canvas_state: undefined,
      parent_generation_ids: []
    };
  },

  populateCanvasFromLegacy(oldSession: Session, loadImage: LoadImageFn): CanvasImage[] {
    const canvasImages: CanvasImage[] = [];
    const seenImages = new Set<string>();

    let gridX = 100;
    let gridY = 100;
    const gridSpacing = 350;
    const imagesPerRow = 4;
    let imageCount = 0;

    oldSession.generations.forEach((gen) => {
      const allImages: Array<{ meta: StoredImageMeta; role: 'control' | 'reference' | 'output' }> = [];

      if (gen.control_images) {
        gen.control_images.forEach(img => allImages.push({ meta: img, role: 'control' }));
      }

      if (gen.reference_images) {
        gen.reference_images.forEach(img => allImages.push({ meta: img, role: 'reference' }));
      }

      const outputs = gen.output_images || (gen.output_image ? [gen.output_image] : []);
      outputs.forEach(img => allImages.push({ meta: img, role: 'output' }));

      allImages.forEach(({ meta, role }) => {
        if (seenImages.has(meta.id)) return;
        seenImages.add(meta.id);

        const dataUri = loadImage(role, meta.id, meta.filename);
        if (!dataUri) {
          console.warn(`[LegacySessionConverter] Could not load image: ${role}/${meta.id}`);
          return;
        }

        const col = imageCount % imagesPerRow;
        const row = Math.floor(imageCount / imagesPerRow);
        const x = gridX + (col * gridSpacing);
        const y = gridY + (row * gridSpacing);

        canvasImages.push({
          id: `migrated-${meta.id}`,
          dataUri,
          x,
          y,
          width: 300,
          height: 300,
          selected: false,
          originalWidth: 1024,
          originalHeight: 1024,
          imageMetaId: meta.id
        });

        imageCount++;
      });
    });

    return canvasImages;
  },

  migrateSession(oldSession: Session, loadImage: LoadImageFn): MixboardSession {
    const canvasImages = this.populateCanvasFromLegacy(oldSession, loadImage);

    return {
      session_id: oldSession.session_id,
      title: oldSession.title,
      created_at: oldSession.created_at,
      updated_at: oldSession.updated_at,
      generations: oldSession.generations.map(gen => this.migrateGeneration(gen)),
      canvas_images: canvasImages,
      user: oldSession.user,
      graph: oldSession.graph
    };
  }
};

export type LegacyConvertibleSession = Session | MixboardSession;
