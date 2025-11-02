import { App, TFile, Notice } from 'obsidian';
import { R2ServiceObsidian, R2Config } from './r2ServiceObsidian';
import { R2SyncSettings } from './settings';

export class SyncManager {
	private app: App;
	private r2Service: R2ServiceObsidian;
	private settings: R2SyncSettings;
	private syncInProgress: boolean = false;

	constructor(app: App, settings: R2SyncSettings) {
		this.app = app;
		this.settings = settings;
		this.updateR2Service();
	}

	updateSettings(settings: R2SyncSettings) {
		this.settings = settings;
		this.updateR2Service();
	}

	private updateR2Service() {
		if (this.settings.r2AccountId && this.settings.r2AccessKeyId && this.settings.r2SecretAccessKey) {
			this.r2Service = new R2ServiceObsidian({
				accountId: this.settings.r2AccountId,
				accessKeyId: this.settings.r2AccessKeyId,
				secretAccessKey: this.settings.r2SecretAccessKey,
				bucketName: this.settings.r2BucketName,
				region: this.settings.r2Region,
				customEndpoint: this.settings.customEndpoint,
				debugMode: this.settings.debugMode
			});
		}
	}

	async testConnection(): Promise<boolean> {
		if (!this.r2Service) {
			new Notice('R2 configuration incomplete. Please check your settings.');
			return false;
		}

		const result = await this.r2Service.testConnection();
		new Notice(result.details);
		
		if (this.settings.debugMode) {
			console.log('R2 Debug: Connection test details:', result.details);
		}
		
		return result.success;
	}

	async syncFile(file: TFile): Promise<boolean> {
		if (this.syncInProgress || !this.r2Service) {
			return false;
		}

		this.syncInProgress = true;
		this.settings.syncInProgress = true;

		try {
			if (this.settings.debugMode) {
				console.log(`🔍 R2 Debug: Starting sync for file: ${file.name}`);
				console.log(`🔍 R2 Debug: File path: ${file.path}`);
			}

			const content = await this.app.vault.read(file);
			const key = this.getFileKey(file);
			
			if (this.settings.debugMode) {
				console.log(`🔍 R2 Debug: File key: ${key}, Content length: ${content.length}`);
				console.log(`🔍 R2 Debug: Base folder: ${this.settings.baseFolder || this.app.vault.getName()}`);
			}
			
			const success = await this.r2Service.uploadFile(key, content);
			
			if (success) {
				new Notice(`✅ Synced ${file.name} to R2`);
				this.settings.lastSyncTime = new Date().toISOString();
				if (this.settings.debugMode) {
					console.log(`🔍 R2 Debug: Successfully synced ${file.name}`);
				}
			} else {
				new Notice(`❌ Failed to sync ${file.name}`);
				if (this.settings.debugMode) {
					console.log(`🔍 R2 Debug: Failed to sync ${file.name}`);
				}
			}
			
			return success;
		} catch (error) {
			console.error('Sync error:', error);
			new Notice(`❌ Error syncing ${file.name}: ${error.message}`);
			if (this.settings.debugMode) {
				console.log(`🔍 R2 Debug: Sync error for ${file.name}:`, error);
			}
			return false;
		} finally {
			this.syncInProgress = false;
			this.settings.syncInProgress = false;
		}
	}

	async syncAllFiles(): Promise<boolean> {
		if (this.syncInProgress || !this.r2Service) {
			return false;
		}

		this.syncInProgress = true;
		this.settings.syncInProgress = true;

		try {
			// First, check for remote changes and download them
			if (this.settings.bidirectionalSync) {
				await this.downloadRemoteChanges();
			}

			// Then sync local files to remote
			const files = this.getFilesToSync();
			let successCount = 0;
			let totalCount = files.length;

			if (this.settings.debugMode) {
				console.log(`🔍 R2 Debug: Found ${totalCount} files to sync`);
				console.log(`🔍 R2 Debug: Base folder: ${this.settings.baseFolder || this.app.vault.getName()}`);
				files.forEach(file => {
					console.log(`🔍 R2 Debug: File: ${file.path} -> Key: ${this.getFileKey(file)}`);
				});
			}

			new Notice(`🔄 Starting sync of ${totalCount} files...`);

			for (const file of files) {
				const content = await this.app.vault.read(file);
				const key = this.getFileKey(file);
				
				if (this.settings.debugMode) {
					console.log(`🔍 R2 Debug: Syncing ${file.path} -> ${key}`);
				}
				
				const success = await this.r2Service.uploadFile(key, content);
				if (success) {
					successCount++;
				}
			}

			this.settings.lastSyncTime = new Date().toISOString();
			
			if (successCount === totalCount) {
				new Notice(`✅ Successfully synced all ${totalCount} files!`);
			} else {
				new Notice(`⚠️ Synced ${successCount}/${totalCount} files`);
			}

			return successCount > 0;
		} catch (error) {
			console.error('Bulk sync error:', error);
			new Notice(`❌ Error during bulk sync: ${error.message}`);
			return false;
		} finally {
			this.syncInProgress = false;
			this.settings.syncInProgress = false;
		}
	}

