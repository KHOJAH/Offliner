#!/bin/bash
set -e

echo "Setting up Offliner..."

# 1. Workspace prep
if [ ! -f "package.json" ]; then
    [ -d "offliner" ] && rm -rf offliner
    git clone --depth 1 https://github.com/KHOJAH/offliner.git
    cd offliner
else
    git pull --quiet
fi

# 2. System dependencies
. /etc/os-release
case "$ID" in
    ubuntu|debian|pop|mint) sudo apt update -y && sudo apt install -y curl ffmpeg nodejs npm unzip git ;;
    arch|manjaro) sudo pacman -Syu --noconfirm curl ffmpeg nodejs npm unzip git libxcrypt-compat ;;
esac

# 3. Build prep
npm install --no-audit --no-fund --quiet
mkdir -p build/yt-dlp/linux build/ffmpeg/linux

# 4. Binaries
[ -f build/yt-dlp/linux/yt-dlp ] || {
    curl -Ls https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o build/yt-dlp/linux/yt-dlp
    chmod +x build/yt-dlp/linux/yt-dlp
}
[ -f build/ffmpeg/linux/ffmpeg ] || {
    curl -Ls https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip -o ffmpeg.zip
    unzip -oq ffmpeg.zip ffmpeg -d build/ffmpeg/linux/ && rm ffmpeg.zip
    chmod +x build/ffmpeg/linux/ffmpeg
}

# 5. Build & Integrate
echo "Building and installing..."
npm run build --silent

mkdir -p ~/.local/bin ~/.local/share/applications
cp -f release/*.AppImage ~/.local/bin/offliner
chmod +x ~/.local/bin/offliner

cat <<EOF > ~/.local/share/applications/offliner.desktop
[Desktop Entry]
Name=Offliner
Exec=$HOME/.local/bin/offliner
Icon=$(pwd)/build/icon.png
Type=Application
Categories=Utility;
EOF

echo "Done. Offliner is ready in your application menu."
