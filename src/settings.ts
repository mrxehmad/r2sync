export interface R2SyncSettings {
	// R2 Configuration
	r2AccountId: string;
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
	r2BucketName: string;
	r2Region: string;
	customEndpoint: string;
	
	// Sync Configuration
	baseFolder: string;
	autoSync: boolean;
	bidirectionalSync: boolean;
	mergeAllDevices: boolean;
	syncDelay: number; // Delay in seconds before auto-sync triggers
	bidirectionalSyncInterval: number; // Interval in minutes for bidirectional sync
	
	// Backup Configuration
	enableBackups: boolean;
	backupRetentionDays: number;
	autoBackupOnSync: boolean;
	
	// Debug
	debugMode: boolean;
	
	// Import/Export
	exportCredentials: boolean;
	
	// Status
	lastSyncTime: string;
	syncInProgress: boolean;
}

export const DEFAULT_SETTINGS: R2SyncSettings = {
	r2AccountId: '',
	r2AccessKeyId: '',
	r2SecretAccessKey: '',
	r2BucketName: '',
	r2Region: 'eu',
	customEndpoint: '',
	baseFolder: '',
	autoSync: true,
	bidirectionalSync: true,
	mergeAllDevices: true,
	syncDelay: 5, // 5 seconds default delay
	bidirectionalSyncInterval: 2, // Check every 2 minutes by default
	enableBackups: false,
	backupRetentionDays: 30,
	autoBackupOnSync: false,
	debugMode: false,
	exportCredentials: false,
	lastSyncTime: '',
	syncInProgress: false
};
