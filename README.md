# R2 Sync Plugin for Obsidian

A powerful Obsidian plugin that syncs your notes to Cloudflare R2 with bidirectional backup and automatic sync capabilities.

## Features

- 🔄 **Automatic Sync**: Sync files automatically when you save them
- 🔄 **Bidirectional Sync**: Download changes from R2 and merge with local files
- ⚙️ **Manual Controls**: Manual sync and connectivity testing
- 📊 **Status Bar**: Real-time sync status and last sync time
- 🔐 **Secure**: Uses your own R2 credentials
- 📁 **Folder Support**: Sync specific folders or entire vault
- 🔔 **Notifications**: Toast notifications for sync events

## Installation

### Development Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Copy the generated files to your Obsidian vault:
   ```
   <Vault>/.obsidian/plugins/r2sync/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

5. Enable the plugin in Obsidian: **Settings → Community plugins → R2 Sync**

## Configuration

### R2 Setup

1. **Create R2 Bucket**: 
   - Go to Cloudflare Dashboard → R2 Object Storage
   - Create a new bucket
   - Note your Account ID

2. **Create API Token**:
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create a custom token with R2 permissions
   - Note your Access Key ID and Secret Access Key

3. **Configure Plugin**:
   - Open Obsidian Settings → Community plugins → R2 Sync
   - Enter your R2 credentials:
     - Account ID
     - Access Key ID  
     - Secret Access Key
     - Bucket Name
     - Region (usually "auto")

### Sync Settings

- **Base Folder**: Specify a folder to sync (leave empty for entire vault)
- **Auto Sync on Save**: Automatically sync when files are saved
- **Bidirectional Sync**: Download and merge remote changes

## Usage

### Commands

The plugin provides several commands accessible via the Command Palette (Ctrl/Cmd + P):

- **Sync to R2**: Manually sync all files to R2
- **Download from R2**: Download and merge remote changes
- **Test R2 Connection**: Test your R2 configuration
- **Sync Current File to R2**: Sync only the currently open file

### Status Bar

The status bar shows:
- 🔄 "R2 Sync in progress..." when syncing
- ✅ "R2 Last sync: X minutes ago" with last sync time
- 📁 "R2 Sync ready" when ready

### Settings Tab

Access all configuration options in:
**Settings → Community plugins → R2 Sync**

## Security & Privacy

- All data is stored in your own R2 bucket
- No data is sent to third parties
- Credentials are stored locally in Obsidian
- The plugin only accesses files within your vault

## Troubleshooting

### Connection Issues

1. **Test Connection**: Use the "Test R2 Connection" button in settings
2. **Check Credentials**: Verify your R2 credentials are correct
3. **Check Bucket**: Ensure the bucket exists and is accessible
4. **Check Permissions**: Ensure your API token has R2 read/write permissions

### Sync Issues

1. **Check Status Bar**: Look for error messages in the status bar
2. **Check Notifications**: Look for toast notifications with error details
3. **Manual Sync**: Try manual sync to see specific error messages
4. **Check Logs**: Open Developer Console (Ctrl/Cmd + Shift + I) for detailed logs

### Performance

- Large vaults may take time to sync initially
- The plugin syncs files incrementally after the first sync
- Consider using a specific folder instead of the entire vault for better performance

## Development

### Project Structure

```
src/
├── settings.ts      # Settings interface and defaults
├── r2Service.ts     # R2 API service
├── syncManager.ts   # Sync logic and file management
├── statusBar.ts     # Status bar component
├── commands.ts      # Command definitions
└── settingsTab.ts   # Settings UI
```

### Building

```bash
# Development (watch mode)
npm run dev

# Production build
npm run build
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and feature requests, please create an issue on the GitHub repository.