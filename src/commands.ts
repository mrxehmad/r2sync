import { Plugin } from 'obsidian';
import { SyncManager } from './syncManager';
import { StatusBarComponent } from './statusBar';
import { R2SyncSettings } from './settings';

export function registerCommands(plugin: Plugin & { settings: R2SyncSettings; saveSettings: () => Promise<void> }, syncManager: SyncManager, statusBar: StatusBarComponent) {
	// Test connection command
	plugin.addCommand({
		id: 'test-connection',
		name: 'Test R2 connection',
		callback: async () => {
			statusBar.showSyncStatus('🔄 Testing R2 connection...');
			await syncManager.testConnection();
		}
	});


	// Sync current file command
	plugin.addCommand({
		id: 'sync-current-file',
		name: 'Sync current file to R2',
		editorCallback: async (editor, view) => {
			const file = view.file;
			if (file) {
				statusBar.showSyncStatus(`🔄 Syncing ${file.name}...`);
				await syncManager.syncFile(file);
			}
		}
	});

	// Export credentials command
	plugin.addCommand({
		id: 'export-credentials',
		name: 'Export R2 credentials',
		callback: async () => {
			const credentials = syncManager.exportCredentials();
			await navigator.clipboard.writeText(credentials);
			statusBar.showSyncStatus('✅ Credentials copied to clipboard');
		}
	});

	// Manual sync command (moved to last position)
	plugin.addCommand({
		id: 'manual-sync',
		name: 'Sync to R2 (with remote changes)',
		callback: async () => {
			statusBar.showSyncStatus('Starting manual sync...');
			await syncManager.syncAllFiles();
		}
	});

	// Scan and sync manually added (missing) files
	plugin.addCommand({
		id: 'sync-missing-files',
		name: 'Scan and sync manually added files',
		callback: async () => {
			statusBar.showSyncStatus('Scanning for manually added files...');
			await syncManager.syncMissingFiles();
		}
	});

}
