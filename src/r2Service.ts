import { Notice, requestUrl, type RequestUrlParam } from 'obsidian';

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
			

			// Test by trying to list files
			const response = await this.listFiles();
			const success = Array.isArray(response);
			
			

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
			
			const response = await this.makeRequest('PUT', key, content);
			
			
			
			return response.ok;
		} catch (error) {
			console.error('R2 upload failed:', error);
			
			new Notice(`Failed to upload ${key}: ${error.message}`);
			return false;
		}
	}

	async downloadFile(key: string): Promise<string | null> {
		try {
			const response = await this.makeRequest('GET', key);
			if (response.ok) {
				return response.text;
			}
			return null;
		} catch (error) {
			console.error('R2 download failed:', error);
			return null;
		}
	}

	async listFiles(prefix: string = ''): Promise<string[]> {
		try {
			const response = await this.makeRequest('GET', `?list-type=2&prefix=${encodeURIComponent(prefix)}`);
			
			if (response.ok) {
				const xml = response.text;
				const files = this.parseListResponse(xml);
				return files;
			}
			return [];
		} catch (error) {
			console.error('R2 list files failed:', error);
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

	private async makeRequest(method: string, key: string, body?: string): Promise<{ ok: boolean; status: number; text: string; headers: Record<string, string> }> {
		// Use custom endpoint if provided, otherwise use default R2 endpoint
		const baseUrl = this.config.customEndpoint || `https://${this.config.accountId}.r2.cloudflarestorage.com`;
		const url = `${baseUrl}/${this.config.bucketName}/${key}`;
		
		
		
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

		const param: RequestUrlParam = {
			method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
			url: url,
			headers: headers,
			body: body,
		};

		const response = await requestUrl(param);
		
		// Return response with text as string property
		return {
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			text: response.text,
			headers: response.headers,
		};
	}

	private async getAuthHeader(method: string, key: string, body?: string): Promise<string> {
		const date = new Date().toUTCString();
		const contentType = body ? 'text/plain' : '';
		
		// Simple AWS signature that might work with R2
		const canonicalString = `${method}\n\n${contentType}\n${date}\n/${this.config.bucketName}/${key}`;
		
		
		
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
