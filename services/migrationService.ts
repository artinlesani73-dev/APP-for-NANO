import {
  Session,
  SessionGeneration,
  MixboardSession,
  MixboardGeneration,
  StoredImageMeta
} from '../types';
import { StorageService } from './newStorageService';

/**
 * Migration service for converting legacy sessions to Mixboard format.
 * Handles the transition from control/reference image separation to unified inputs.
 */
export class MigrationService {
  /**
   * Convert old session format to Mixboard format
   */
  static migrateSession(oldSession: Session): MixboardSession {
    return {
      session_id: oldSession.session_id,
      title: oldSession.title,
      created_at: oldSession.created_at,
      updated_at: oldSession.updated_at,
      generations: oldSession.generations.map(gen => this.migrateGeneration(gen)),
      canvas_images: [],  // Cannot reconstruct old canvas state
      user: oldSession.user,
      graph: oldSession.graph
    };
  }

  /**
   * Convert old generation to Mixboard generation
   */
  static migrateGeneration(oldGen: SessionGeneration): MixboardGeneration {
    const inputImages = this.unifyImages(
      oldGen.control_images,
      oldGen.reference_images
    );

    // Handle legacy single output format
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
      canvas_state: undefined,  // Cannot reconstruct
      parent_generation_ids: []  // Cannot infer from old data
    };
  }

  /**
   * Merge control_images + reference_images → input_images
   * Preserves order: [control1, control2, ..., reference1, reference2, ...]
   */
  static unifyImages(
    controlImages?: StoredImageMeta[],
    referenceImages?: StoredImageMeta[]
  ): StoredImageMeta[] {
    const unified: StoredImageMeta[] = [];

    if (controlImages) {
      unified.push(...controlImages);
    }

    if (referenceImages) {
      unified.push(...referenceImages);
    }

    return unified;
  }

  /**
   * Detect if session is old format or new format
   */
  static isLegacySession(session: any): boolean {
    if (!session || !session.generations || session.generations.length === 0) {
      return false;
    }

    const firstGen = session.generations[0];

    // Check for old format indicators
    const hasControlOrReference =
      firstGen.control_images !== undefined ||
      firstGen.reference_images !== undefined;

    // Check for new format indicators
    const hasInputImages = firstGen.input_images !== undefined;

    return hasControlOrReference && !hasInputImages;
  }

  /**
   * Detect if a generation is legacy format
   */
  static isLegacyGeneration(gen: any): boolean {
    const hasControlOrReference =
      gen.control_images !== undefined ||
      gen.reference_images !== undefined;

    const hasInputImages = gen.input_images !== undefined;

    return hasControlOrReference && !hasInputImages;
  }

  /**
   * Batch migrate all sessions in storage
   */
  static migrateAllSessions(): {
    migrated: number;
    failed: number;
    skipped: number;
    errors: string[];
  } {
    const result = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    try {
      // Create backup before migration
      this.createBackup();

      const allSessions = StorageService.getSessions();

      for (const session of allSessions) {
        try {
          if (this.isLegacySession(session)) {
            const migratedSession = this.migrateSession(session);

            // Save migrated session
            StorageService.saveSession(migratedSession as any);

            result.migrated++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(
            `Failed to migrate session ${session.session_id}: ${(error as Error).message}`
          );
        }
      }

      // Set migration flag
      localStorage.setItem('mixboard_migration_completed', 'true');
      localStorage.setItem('mixboard_migration_date', new Date().toISOString());

    } catch (error) {
      result.errors.push(`Migration process failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Check if migration has been completed
   */
  static isMigrationCompleted(): boolean {
    return localStorage.getItem('mixboard_migration_completed') === 'true';
  }

  /**
   * Check if any sessions need migration
   */
  static needsMigration(): boolean {
    if (this.isMigrationCompleted()) {
      return false;
    }

    try {
      const allSessions = StorageService.getSessions();
      return allSessions.some(session => this.isLegacySession(session));
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Create backup before migration
   */
  static createBackup(): void {
    try {
      const sessions = localStorage.getItem('sessions');
      if (sessions) {
        localStorage.setItem('pre_migration_backup', sessions);
        localStorage.setItem('pre_migration_backup_date', new Date().toISOString());
        console.log('Backup created successfully');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error('Backup creation failed. Migration aborted.');
    }
  }

  /**
   * Rollback migration if something goes wrong
   */
  static rollbackMigration(): boolean {
    try {
      const backup = localStorage.getItem('pre_migration_backup');
      if (backup) {
        localStorage.setItem('sessions', backup);
        localStorage.removeItem('mixboard_migration_completed');
        localStorage.removeItem('mixboard_migration_date');

        console.log('Migration rolled back successfully');
        return true;
      } else {
        console.warn('No backup found for rollback');
        return false;
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  /**
   * Get migration status information
   */
  static getMigrationStatus(): {
    completed: boolean;
    completedDate?: string;
    backupExists: boolean;
    backupDate?: string;
    needsMigration: boolean;
  } {
    const completed = this.isMigrationCompleted();
    const completedDate = localStorage.getItem('mixboard_migration_date') || undefined;
    const backupExists = localStorage.getItem('pre_migration_backup') !== null;
    const backupDate = localStorage.getItem('pre_migration_backup_date') || undefined;
    const needsMigration = this.needsMigration();

    return {
      completed,
      completedDate,
      backupExists,
      backupDate,
      needsMigration
    };
  }

  /**
   * Delete backup after successful migration (optional cleanup)
   */
  static deleteBackup(): void {
    localStorage.removeItem('pre_migration_backup');
    localStorage.removeItem('pre_migration_backup_date');
    console.log('Migration backup deleted');
  }

  /**
   * Migrate a single generation on-the-fly
   * Useful for lazy migration during load
   */
  static migrateSingleGeneration(gen: SessionGeneration | MixboardGeneration): MixboardGeneration {
    if (this.isLegacyGeneration(gen)) {
      return this.migrateGeneration(gen as SessionGeneration);
    }
    return gen as MixboardGeneration;
  }

  /**
   * Check if storage format is compatible
   */
  static isStorageCompatible(): boolean {
    try {
      const sessions = StorageService.getSessions();
      return true;
    } catch (error) {
      console.error('Storage compatibility check failed:', error);
      return false;
    }
  }
}
