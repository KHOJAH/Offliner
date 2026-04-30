#!/bin/bash

# Offliner - Linux Setup Script
# This script installs dependencies, downloads necessary binaries, and builds the app.

set -e

echo "Starting Offliner setup for Linux..."

# 1. Check if we are in the project directory
if [ ! -f "package.json" ] || ! grep -q '"name": "offliner"' package.json; then
    if [ -d "offliner" ]; then
        echo "Existing Offliner directory found. Removing it for a fresh update..."
        rm -rf offliner
    fi
    
    echo "Cloning latest version of Offliner..."
    if ! command -v git &> /dev/null; then
        echo "Error: git is not installed. Please install git first."
        exit 1
    fi
    git clone https://github.com/KHOJAH/offliner.git
    cd offliner
else
    echo "Running inside project directory. Pulling latest changes..."
    git pull
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS=$(uname -s)
fi

echo "Detected OS: $OS"

# 2. Install System Dependencies
case "$OS" in
    ubuntu|debian|pop|mint)
        echo "Installing dependencies for Debian-based system..."
        sudo apt update
        sudo apt install -y curl ffmpeg nodejs npm unzip git
        ;;
    arch|manjaro)
        echo "Installing dependencies for Arch-based system..."
        sudo pacman -Syu --noconfirm curl ffmpeg nodejs npm unzip git libxcrypt-compat
        ;;
    *)
        echo "Unrecognized OS. Please ensure 'curl', 'ffmpeg', 'node', 'npm', 'unzip', and 'git' are installed manually."
        ;;
esac

# Check Node Version
NODE_VER=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VER" -lt 18 ]; then
    echo "Error: Node.js version 18 or higher is required. Found: $NODE_VER"
    exit 1
fi

# 3. Install Project Dependencies
echo "npm installing..."
npm install

# 4. Prepare Build Directories
mkdir -p build/yt-dlp/linux
mkdir -p build/ffmpeg/linux

# Download yt-dlp for Linux
if [ ! -f build/yt-dlp/linux/yt-dlp ]; then
    echo "Downloading yt-dlp for Linux..."
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o build/yt-dlp/linux/yt-dlp
    chmod +x build/yt-dlp/linux/yt-dlp
fi

# Download ffmpeg for Linux (Static build)
if [ ! -f build/ffmpeg/linux/ffmpeg ]; then
    echo "Downloading ffmpeg static binary for Linux..."
    curl -L https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip -o ffmpeg.zip
    unzip -o ffmpeg.zip ffmpeg -d build/ffmpeg/linux/
    rm ffmpeg.zip
    chmod +x build/ffmpeg/linux/ffmpeg
fi

# 5. Build the App
echo "Building Offliner..."
npm run build

# 6. Desktop Integration (Make it searchable)
echo "Integrating with system menu..."
mkdir -p ~/.local/bin ~/.local/share/applications

APPIMAGE_PATH=$(ls release/*.AppImage | head -n 1)
ICON_PATH=$(pwd)/build/icon.png

if [ -f "$APPIMAGE_PATH" ]; then
    # Overwrite old binary
    cp -f "$APPIMAGE_PATH" ~/.local/bin/offliner
    chmod +x ~/.local/bin/offliner

    cat <<EOF > ~/.local/share/applications/offliner.desktop
[Desktop Entry]
Name=Offliner
Exec=$HOME/.local/bin/offliner
Icon=$ICON_PATH
Type=Application
Categories=Utility;
Terminal=false
EOF
    echo "Desktop shortcut updated at ~/.local/share/applications/offliner.desktop"
fi

echo "Setup complete!"
echo "Offliner has been updated and integrated into your system menu."

# Optional: Ask to install if on Debian
if [[ "$OS" == "ubuntu" || "$OS" == "debian" || "$OS" == "pop" || "$OS" == "mint" ]]; then
    DEB_FILE=$(ls release/*.deb | head -n 1)
    if [ -f "$DEB_FILE" ]; then
        read -p "Do you want to install the .deb package now? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo dpkg -i "$DEB_FILE" || sudo apt install -f -y
        fi
    fi
fi

echo "Done! You can now launch Offliner."
