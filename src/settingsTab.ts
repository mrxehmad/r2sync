import { App, PluginSettingTab, Setting, Plugin } from 'obsidian';
import { R2SyncSettings } from './settings';

type SyncManager = {
	testConnection: () => Promise<boolean>;
	syncAllFiles: () => Promise<boolean>;
	syncMissingFiles: () => Promise<boolean>;
	createBackup: (folderPath: string) => Promise<boolean>;
	cleanupOldBackups: () => Promise<number>;
	exportCredentials: () => string;
	importCredentials: (data: string) => boolean;
	updateSettings: (settings: R2SyncSettings) => void;
};

export class R2SyncSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: R2SyncSettings; syncManager: SyncManager; saveSettings: () => Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: R2SyncSettings; syncManager: SyncManager; saveSettings: () => Promise<void> }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Configuration').setHeading();

		// R2 Configuration Section
		new Setting(containerEl).setName('Cloudflare r2 configuration').setHeading();

		new Setting(containerEl)
			.setName('Account ID')
			.setDesc('Your Cloudflare r2 account ID')
			.addText(text => text
				.setPlaceholder('Enter your R2 account ID')
				.setValue(this.plugin.settings.r2AccountId)
				.onChange(async (value) => {
					this.plugin.settings.r2AccountId = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Access key ID')
			.setDesc('Your r2 access key ID')
			.addText(text => text
				.setPlaceholder('Enter your access key ID')
				.setValue(this.plugin.settings.r2AccessKeyId)
				.onChange(async (value) => {
					this.plugin.settings.r2AccessKeyId = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Secret access key')
			.setDesc('Your r2 secret access key')
			.addText(text => {
				text.setPlaceholder('Enter your secret access key')
					.setValue(this.plugin.settings.r2SecretAccessKey);
				text.inputEl.type = 'password';
				text.onChange(async (value) => {
					this.plugin.settings.r2SecretAccessKey = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				});
			});

		new Setting(containerEl)
			.setName('Bucket name')
			.setDesc('Your r2 bucket name')
			.addText(text => text
				.setPlaceholder('Enter your bucket name')
				.setValue(this.plugin.settings.r2BucketName)
				.onChange(async (value) => {
					this.plugin.settings.r2BucketName = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Region')
			.setDesc('R2 region (usually "auto")')
			.addText(text => text
				.setPlaceholder('Auto')
				.setValue(this.plugin.settings.r2Region)
				.onChange(async (value) => {
					this.plugin.settings.r2Region = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Custom S3 endpoint')
			.setDesc('Custom S3 endpoint URL (e.g., https://id.r2.cloudflarestorage.com)')
			.addText(text => text
				.setPlaceholder('https://your-account-id.r2.cloudflarestorage.com')
				.setValue(this.plugin.settings.customEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.customEndpoint = value;	
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		// Sync Configuration Section
		new Setting(containerEl).setName('Sync configuration').setHeading();

		new Setting(containerEl)
			.setName('Base folder')
			.setDesc('Folder to sync (leave empty to sync entire vault)')
			.addText(text => text
				.setPlaceholder('e.g., Notes or MyVault/Notes')
				.setValue(this.plugin.settings.baseFolder)
				.onChange(async (value) => {
					this.plugin.settings.baseFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto sync on save')
			.setDesc('Automatically sync files when they are saved')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bidirectional sync')
			.setDesc('Download changes from r2 and merge with local files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.bidirectionalSync)
				.onChange(async (value) => {
					this.plugin.settings.bidirectionalSync = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Merge all devices')
			.setDesc('Sync files from all devices, not just current vault')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.mergeAllDevices)
				.onChange(async (value) => {
					this.plugin.settings.mergeAllDevices = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto sync delay')
			.setDesc('Delay in seconds before auto-sync triggers after file changes (prevents excessive syncing)')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(this.plugin.settings.syncDelay.toString())
				.onChange(async (value) => {
					const delay = parseInt(value) || 5;
					this.plugin.settings.syncDelay = delay;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bidirectional sync interval')
			.setDesc('How often to check for remote changes (in minutes). Lower values = more frequent checks for manually added files')
			.addText(text => text
				.setPlaceholder('2')
				.setValue(this.plugin.settings.bidirectionalSyncInterval.toString())
				.onChange(async (value) => {
					const interval = parseInt(value) || 2;
					this.plugin.settings.bidirectionalSyncInterval = interval;
					await this.plugin.saveSettings();
				}));

		// Backup Section
		new Setting(containerEl).setName('Backup configuration').setHeading();

		new Setting(containerEl)
			.setName('Enable backups')
			.setDesc('Create timestamped backups of your files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBackups)
				.onChange(async (value) => {
					this.plugin.settings.enableBackups = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Backup retention days')
			.setDesc('Number of days to keep backups (0 = keep forever)')
			.addText(text => text
				.setPlaceholder('30')
				.setValue(this.plugin.settings.backupRetentionDays.toString())
				.onChange(async (value) => {
					const days = parseInt(value) || 30;
					this.plugin.settings.backupRetentionDays = days;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto backup on sync')
			.setDesc('Automatically create backup before syncing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoBackupOnSync)
				.onChange(async (value) => {
					this.plugin.settings.autoBackupOnSync = value;
					await this.plugin.saveSettings();
				}));

		// Debug Section
		new Setting(containerEl).setName('Debug & development').setHeading();

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable detailed logging in the browser console (f12 → console)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		// Connection Test Section
		new Setting(containerEl).setName('Connection & actions').setHeading();

		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Test your r2 connection with current settings')
			.addButton(button => button
				.setButtonText('Test connection')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Testing...');
					button.setDisabled(true);
					
					const success = await this.plugin.syncManager.testConnection();
					
					button.setButtonText(success ? '✅ Connected' : '❌ Failed');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Test connection');
					}, 3000);
				}));

		new Setting(containerEl)
			.setName('Manual sync')
			.setDesc('Sync all files to r2 and download remote changes')
			.addButton(button => button
				.setButtonText('Sync now')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Syncing...');
					button.setDisabled(true);
					
					await this.plugin.syncManager.syncAllFiles();
					
					button.setButtonText('Synced');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Sync now');
					}, 3000);
				}));

		// Manual scan-and-sync for pasted files
		new Setting(containerEl)
			.setName('Scan and sync manually added files')
			.setDesc('Scan the vault for files that were added outside Obsidian and upload only ones missing in R2')
			.addButton(button => button
				.setButtonText('Scan and sync new')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Scanning...');
					button.setDisabled(true);
					
					await this.plugin.syncManager.syncMissingFiles();
					
					button.setButtonText('Done');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Scan and sync new');
					}, 3000);
				}));


		new Setting(containerEl)
			.setName('Create backup')
			.setDesc('Create a timestamped backup of current folder')
			.addButton(button => button
				.setButtonText('Create backup')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Creating...');
					button.setDisabled(true);
					
					await this.plugin.syncManager.createBackup(this.plugin.settings.baseFolder || 'root');
					
					button.setButtonText('Created');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Create backup');
					}, 3000);
				}));

		new Setting(containerEl)
			.setName('Cleanup old backups')
			.setDesc('Delete backups older than retention period')
			.addButton(button => button
				.setButtonText('Cleanup')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Cleaning...');
					button.setDisabled(true);
					
					const deletedCount = await this.plugin.syncManager.cleanupOldBackups();
					
					button.setButtonText(`Cleaned ${deletedCount}`);
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Cleanup');
					}, 3000);
				}));

		// Import/Export Section
		new Setting(containerEl).setName('Import/export credentials').setHeading();

		new Setting(containerEl)
			.setName('Export credentials')
			.setDesc('Export your r2 credentials as base64 encoded data for easy setup on other devices')
			.addButton(button => button
				.setButtonText('Export to clipboard')
				.setCta()
				.onClick(async () => {
					const credentials = this.plugin.syncManager.exportCredentials();
					await navigator.clipboard.writeText(credentials);
					button.setButtonText('✅ copied!');
					
					setTimeout(() => {
						button.setButtonText('Export to clipboard');
					}, 3000);
				}));

		// Import credentials input
		const importContainer = containerEl.createDiv('r2sync-import-container');
		new Setting(importContainer).setName('Import credentials').setHeading();
		importContainer.createEl('p', { text: 'Paste your base64 encoded credentials data below:' });
		
		const importTextArea = importContainer.createEl('textarea', {
			placeholder: 'Paste your base64 encoded credentials here...',
			attr: { rows: '4', style: 'width: 100%; margin: 10px 0;' }
		});

		new Setting(importContainer)
			.setName('Import credentials')
			.setDesc('Import r2 credentials from the text area above')
			.addButton(button => button
				.setButtonText('Import credentials')
				.setCta()
				.onClick(async () => {
					try {
						const credentials = importTextArea.value.trim();
						if (!credentials) {
							button.setButtonText('❌ empty');
							setTimeout(() => {
								button.setButtonText('Import credentials');
							}, 2000);
							return;
						}
						
						const success = this.plugin.syncManager.importCredentials(credentials);
						
						if (success) {
							button.setButtonText('✅ imported!');
							await this.plugin.saveSettings();
							// Clear the text area
							importTextArea.value = '';
							// Refresh the settings display
							this.display();
						} else {
							button.setButtonText('❌ failed');
						}
						
						setTimeout(() => {
							button.setButtonText('Import credentials');
						}, 3000);
					} catch {
						button.setButtonText('❌ error');
						setTimeout(() => {
							button.setButtonText('Import credentials');
						}, 3000);
					}
				}));

		// Status Section
		new Setting(containerEl).setName('Status').setHeading();

		const statusContainer = containerEl.createDiv('r2sync-status-container');
		
		if (this.plugin.settings.lastSyncTime) {
			const lastSync = new Date(this.plugin.settings.lastSyncTime);
			statusContainer.createEl('p', { 
				text: `Last sync: ${lastSync.toLocaleString()}` 
			});
		} else {
			statusContainer.createEl('p', { 
				text: 'No sync performed yet' 
			});
		}

		if (this.plugin.settings.syncInProgress) {
			statusContainer.createEl('p', { 
				text: '🔄 sync in progress...' 
			});
		}
	}
}