	async downloadRemoteChanges(): Promise<boolean> {
		if (!this.r2Service || !this.settings.bidirectionalSync) {
			return false;
		}

		try {
			// Get all remote files from the vault folder
			const vaultName = this.app.vault.getName();
			const baseFolder = this.settings.baseFolder || vaultName;
			const remoteFiles = await this.r2Service.listFiles(baseFolder);
			let downloadedCount = 0;
			let updatedCount = 0;

			if (this.settings.debugMode) {
				console.log(`🔍 R2 Debug: Found ${remoteFiles.length} remote files in ${baseFolder}`);
			}

			for (const remoteKey of remoteFiles) {
				// Skip backup files
				if (remoteKey.startsWith('backups/')) {
					continue;
				}

				const localPath = this.getLocalPathFromKey(remoteKey);
				const localFile = this.app.vault.getAbstractFileByPath(localPath);

				if (localFile && localFile instanceof TFile) {
					// File exists locally, check if remote is newer
					const remoteContent = await this.r2Service.downloadFile(remoteKey);
					if (remoteContent) {
						const localContent = await this.app.vault.read(localFile);
						if (remoteContent !== localContent) {
							// Remote is different, update local
							await this.app.vault.modify(localFile, remoteContent);
							updatedCount++;
							if (this.settings.debugMode) {
								console.log(`🔍 R2 Debug: Updated local file ${localPath} with remote changes`);
							}
						}
					}
				} else {
					// File doesn't exist locally, download it (manually added files)
					const remoteContent = await this.r2Service.downloadFile(remoteKey);
					if (remoteContent) {
						// Ensure the directory exists
						const pathParts = localPath.split('/');
						if (pathParts.length > 1) {
							const dirPath = pathParts.slice(0, -1).join('/');
							if (!this.app.vault.getAbstractFileByPath(dirPath)) {
								await this.app.vault.createFolder(dirPath);
							}
						}
						
						await this.app.vault.create(localPath, remoteContent);
						downloadedCount++;
						if (this.settings.debugMode) {
							console.log(`🔍 R2 Debug: Downloaded new file ${localPath} from remote`);
						}
					}
				}
			}

			const totalChanges = downloadedCount + updatedCount;
			if (totalChanges > 0) {
				new Notice(`✅ Downloaded ${downloadedCount} new files, updated ${updatedCount} existing files`);
			}

			return true;
		} catch (error) {
			console.error('Download remote changes error:', error);
			new Notice(`Error downloading remote changes: ${error.message}`);
			return false;
		}
	}

	async downloadAndSync(): Promise<boolean> {
		if (this.syncInProgress || !this.r2Service || !this.settings.bidirectionalSync) {
			return false;
		}

		this.syncInProgress = true;
		this.settings.syncInProgress = true;

		try {
			const success = await this.downloadRemoteChanges();
			return success;
		} catch (error) {
			console.error('Download sync error:', error);
			new Notice(`Error downloading remote changes: ${error.message}`);
			return false;
		} finally {
			this.syncInProgress = false;
			this.settings.syncInProgress = false;
		}
	}

	private getFilesToSync(): TFile[] {
		// Get all files including media files
		const allFiles = this.app.vault.getFiles();
		const vaultName = this.app.vault.getName();
		const baseFolder = this.settings.baseFolder || vaultName;
		
		// Filter files by extension and base folder
		return allFiles.filter(file => {
			const isSupportedFile = file.extension === 'md' || 
				file.extension === 'png' || file.extension === 'jpg' || 
				file.extension === 'jpeg' || file.extension === 'gif' || 
				file.extension === 'svg' || file.extension === 'webp' ||
				file.extension === 'pdf' || file.extension === 'txt';
			
			if (!isSupportedFile) return false;
			
			// If no base folder specified, sync all files
			if (!this.settings.baseFolder) {
				return true;
			}
			
			// If base folder is set to vault name, include all files in the vault
			if (baseFolder === vaultName) {
				return true;
			}
			
			// Filter by base folder
			return file.path.startsWith(baseFolder + '/') || file.path === baseFolder;
		});
	}

	private getFileKey(file: TFile): string {
		// Use vault name as base folder if not specified
		const vaultName = this.app.vault.getName();
		const baseFolder = this.settings.baseFolder || vaultName;
		
		// If base folder is set and file is in that folder, remove the base folder prefix
		if (baseFolder && file.path.startsWith(baseFolder + '/')) {
			return file.path.substring(baseFolder.length + 1);
		} else if (baseFolder && file.path === baseFolder) {
			return file.name;
		} else if (baseFolder) {
			// If base folder is set but file is not in it, prepend the base folder
			return `${baseFolder}/${file.path}`;
		} else {
			// No base folder set, use file path as is
			return file.path;
		}
	}

