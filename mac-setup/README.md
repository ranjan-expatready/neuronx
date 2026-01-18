# Mac Setup for Ollama Gateway Auto-Start

## Install Launchd Service

1. **Edit the plist file** to update the paths:

   ```bash
   # Replace /path/to/your/gateway with the actual path to your gateway directory
   sed -i '' 's|/path/to/your/gateway|/Users/YOUR_USERNAME/Desktop/NeuronX|g' com.ollama.gateway.plist
   ```

2. **Copy to LaunchAgents**:

   ```bash
   cp com.ollama.gateway.plist ~/Library/LaunchAgents/
   ```

3. **Load the service**:

   ```bash
   launchctl load ~/Library/LaunchAgents/com.ollama.gateway.plist
   ```

4. **Check status**:
   ```bash
   launchctl list | grep ollama
   ```

## Manual Control

- **Start service**: `launchctl start com.ollama.gateway`
- **Stop service**: `launchctl stop com.ollama.gateway`
- **Unload service**: `launchctl unload ~/Library/LaunchAgents/com.ollama.gateway.plist`
- **View logs**: `tail -f /tmp/ollama-gateway.out` and `tail -f /tmp/ollama-gateway.err`

## Troubleshooting

- If the service fails to start, check the logs in `/tmp/ollama-gateway.*`
- Ensure Ollama is running before starting the gateway
- Make sure the `.env` file exists with the correct `PROXY_API_KEY`

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.ollama.gateway.plist
rm ~/Library/LaunchAgents/com.ollama.gateway.plist
```
