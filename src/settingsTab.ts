import { App, PluginSettingTab, Setting, Plugin } from 'obsidian';
import { R2SyncSettings } from './settings';

export class R2SyncSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: R2SyncSettings; syncManager: any; saveSettings: () => Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: R2SyncSettings; syncManager: any; saveSettings: () => Promise<void> }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'R2 Sync Settings' });

		// R2 Configuration Section
		containerEl.createEl('h3', { text: 'Cloudflare R2 Configuration' });

		new Setting(containerEl)
			.setName('Account ID')
			.setDesc('Your Cloudflare R2 Account ID')
			.addText(text => text
				.setPlaceholder('Enter your R2 Account ID')
				.setValue(this.plugin.settings.r2AccountId)
				.onChange(async (value) => {
					this.plugin.settings.r2AccountId = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Access Key ID')
			.setDesc('Your R2 Access Key ID')
			.addText(text => text
				.setPlaceholder('Enter your Access Key ID')
				.setValue(this.plugin.settings.r2AccessKeyId)
				.onChange(async (value) => {
					this.plugin.settings.r2AccessKeyId = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Secret Access Key')
			.setDesc('Your R2 Secret Access Key')
			.addText(text => {
				text.setPlaceholder('Enter your Secret Access Key')
					.setValue(this.plugin.settings.r2SecretAccessKey);
				text.inputEl.type = 'password';
				text.onChange(async (value) => {
					this.plugin.settings.r2SecretAccessKey = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				});
			});

		new Setting(containerEl)
			.setName('Bucket Name')
			.setDesc('Your R2 Bucket Name')
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
			.setDesc('R2 Region (usually "auto")')
			.addText(text => text
				.setPlaceholder('auto')
				.setValue(this.plugin.settings.r2Region)
				.onChange(async (value) => {
					this.plugin.settings.r2Region = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Custom S3 Endpoint')
			.setDesc('Custom S3 endpoint URL (e.g., https://c09cdd363854405588c7509152ceb0db.eu.r2.cloudflarestorage.com)')
			.addText(text => text
				.setPlaceholder('https://your-account-id.r2.cloudflarestorage.com')
				.setValue(this.plugin.settings.customEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.customEndpoint = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		// Sync Configuration Section
		containerEl.createEl('h3', { text: 'Sync Configuration' });

		new Setting(containerEl)
			.setName('Base Folder')
			.setDesc('Folder to sync (leave empty to sync entire vault)')
			.addText(text => text
				.setPlaceholder('e.g., Notes or MyVault/Notes')
				.setValue(this.plugin.settings.baseFolder)
				.onChange(async (value) => {
					this.plugin.settings.baseFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Sync on Save')
			.setDesc('Automatically sync files when they are saved')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSync)
				.onChange(async (value) => {
					this.plugin.settings.autoSync = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bidirectional Sync')
			.setDesc('Download changes from R2 and merge with local files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.bidirectionalSync)
				.onChange(async (value) => {
					this.plugin.settings.bidirectionalSync = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Merge All Devices')
			.setDesc('Sync files from all devices, not just current vault')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.mergeAllDevices)
				.onChange(async (value) => {
					this.plugin.settings.mergeAllDevices = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Sync Delay')
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
			.setName('Bidirectional Sync Interval')
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
		containerEl.createEl('h3', { text: 'Backup Configuration' });

		new Setting(containerEl)
			.setName('Enable Backups')
			.setDesc('Create timestamped backups of your files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBackups)
				.onChange(async (value) => {
					this.plugin.settings.enableBackups = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Backup Retention Days')
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
			.setName('Auto Backup on Sync')
			.setDesc('Automatically create backup before syncing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoBackupOnSync)
				.onChange(async (value) => {
					this.plugin.settings.autoBackupOnSync = value;
					await this.plugin.saveSettings();
				}));

		// Debug Section
		containerEl.createEl('h3', { text: 'Debug & Development' });

		new Setting(containerEl)
			.setName('Debug Mode')
			.setDesc('Enable detailed logging in the browser console (F12 → Console)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
					this.plugin.syncManager.updateSettings(this.plugin.settings);
				}));

		// Connection Test Section
		containerEl.createEl('h3', { text: 'Connection & Actions' });

		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Test your R2 connection with current settings')
			.addButton(button => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Testing...');
					button.setDisabled(true);
					
					const success = await this.plugin.syncManager.testConnection();
					
					button.setButtonText(success ? '✅ Connected' : '❌ Failed');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Test Connection');
					}, 3000);
				}));

		new Setting(containerEl)
			.setName('Manual Sync')
			.setDesc('Sync all files to R2 and download remote changes')
			.addButton(button => button
				.setButtonText('Sync Now')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Syncing...');
					button.setDisabled(true);
					
					await this.plugin.syncManager.syncAllFiles();
					
					button.setButtonText('Synced');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Sync Now');
					}, 3000);
				}));

		// Manual scan-and-sync for pasted files
		new Setting(containerEl)
			.setName('Scan and Sync Manually Added Files')
			.setDesc('Scan the vault for files that were added outside Obsidian and upload only ones missing in R2')
			.addButton(button => button
				.setButtonText('Scan and Sync New')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Scanning...');
					button.setDisabled(true);
					
					await this.plugin.syncManager.syncMissingFiles();
					
					button.setButtonText('Done');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Scan and Sync New');
					}, 3000);
				}));


		new Setting(containerEl)
			.setName('Create Backup')
			.setDesc('Create a timestamped backup of current folder')
			.addButton(button => button
				.setButtonText('Create Backup')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Creating...');
					button.setDisabled(true);
					
					await this.plugin.syncManager.createBackup(this.plugin.settings.baseFolder || 'root');
					
					button.setButtonText('Created');
					button.setDisabled(false);
					
					setTimeout(() => {
						button.setButtonText('Create Backup');
					}, 3000);
				}));

		new Setting(containerEl)
			.setName('Cleanup Old Backups')
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
		containerEl.createEl('h3', { text: 'Import/Export Credentials' });

		new Setting(containerEl)
			.setName('Export Credentials')
			.setDesc('Export your R2 credentials as base64 encoded data for easy setup on other devices')
			.addButton(button => button
				.setButtonText('Export to Clipboard')
				.setCta()
				.onClick(async () => {
					const credentials = this.plugin.syncManager.exportCredentials();
					await navigator.clipboard.writeText(credentials);
					button.setButtonText('✅ Copied!');
					
					setTimeout(() => {
						button.setButtonText('Export to Clipboard');
					}, 3000);
				}));

		// Import credentials input
		const importContainer = containerEl.createDiv('r2sync-import-container');
		importContainer.createEl('h4', { text: 'Import Credentials' });
		importContainer.createEl('p', { text: 'Paste your base64 encoded credentials data below:' });
		
		const importTextArea = importContainer.createEl('textarea', {
			placeholder: 'Paste your base64 encoded credentials here...',
			attr: { rows: '4', style: 'width: 100%; margin: 10px 0;' }
		});

		new Setting(importContainer)
			.setName('Import Credentials')
			.setDesc('Import R2 credentials from the text area above')
			.addButton(button => button
				.setButtonText('Import Credentials')
				.setCta()
				.onClick(async () => {
					try {
						const credentials = importTextArea.value.trim();
						if (!credentials) {
							button.setButtonText('❌ Empty');
							setTimeout(() => {
								button.setButtonText('Import Credentials');
							}, 2000);
							return;
						}
						
						const success = this.plugin.syncManager.importCredentials(credentials);
						
						if (success) {
							button.setButtonText('✅ Imported!');
							await this.plugin.saveSettings();
							// Clear the text area
							importTextArea.value = '';
							// Refresh the settings display
							this.display();
						} else {
							button.setButtonText('❌ Failed');
						}
						
						setTimeout(() => {
							button.setButtonText('Import Credentials');
						}, 3000);
					} catch (error) {
						button.setButtonText('❌ Error');
						setTimeout(() => {
							button.setButtonText('Import Credentials');
						}, 3000);
					}
				}));

		// Status Section
		containerEl.createEl('h3', { text: 'Status' });

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
				text: '🔄 Sync in progress...' 
			});
		}
	}
}
