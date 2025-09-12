# Hetzner Cloud Setup Guide

This guide covers the setup of Hetzner Cloud infrastructure for the Invoice Management Tool.

## Prerequisites

- Hetzner Cloud account
- Hetzner API token (stored in `.env` file)
- Windows machine with PowerShell
- Git installed

## 1. Install Hetzner CLI

### Download and Install
1. Go to: https://github.com/hetznercloud/cli/releases
2. Download `hcloud-windows-amd64.zip`
3. Extract `hcloud.exe` to `C:\Windows\System32` (requires admin rights)

### Verify Installation
```powershell
hcloud version
```

## 2. Authentication Setup

### Create Config Directory
```powershell
New-Item -ItemType Directory -Path "$env:APPDATA\hcloud" -Force
```

### Create Context
```powershell
# Set environment variable first
$env:HCLOUD_TOKEN = "your_hetzner_token_here"

# Create context
hcloud context create invoice-tool

# Use context
hcloud context use invoice-tool
```

### Verify Connection
```powershell
hcloud location list
hcloud server list
```

## 3. SSH Key Setup

### Generate SSH Key
```powershell
ssh-keygen -t ed25519 -C "invoice-management-tool"
```
- Press Enter for default location
- Press Enter for empty passphrase (or set one)

### Add SSH Key to Hetzner
```powershell
hcloud ssh-key create --name "invoice-tool-key" --public-key-from-file "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

## 4. Server Creation

### Create Server (cx11 is taken as an example)
```powershell
hcloud server create `
  --type cx11 `
  --image ubuntu-22.04 `
  --location nbg1 `
  --name invoice-management-server `
  --ssh-key invoice-tool-key
```

### Server Specifications
- **Type**: cx11 (1 vCPU, 4GB RAM)
- **Image**: Ubuntu 22.04 LTS
- **Location**: nbg1 (Nuremberg, Germany)
- **Monthly Cost**: ~€4.51

### Verify Server Creation
```powershell
hcloud server list
hcloud server describe invoice-management-server
```

## 5. Firewall Configuration

### Create Firewall
```powershell
hcloud firewall create --name invoice-tool-firewall
```

### Add Rules
```powershell
# SSH access
hcloud firewall add-rule invoice-tool-firewall --direction in --port 22 --protocol tcp --source-ips 0.0.0.0/0 --source-ips ::/0

# HTTP
hcloud firewall add-rule invoice-tool-firewall --direction in --port 80 --protocol tcp --source-ips 0.0.0.0/0 --source-ips ::/0

# HTTPS
hcloud firewall add-rule invoice-tool-firewall --direction in --port 443 --protocol tcp --source-ips 0.0.0.0/0 --source-ips ::/0

# Backend API
hcloud firewall add-rule invoice-tool-firewall --direction in --port 3001 --protocol tcp --source-ips 0.0.0.0/0 --source-ips ::/0

# Frontend (if needed)
hcloud firewall add-rule invoice-tool-firewall --direction in --port 3000 --protocol tcp --source-ips 0.0.0.0/0 --source-ips ::/0
```

### Apply Firewall to Server
```powershell
hcloud firewall apply-to-resource invoice-tool-firewall --type server --server invoice-management-server
```

## 6. Server Access

### Get Server IP
```powershell
hcloud server describe invoice-management-server --output json | Select-String "public_net"
```

### Connect via SSH
```powershell
ssh root@YOUR_SERVER_IP
```

## 7. Environment Variables

Ensure your `.env` file contains:
```env
HETZNER_TOKEN=your_hetzner_api_token_here
```

## 8. Useful Commands

### Server Management
```powershell
# List all servers
hcloud server list

# Stop server
hcloud server stop invoice-management-server

# Start server
hcloud server start invoice-management-server

# Delete server (CAUTION!)
hcloud server delete invoice-management-server

# Server details
hcloud server describe invoice-management-server
```

### SSH Key Management
```powershell
# List SSH keys
hcloud ssh-key list

# Delete SSH key
hcloud ssh-key delete invoice-tool-key
```

### Firewall Management
```powershell
# List firewalls
hcloud firewall list

# List firewall rules
hcloud firewall describe invoice-tool-firewall
```

## 9. Cost Estimation

- **cx11 Server**: €4.51/month
- **Traffic**: First 21TB free
- **Backup (optional)**: 20% of server cost
- **Total estimated**: ~€5-6/month

## 10. Security Notes

- Keep your API token secure
- Use SSH keys instead of passwords
- Regularly update your server
- Consider enabling automatic backups
- Monitor firewall rules

## Troubleshooting

### Common Issues

1. **Command not found**: Ensure hcloud.exe is in PATH
2. **Authentication failed**: Check HETZNER_TOKEN in environment
3. **SSH connection refused**: Verify firewall rules and server status
4. **Permission denied**: Ensure SSH key is properly configured

### Getting Help
```powershell
hcloud --help
hcloud [command] --help
```

## Next Steps

After server creation:
1. Install Docker on the server
2. Set up CI/CD pipeline
3. Deploy the application
4. Configure domain and SSL
5. Set up monitoring

---

**Note**: Replace `YOUR_SERVER_IP` and `your_hetzner_token_here` with actual values from your setup.# Hetzner Cloud Configuration
# Save this file as .hetzner-token and keep it secure

# API Token (Keep this secret!)
HCLOUD_TOKEN=your_hetzner_api_token_here

# Project Configuration
HETZNER_PROJECT=invoice-management-tool
HETZNER_REGION=fsn1
HETZNER_SERVER_TYPE=cpx21

# SSH Configuration
SSH_KEY_NAME=invoice-mgmt-key
SSH_PUBLIC_KEY_PATH=~/.ssh/id_rsa.pub
SSH_PRIVATE_KEY_PATH=~/.ssh/id_rsa
