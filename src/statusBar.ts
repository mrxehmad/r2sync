import { Component } from 'obsidian';
import { SyncManager } from './syncManager';

export class StatusBarComponent extends Component {
	private statusBarItem: HTMLElement;
	private syncManager: SyncManager;
	private updateInterval: number;
    private labelEl: HTMLSpanElement | null = null;
    private buttonEl: HTMLSpanElement | null = null;
    private missingBtnEl: HTMLSpanElement | null = null;

	constructor(statusBarItem: HTMLElement, syncManager: SyncManager) {
		super();
		this.statusBarItem = statusBarItem;
		this.syncManager = syncManager;
		this.updateInterval = 0;
	}

	onload() {
		// Build UI: [label]  [Sync all]  [Scan new]
		this.statusBarItem.empty();
		this.labelEl = this.statusBarItem.createEl('span', { text: '' });
		this.buttonEl = this.statusBarItem.createEl('span', { text: ' Sync all' });
		this.buttonEl.addClass('r2sync-action');
		this.buttonEl.onclick = async () => {
			this.showSyncStatus('Scanning vault and syncing...');
			await this.syncManager.syncAllFiles();
			this.updateStatus();
		};

		this.missingBtnEl = this.statusBarItem.createEl('span', { text: ' Scan new' });
		this.missingBtnEl.addClass('r2sync-action');
		this.missingBtnEl.onclick = async () => {
			this.showSyncStatus('Scanning for manually added files...');
			await this.syncManager.syncMissingFiles();
			this.updateStatus();
		};

		this.updateStatus();
		// Update status every 30 seconds
		this.updateInterval = window.setInterval(() => {
			this.updateStatus();
		}, 30000);
	}

	onunload() {
		if (this.updateInterval) {
			window.clearInterval(this.updateInterval);
		}
	}

	updateStatus() {
		if (!this.labelEl) return;
		if (this.syncManager.isSyncInProgress()) {
			this.labelEl.setText('R2 sync in progress...');
			this.statusBarItem.addClass('r2sync-syncing');
		} else {
			const lastSync = this.syncManager.getLastSyncTime();
			if (lastSync) {
				const syncDate = new Date(lastSync);
				const now = new Date();
				const diffMs = now.getTime() - syncDate.getTime();
				const diffMins = Math.floor(diffMs / 60000);
				const diffHours = Math.floor(diffMins / 60);
				const diffDays = Math.floor(diffHours / 24);

				let timeAgo = '';
				if (diffDays > 0) {
					timeAgo = `${diffDays}d ago`;
				} else if (diffHours > 0) {
					timeAgo = `${diffHours}h ago`;
				} else if (diffMins > 0) {
					timeAgo = `${diffMins}m ago`;
				} else {
					timeAgo = 'Just now';
				}

				this.labelEl.setText(`R2 last sync: ${timeAgo}`);
			} else {
				this.labelEl.setText('R2 sync ready');
			}
			this.statusBarItem.removeClass('r2sync-syncing');
		}
	}

	showSyncStatus(message: string) {
		if (!this.labelEl) return;
		this.labelEl.setText(message);
		setTimeout(() => {
			this.updateStatus();
		}, 3000);
	}
}
