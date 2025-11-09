import { Plugin, TFile } from 'obsidian';
import { R2SyncSettings, DEFAULT_SETTINGS } from './src/settings';
import { SyncManager } from './src/syncManager';
import { StatusBarComponent } from './src/statusBar';
import { registerCommands } from './src/commands';
import { R2SyncSettingTab } from './src/settingsTab';

export default class R2SyncPlugin extends Plugin {
	settings: R2SyncSettings;
	syncManager: SyncManager;
	statusBar: StatusBarComponent;
	private syncTimeout: number | null = null;
	private debounceId: number = 0;

	async onload() {
		await this.loadSettings();

		// Set default base folder to vault name if not already set
		if (!this.settings.baseFolder) {
			const vaultName = this.app.vault.getName();
			this.settings.baseFolder = vaultName;
			await this.saveSettings();
		}

		// Initialize sync manager
		this.syncManager = new SyncManager(this.app, this.settings);

		// Create status bar
		const statusBarItem = this.addStatusBarItem();
		this.statusBar = new StatusBarComponent(statusBarItem, this.syncManager);
		this.addChild(this.statusBar);

		// Add manual sync button to left ribbon
		const ribbonIconEl = this.addRibbonIcon('sync', 'R2 Sync', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.statusBar.showSyncStatus('Starting manual sync...');
			this.syncManager.syncAllFiles();
		});
		ribbonIconEl.addClass('r2sync-ribbon-class');

		// Register commands
		registerCommands(this, this.syncManager, this.statusBar);

		// Add settings tab
		this.addSettingTab(new R2SyncSettingTab(this.app, this));

		// Register file events for auto-sync with debouncing
		if (this.settings.autoSync) {
			this.registerEvent(
				this.app.vault.on('modify', (file: TFile) => {
					if (file instanceof TFile && (file.extension === 'md' || file.extension === 'png' || file.extension === 'jpg' || file.extension === 'jpeg' || file.extension === 'gif' || file.extension === 'svg' || file.extension === 'webp' || file.extension === 'pdf' || file.extension === 'txt')) {
						this.debouncedSync(file);
					}
				})
			);
			// Sync new files as they are created (e.g., imported from old vault)
			this.registerEvent(
				this.app.vault.on('create', (file) => {
					if (file instanceof TFile && (file.extension === 'md' || file.extension === 'png' || file.extension === 'jpg' || file.extension === 'jpeg' || file.extension === 'gif' || file.extension === 'svg' || file.extension === 'webp' || file.extension === 'pdf' || file.extension === 'txt')) {
						this.debouncedSync(file);
					}
				})
			);
			// Propagate deletions to R2
			this.registerEvent(
				this.app.vault.on('delete', (file) => {
					if (file instanceof TFile) {
						void this.syncManager.deleteRemoteForFile(file);
					}
				})
			);
		}

		// Register periodic bidirectional sync
		if (this.settings.bidirectionalSync) {
			this.registerInterval(
				window.setInterval(() => {
					void this.syncManager.downloadAndSync();
				}, this.settings.bidirectionalSyncInterval * 60 * 1000) // Use configurable interval
			);
		}

		// Show initial status
		this.statusBar.updateStatus();
	}

	onunload() {
		// Clear any pending sync timeout
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
			this.syncTimeout = null;
		}
		// Cleanup is handled automatically by Obsidian
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private debouncedSync(file: TFile) {
		// Clear existing timeout
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
		}
		// Advance token so only latest timeout runs
		this.debounceId++;
		const currentId = this.debounceId;

		// Set new timeout with configured delay
		this.syncTimeout = window.setTimeout(() => {
			// Only execute if this is the latest scheduled sync
			if (currentId === this.debounceId) {
				void this.syncManager.syncFile(file);
			}
			this.syncTimeout = null;
		}, this.settings.syncDelay * 1000);
	}
}