	private getLocalPathFromKey(key: string): string {
		// Use vault name as base folder if not specified
		const vaultName = this.app.vault.getName();
		const baseFolder = this.settings.baseFolder || vaultName;
		
		// If key starts with the base folder, remove it to get the relative path
		if (key.startsWith(baseFolder + '/')) {
			return key.substring(baseFolder.length + 1);
		} else if (key === baseFolder) {
			// This shouldn't happen, but handle it gracefully
			return '';
		} else {
			// If key doesn't start with base folder, use it as is
			return key;
		}
	}

	isSyncInProgress(): boolean {
		return this.syncInProgress;
	}

	getLastSyncTime(): string {
		return this.settings.lastSyncTime;
	}

	// Backup functionality
	async createBackup(folderPath: string): Promise<boolean> {
		if (!this.r2Service || !this.settings.enableBackups) {
			return false;
		}

		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const success = await this.r2Service.createBackup(folderPath, timestamp);
			
			if (success) {
				new Notice(`Backup created for ${folderPath}`);
			} else {
				new Notice(`Failed to create backup for ${folderPath}`);
			}
			
			return success;
		} catch (error) {
			console.error('Backup creation error:', error);
			new Notice(`Error creating backup: ${error.message}`);
			return false;
		}
	}

	async listBackups(): Promise<Array<{timestamp: string, folderPath: string}>> {
		if (!this.r2Service) {
			return [];
		}

		try {
			return await this.r2Service.listBackups();
		} catch (error) {
			console.error('List backups error:', error);
			return [];
		}
	}

	async deleteBackup(timestamp: string): Promise<boolean> {
		if (!this.r2Service) {
			return false;
		}

		try {
			const success = await this.r2Service.deleteBackup(timestamp);
			
			if (success) {
				new Notice(`Backup ${timestamp} deleted`);
			} else {
				new Notice(`Failed to delete backup ${timestamp}`);
			}
			
			return success;
		} catch (error) {
			console.error('Backup deletion error:', error);
			new Notice(`Error deleting backup: ${error.message}`);
			return false;
		}
	}

	async cleanupOldBackups(): Promise<number> {
		if (!this.r2Service || !this.settings.enableBackups) {
			return 0;
		}

		try {
			const deletedCount = await this.r2Service.cleanupOldBackups(this.settings.backupRetentionDays);
			
			if (deletedCount > 0) {
				new Notice(`Cleaned up ${deletedCount} old backups`);
			}
			
			return deletedCount;
		} catch (error) {
			console.error('Backup cleanup error:', error);
			return 0;
		}
	}

	// Export credentials as base64 encoded JSON
	exportCredentials(): string {
		const credentials = {
			r2AccountId: this.settings.r2AccountId,
			r2AccessKeyId: this.settings.r2AccessKeyId,
			r2SecretAccessKey: this.settings.r2SecretAccessKey,
			r2BucketName: this.settings.r2BucketName,
			r2Region: this.settings.r2Region,
			customEndpoint: this.settings.customEndpoint,
			baseFolder: this.settings.baseFolder,
			vaultName: this.app.vault.getName()
		};
		
		const jsonString = JSON.stringify(credentials, null, 2);
		return btoa(jsonString);
	}

	// Import credentials from base64 encoded JSON
	importCredentials(base64Data: string): boolean {
		try {
			const jsonString = atob(base64Data);
			const credentials = JSON.parse(jsonString);
			
			// Validate required fields
			if (!credentials.r2AccountId || !credentials.r2AccessKeyId || 
				!credentials.r2SecretAccessKey || !credentials.r2BucketName) {
				new Notice('❌ Invalid credentials: Missing required fields');
				return false;
			}
			
			// Update settings
			this.settings.r2AccountId = credentials.r2AccountId;
			this.settings.r2AccessKeyId = credentials.r2AccessKeyId;
			this.settings.r2SecretAccessKey = credentials.r2SecretAccessKey;
			this.settings.r2BucketName = credentials.r2BucketName;
			this.settings.r2Region = credentials.r2Region || 'eu';
			this.settings.customEndpoint = credentials.customEndpoint || '';
			this.settings.baseFolder = credentials.baseFolder || '';
			
			// Update R2 service
			this.updateR2Service();
			
			new Notice('✅ Credentials imported successfully');
			return true;
		} catch (error) {
			console.error('Import credentials error:', error);
			new Notice('❌ Failed to import credentials: Invalid format');
			return false;
		}
	}

	// Get current settings for saving
	getSettings() {
		return this.settings;
	}
}
