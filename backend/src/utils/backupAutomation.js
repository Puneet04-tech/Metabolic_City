import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

/**
 * Backup Automation
 * Data Integrity Principle: Backup Strategy Automation
 */

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);

/**
 * Initialize backup directory
 */
function initBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[Backup] Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Create database backup
 * Uses MongoDB aggregation to export data
 */
export async function createBackup(backupName = null) {
  initBackupDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupNameFull = backupName || `backup-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, `${backupNameFull}.json`);
  
  console.log(`[Backup] Creating backup: ${backupNameFull}`);
  
  try {
    // Get all collections
    const collections = mongoose.connection.collections;
    const backupData = {};
    
    for (const [name, collection] of Object.entries(collections)) {
      console.log(`[Backup] Backing up collection: ${name}`);
      const docs = await collection.find({}).lean();
      backupData[name] = docs;
    }
    
    // Write backup to file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    const stats = fs.statSync(backupPath);
    console.log(`[Backup] Backup created successfully: ${backupPath} (${stats.size} bytes)`);
    
    return {
      success: true,
      path: backupPath,
      size: stats.size,
      timestamp: new Date(),
      collections: Object.keys(backupData),
    };
  } catch (error) {
    console.error('[Backup] Error creating backup:', error.message);
    throw error;
  }
}

/**
 * Restore database from backup
 */
export async function restoreBackup(backupPath) {
  console.log(`[Backup] Restoring from: ${backupPath}`);
  
  try {
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    for (const [collectionName, docs] of Object.entries(backupData)) {
      console.log(`[Backup] Restoring collection: ${collectionName} (${docs.length} documents)`);
      
      const collection = mongoose.connection.collection(collectionName);
      
      // Clear existing data
      await collection.deleteMany({});
      
      // Insert backup data
      if (docs.length > 0) {
        await collection.insertMany(docs);
      }
    }
    
    console.log('[Backup] Restore completed successfully');
    
    return {
      success: true,
      collections: Object.keys(backupData),
      documentCount: Object.values(backupData).reduce((sum, docs) => sum + docs.length, 0),
    };
  } catch (error) {
    console.error('[Backup] Error restoring backup:', error.message);
    throw error;
  }
}

/**
 * List all backups
 */
export function listBackups() {
  initBackupDir();
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    })
    .sort((a, b) => b.created - a.created); // Newest first
  
  return files;
}

/**
 * Delete old backups
 */
export function cleanupOldBackups() {
  initBackupDir();
  
  const cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const files = fs.readdirSync(BACKUP_DIR);
  
  let deletedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.birthtime < cutoff) {
      fs.unlinkSync(filePath);
      console.log(`[Backup] Deleted old backup: ${file}`);
      deletedCount++;
    }
  }
  
  console.log(`[Backup] Cleanup completed: ${deletedCount} backups deleted`);
  
  return { deletedCount, cutoffDate: cutoff };
}

/**
 * Verify backup integrity
 */
export async function verifyBackup(backupPath) {
  console.log(`[Backup] Verifying backup: ${backupPath}`);
  
  try {
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    const verification = {
      valid: true,
      collections: {},
      totalDocuments: 0,
      errors: [],
    };
    
    for (const [collectionName, docs] of Object.entries(backupData)) {
      const collection = mongoose.connection.collection(collectionName);
      
      // Check if collection exists
      const collectionExists = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
      
      if (collectionExists.length === 0) {
        verification.errors.push(`Collection ${collectionName} does not exist in database`);
        verification.valid = false;
        continue;
      }
      
      // Validate document structure
      for (const doc of docs) {
        try {
          await collection.validateOne(doc);
        } catch (error) {
          verification.errors.push(`Invalid document in ${collectionName}: ${error.message}`);
          verification.valid = false;
        }
      }
      
      verification.collections[collectionName] = {
        documentCount: docs.length,
        valid: verification.errors.filter(e => e.includes(collectionName)).length === 0,
      };
      
      verification.totalDocuments += docs.length;
    }
    
    console.log(`[Backup] Verification completed: ${verification.valid ? 'VALID' : 'INVALID'}`);
    
    return verification;
  } catch (error) {
    console.error('[Backup] Error verifying backup:', error.message);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Schedule automated backups
 * This should be called by a cron job or scheduler
 */
export async function scheduleAutomatedBackup() {
  const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
  
  console.log(`[Backup] Automated backup scheduled: ${schedule}`);
  console.log('[Backup] Note: Use a cron job scheduler like node-cron to execute this');
  
  // Example of how to use with node-cron:
  // import cron from 'node-cron';
  // cron.schedule(schedule, async () => {
  //   await createBackup();
  //   await cleanupOldBackups();
  // });
  
  return { schedule, message: 'Schedule configured (requires cron scheduler)' };
}

/**
 * Get backup statistics
 */
export function getBackupStats() {
  initBackupDir();
  
  const files = listBackups();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  return {
    backupDirectory: BACKUP_DIR,
    totalBackups: files.length,
    totalSize: totalSize,
    averageSize: files.length > 0 ? totalSize / files.length : 0,
    retentionDays: BACKUP_RETENTION_DAYS,
    newestBackup: files[0]?.name || null,
    oldestBackup: files[files.length - 1]?.name || null,
  };
}
