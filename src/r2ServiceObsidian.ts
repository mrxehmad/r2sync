import { Notice, requestUrl, type RequestUrlParam } from 'obsidian';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';

export interface R2Config {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucketName: string;
	region: string;
	customEndpoint?: string;
	debugMode?: boolean;
}

// Custom HTTP handler that uses Obsidian's requestUrl instead of fetch
class ObsidianHttpHandler extends FetchHttpHandler {
	async handle(request: any, options: any = {}): Promise<{ response: any }> {
		if (options.abortSignal?.aborted) {
			const abortError = new Error("Request aborted");
			abortError.name = "AbortError";
			return Promise.reject(abortError);
		}

		let path = request.path;
		if (request.query) {
			const queryString = new URLSearchParams(request.query).toString();
			if (queryString) {
				path += `?${queryString}`;
			}
		}

		const { port, method } = request;
		const url = `${request.protocol}//${request.hostname}${port ? `:${port}` : ""}${path}`;

		const body = method === "GET" || method === "HEAD" ? undefined : request.body;

		const transformedHeaders: Record<string, string> = {};
		for (const key of Object.keys(request.headers)) {
			const keyLower = key.toLowerCase();
			if (keyLower === "host" || keyLower === "content-length") {
				continue;
			}
			transformedHeaders[keyLower] = request.headers[key];
		}

		let contentType: string | undefined = undefined;
		if (transformedHeaders["content-type"] !== undefined) {
			contentType = transformedHeaders["content-type"];
		}

		let transformedBody: any = body;
		if (ArrayBuffer.isView(body)) {
			transformedBody = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
		}

		const param: RequestUrlParam = {
			body: transformedBody,
			headers: transformedHeaders,
			method: method,
			url: url,
			contentType: contentType,
		};

		try {
			const rsp = await requestUrl(param);
			const headers = rsp.headers;
			const headersLower: Record<string, string> = {};
			for (const key of Object.keys(headers)) {
				headersLower[key.toLowerCase()] = headers[key];
			}

			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array(rsp.arrayBuffer));
					controller.close();
				},
			});

			return {
				response: {
					headers: headersLower,
					statusCode: rsp.status,
					body: stream,
				},
			};
		} catch (error) {
			throw error;
		}
	}
}

export class R2ServiceObsidian {
	private s3Client: S3Client;
	private config: R2Config;

