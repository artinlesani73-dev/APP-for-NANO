import {
  Session,
  SessionGeneration,
  MixboardSession,
  MixboardGeneration,
  StoredImageMeta,
  CanvasImage
} from '../types';
import { StorageService } from './newStorageService';
import { LegacySessionConverter } from './legacySessionConverter';

/**
 * Migration service for converting legacy sessions to Mixboard format.
 * Handles the transition from control/reference image separation to unified inputs.
 */
export class MigrationService {
  /**
   * Convert old session format to Mixboard format
   */
  static migrateSession(oldSession: Session): MixboardSession {
    return LegacySessionConverter.migrateSession(oldSession, StorageService.loadImage);
  }

  /**
   * Populate canvas with all images from legacy session
   * Collects all control, reference, and output images and places them in a grid
   */
  static populateCanvasFromLegacy(oldSession: Session): CanvasImage[] {
    return LegacySessionConverter.populateCanvasFromLegacy(oldSession, StorageService.loadImage);
  }

  /**
   * Convert old generation to Mixboard generation
   */
  static migrateGeneration(oldGen: SessionGeneration): MixboardGeneration {
    return LegacySessionConverter.migrateGeneration(oldGen);
  }

  /**
   * Merge control_images + reference_images → input_images
   * Preserves order: [control1, control2, ..., reference1, reference2, ...]
   */
  static unifyImages(
    controlImages?: StoredImageMeta[],
    referenceImages?: StoredImageMeta[]
  ): StoredImageMeta[] {
    return LegacySessionConverter.unifyImages(controlImages, referenceImages);
  }

  /**
   * Detect if session is old format or new format
   */
  static isLegacySession(session: any): boolean {
    return LegacySessionConverter.isLegacySession(session);
  }

  /**
   * Detect if a generation is legacy format
   */
  static isLegacyGeneration(gen: any): boolean {
    return LegacySessionConverter.isLegacyGeneration(gen);
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
