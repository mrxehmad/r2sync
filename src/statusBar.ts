import { Component, WorkspaceLeaf } from 'obsidian';
import { SyncManager } from './syncManager';

export class StatusBarComponent extends Component {
	private statusBarItem: HTMLElement;
	private syncManager: SyncManager;
	private updateInterval: number;

	constructor(statusBarItem: HTMLElement, syncManager: SyncManager) {
		super();
		this.statusBarItem = statusBarItem;
		this.syncManager = syncManager;
		this.updateInterval = 0;
	}

	onload() {
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
		if (this.syncManager.isSyncInProgress()) {
			this.statusBarItem.setText('R2 Sync in progress...');
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

				this.statusBarItem.setText(`R2 Last sync: ${timeAgo}`);
			} else {
				this.statusBarItem.setText('R2 Sync ready');
			}
			this.statusBarItem.removeClass('r2sync-syncing');
		}
	}

	showSyncStatus(message: string) {
		this.statusBarItem.setText(message);
		setTimeout(() => {
			this.updateStatus();
		}, 3000);
	}
}
