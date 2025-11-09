import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

export class R2ServiceSDK {
	private s3Client: S3Client;
	private config: R2Config;

	constructor(config: R2Config) {
		this.config = config;
		
		// Create S3 client configured for R2
		this.s3Client = new S3Client({
			region: config.region || 'auto',
			endpoint: config.customEndpoint || `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			forcePathStyle: true, // R2 requires path-style URLs
		});

		
	}

	async testConnection(): Promise<{ success: boolean; details: string }> {
		try {
			

			// Test by listing objects
			const command = new ListObjectsV2Command({
				Bucket: this.config.bucketName,
				MaxKeys: 1
			});

			const response = await this.s3Client.send(command);
			
			

			const fileCount = response.Contents?.length || 0;
			return {
				success: true,
				details: `✅ Successfully connected to R2! Found ${fileCount} files.`
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
			

			const command = new PutObjectCommand({
				Bucket: this.config.bucketName,
				Key: key,
				Body: content,
				ContentType: 'text/plain'
			});

			await this.s3Client.send(command);
			return true;
		} catch (error) {
			console.error('R2 upload failed:', error);
			
			new Notice(`Failed to upload ${key}: ${error.message}`);
			return false;
		}
	}

	async downloadFile(key: string): Promise<string | null> {
		try {
			

			const command = new GetObjectCommand({
				Bucket: this.config.bucketName,
				Key: key
			});

			const response = await this.s3Client.send(command);
			
			

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
			
			return null;
		}
	}

	async listFiles(prefix: string = ''): Promise<string[]> {
		try {
			

			const command = new ListObjectsV2Command({
				Bucket: this.config.bucketName,
				Prefix: prefix
			});

			const response = await this.s3Client.send(command);
			
			

			const files = response.Contents?.map(obj => obj.Key || '') || [];
			
			

			return files;
		} catch (error) {
			console.error('R2 list files failed:', error);
			
			return [];
		}
	}

	async deleteFile(key: string): Promise<boolean> {
		try {
			

			const command = new DeleteObjectCommand({
				Bucket: this.config.bucketName,
				Key: key
			});

			await this.s3Client.send(command);
			return true;
		} catch (error) {
			console.error('R2 delete failed:', error);
			
			return false;
		}
	}
}
