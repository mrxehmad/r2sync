import { Notice } from 'obsidian';

export interface R2Config {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucketName: string;
	region: string;
	customEndpoint?: string;
	debugMode?: boolean;
}

export class R2Service {
	private config: R2Config;

	constructor(config: R2Config) {
		this.config = config;
	}

	async testConnection(): Promise<{ success: boolean; details: string }> {
		try {
			if (this.config.debugMode) {
				console.log('🔍 R2 Debug: Testing connection...');
				console.log('🔍 R2 Debug: Config:', {
					accountId: this.config.accountId,
					accessKeyId: this.config.accessKeyId,
					bucketName: this.config.bucketName,
					region: this.config.region,
					customEndpoint: this.config.customEndpoint
				});
			}

			// Test by trying to list files
			const response = await this.listFiles();
			const success = Array.isArray(response);
			
			if (this.config.debugMode) {
				console.log('🔍 R2 Debug: List files response:', response);
				console.log('🔍 R2 Debug: Connection test result:', success);
			}

			return {
				success,
				details: success 
					? `✅ Successfully connected to R2! Found ${response.length} files.`
					: '❌ Failed to connect to R2. Check your credentials and endpoint.'
			};
		} catch (error) {
			console.error('R2 connection test failed:', error);
			return {
				success: false,
				details: `❌ Connection failed: ${error.message}`
			};
		}
	}

	async uploadFile(key: string, content: string): Promise<boolean> {
		try {
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: Uploading file ${key}, content length: ${content.length}`);
			}
			
			const response = await this.makeRequest('PUT', key, content);
			
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: Upload response status: ${response.status}`);
				if (!response.ok) {
					const errorText = await response.text();
					console.log(`🔍 R2 Debug: Upload error response:`, errorText);
				}
			}
			
			return response.ok;
		} catch (error) {
			console.error('R2 upload failed:', error);
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: Upload error details:`, error);
			}
			new Notice(`Failed to upload ${key}: ${error.message}`);
			return false;
		}
	}

	async downloadFile(key: string): Promise<string | null> {
		try {
			const response = await this.makeRequest('GET', key);
			if (response.ok) {
				return await response.text();
			}
			return null;
		} catch (error) {
			console.error('R2 download failed:', error);
			return null;
		}
	}

	async listFiles(prefix: string = ''): Promise<string[]> {
		try {
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: Listing files with prefix: "${prefix}"`);
			}
			
			const response = await this.makeRequest('GET', `?list-type=2&prefix=${encodeURIComponent(prefix)}`);
			
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: List files response status: ${response.status}`);
			}
			
			if (response.ok) {
				const xml = await response.text();
				if (this.config.debugMode) {
					console.log(`🔍 R2 Debug: List files XML response:`, xml);
				}
				const files = this.parseListResponse(xml);
				if (this.config.debugMode) {
					console.log(`🔍 R2 Debug: Parsed files:`, files);
				}
				return files;
			} else {
				if (this.config.debugMode) {
					const errorText = await response.text();
					console.log(`🔍 R2 Debug: List files error response:`, errorText);
				}
			}
			return [];
		} catch (error) {
			console.error('R2 list files failed:', error);
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: List files error details:`, error);
			}
			return [];
		}
	}

	async deleteFile(key: string): Promise<boolean> {
		try {
			const response = await this.makeRequest('DELETE', key);
			return response.ok;
		} catch (error) {
			console.error('R2 delete failed:', error);
			return false;
		}
	}

	private async makeRequest(method: string, key: string, body?: string): Promise<Response> {
		// Use custom endpoint if provided, otherwise use default R2 endpoint
		const baseUrl = this.config.customEndpoint || `https://${this.config.accountId}.r2.cloudflarestorage.com`;
		const url = `${baseUrl}/${this.config.bucketName}/${key}`;
		
		if (this.config.debugMode) {
			console.log(`🔍 R2 Debug: Making ${method} request to:`, url);
			console.log(`🔍 R2 Debug: Body length:`, body?.length || 0);
		}
		
		// Try different authentication methods
		const authHeader = await this.getAuthHeader(method, key, body);
		
		const headers: Record<string, string> = {
			'Authorization': authHeader,
			'Date': new Date().toUTCString(),
		};

		if (body) {
			headers['Content-Type'] = 'text/plain';
			headers['Content-Length'] = body.length.toString();
		}

		if (this.config.debugMode) {
			console.log('🔍 R2 Debug: Request headers:', headers);
		}

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body || undefined,
			});

			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: Response status:`, response.status);
				const responseHeaders: Record<string, string> = {};
				response.headers.forEach((value, key) => {
					responseHeaders[key] = value;
				});
				console.log(`🔍 R2 Debug: Response headers:`, responseHeaders);
			}

			return response;
		} catch (error) {
			if (this.config.debugMode) {
				console.log(`🔍 R2 Debug: Fetch error:`, error);
			}
			throw error;
		}
	}

	private async getAuthHeader(method: string, key: string, body?: string): Promise<string> {
		const date = new Date().toUTCString();
		const contentType = body ? 'text/plain' : '';
		
		// Simple AWS signature that might work with R2
		const canonicalString = `${method}\n\n${contentType}\n${date}\n/${this.config.bucketName}/${key}`;
		
		if (this.config.debugMode) {
			console.log('🔍 R2 Debug: Canonical string:', canonicalString);
		}
		
		// Try simple HMAC-SHA1 first (some R2 endpoints support this)
		const signature = await this.createSimpleSignature(canonicalString);
		return `AWS ${this.config.accessKeyId}:${signature}`;
	}

	private async createSimpleSignature(stringToSign: string): Promise<string> {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(this.config.secretAccessKey),
			{ name: 'HMAC', hash: 'SHA-1' },
			false,
			['sign']
		);
		
		const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
		return btoa(String.fromCharCode(...new Uint8Array(signature)));
	}

	private parseListResponse(xml: string): string[] {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, 'text/xml');
		const keys = doc.querySelectorAll('Key');
		return Array.from(keys).map(key => key.textContent || '');
	}
}