	constructor(config: R2Config) {
		this.config = config;
		
		// Create S3 client configured for R2 using Obsidian's requestUrl
		this.s3Client = new S3Client({
			region: config.region || 'eu',
			endpoint: config.customEndpoint || `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			forcePathStyle: true, // R2 requires path-style URLs
			requestHandler: new ObsidianHttpHandler(),
		});

		if (config.debugMode) {
			console.log('R2 Debug: S3 Client initialized with config:', {
				region: config.region,
				endpoint: config.customEndpoint || `https://${config.accountId}.r2.cloudflarestorage.com`,
				bucketName: config.bucketName
			});
		}
	}

	async testConnection(): Promise<{ success: boolean; details: string }> {
		try {
			if (this.config.debugMode) {
				console.log('R2 Debug: Testing connection with AWS SDK...');
			}

			// Test by listing objects
			const command = new ListObjectsV2Command({
				Bucket: this.config.bucketName,
				MaxKeys: 1
			});

			const response = await this.s3Client.send(command);
			
			if (this.config.debugMode) {
				console.log('R2 Debug: List objects response:', response);
			}

			const fileCount = response.Contents?.length || 0;
			return {
				success: true,
				details: `Successfully connected to R2! Found ${fileCount} files.`
			};
		} catch (error) {
			console.error('R2 connection test failed:', error);
			if (this.config.debugMode) {
				console.log('R2 Debug: Connection error details:', error);
			}
			return {
				success: false,
				details: `Connection failed: ${error.message}`
			};
		}
	}

	async uploadFile(key: string, content: string): Promise<boolean> {
		try {
			if (this.config.debugMode) {
				console.log(`R2 Debug: Uploading file ${key}, content length: ${content.length}`);
			}

			const command = new PutObjectCommand({
				Bucket: this.config.bucketName,
				Key: key,
				Body: content,
				ContentType: 'text/plain'
			});

			const response = await this.s3Client.send(command);
			
			if (this.config.debugMode) {
				console.log(`R2 Debug: Upload response:`, response);
			}

			return true;
		} catch (error) {
			console.error('R2 upload failed:', error);
			if (this.config.debugMode) {
				console.log(`R2 Debug: Upload error details:`, error);
			}
			new Notice(`Failed to upload ${key}: ${error.message}`);
			return false;
		}
	}

	async downloadFile(key: string): Promise<string | null> {
		try {
			if (this.config.debugMode) {
				console.log(`R2 Debug: Downloading file ${key}`);
			}

			const command = new GetObjectCommand({
				Bucket: this.config.bucketName,
				Key: key
			});

			const response = await this.s3Client.send(command);
			
			if (this.config.debugMode) {
				console.log(`R2 Debug: Download response:`, response);
			}

			// Convert stream to string
			const chunks: Uint8Array[] = [];
			const reader = response.Body?.transformToWebStream().getReader();
			
			if (!reader) {
				return null;
			}

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}

			const content = new TextDecoder().decode(
				new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []))
			);

			return content;
		} catch (error) {
			console.error('R2 download failed:', error);
			if (this.config.debugMode) {
				console.log(`R2 Debug: Download error details:`, error);
			}
			return null;
		}
	}

	async listFiles(prefix: string = ''): Promise<string[]> {
		try {
			if (this.config.debugMode) {
				console.log(`R2 Debug: Listing files with prefix: "${prefix}"`);
			}

			const command = new ListObjectsV2Command({
				Bucket: this.config.bucketName,
				Prefix: prefix
			});

			const response = await this.s3Client.send(command);
			
			if (this.config.debugMode) {
				console.log(`R2 Debug: List files response:`, response);
			}

			const files = response.Contents?.map(obj => obj.Key || '') || [];
			
			if (this.config.debugMode) {
				console.log(`R2 Debug: Found files:`, files);
			}

			return files;
		} catch (error) {
			console.error('R2 list files failed:', error);
			if (this.config.debugMode) {
				console.log(`R2 Debug: List files error details:`, error);
			}
			return [];
		}
	}

	async deleteFile(key: string): Promise<boolean> {
		try {
			if (this.config.debugMode) {
				console.log(`R2 Debug: Deleting file ${key}`);
			}

			const command = new DeleteObjectCommand({
				Bucket: this.config.bucketName,
				Key: key
			});

			const response = await this.s3Client.send(command);
			
			if (this.config.debugMode) {
				console.log(`R2 Debug: Delete response:`, response);
			}

			return true;
		} catch (error) {
			console.error('R2 delete failed:', error);
			if (this.config.debugMode) {
				console.log(`R2 Debug: Delete error details:`, error);
			}
			return false;
		}
	}

	// Backup functionality
	async createBackup(folderPath: string, timestamp: string): Promise<boolean> {
		try {
			if (this.config.debugMode) {
				console.log(`R2 Debug: Creating backup for folder ${folderPath} with timestamp ${timestamp}`);
			}

			const backupKey = `backups/${timestamp}/${folderPath}`;
			const command = new PutObjectCommand({
				Bucket: this.config.bucketName,
				Key: backupKey,
				Body: JSON.stringify({ timestamp, folderPath, type: 'backup_marker' }),
				ContentType: 'application/json'
			});

			await this.s3Client.send(command);
			return true;
		} catch (error) {
			console.error('R2 backup creation failed:', error);
			return false;
		}
	}

	async listBackups(): Promise<Array<{timestamp: string, folderPath: string}>> {
		try {
			const command = new ListObjectsV2Command({
				Bucket: this.config.bucketName,
				Prefix: 'backups/'
			});

			const response = await this.s3Client.send(command);
			const backups: Array<{timestamp: string, folderPath: string}> = [];

			if (response.Contents) {
				for (const obj of response.Contents) {
					if (obj.Key?.endsWith('backup_marker')) {
						try {
							const content = await this.downloadFile(obj.Key);
							if (content) {
								const data = JSON.parse(content);
								backups.push({
									timestamp: data.timestamp,
									folderPath: data.folderPath
								});
							}
						} catch (e) {
							// Skip invalid backup markers
						}
					}
				}
			}

			return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
		} catch (error) {
			console.error('R2 list backups failed:', error);
			return [];
		}
	}

	async deleteBackup(timestamp: string): Promise<boolean> {
		try {
			if (this.config.debugMode) {
				console.log(`R2 Debug: Deleting backup with timestamp ${timestamp}`);
			}

			// List all files in the backup folder
			const command = new ListObjectsV2Command({
				Bucket: this.config.bucketName,
				Prefix: `backups/${timestamp}/`
			});

			const response = await this.s3Client.send(command);
			
			if (response.Contents) {
				for (const obj of response.Contents) {
					await this.deleteFile(obj.Key!);
				}
			}

			return true;
		} catch (error) {
			console.error('R2 backup deletion failed:', error);
			return false;
		}
	}

	async cleanupOldBackups(retentionDays: number): Promise<number> {
		try {
			const backups = await this.listBackups();
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
			
			let deletedCount = 0;
			for (const backup of backups) {
				const backupDate = new Date(backup.timestamp);
				if (backupDate < cutoffDate) {
					await this.deleteBackup(backup.timestamp);
					deletedCount++;
				}
			}

			return deletedCount;
		} catch (error) {
			console.error('R2 backup cleanup failed:', error);
			return 0;
		}
	}
}
