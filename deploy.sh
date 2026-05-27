#!/bin/bash
set -e

echo "=== StockEz Deployment ==="

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker installed. Re-run this script after logging out and back in."
    exit 0
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env <<EOF
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 48)
BASE_URL=http://$(curl -s ifconfig.me)
EOF
    echo ".env created with random secrets."
fi

echo "Building and starting services..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo ""
echo "=== Deployment Complete ==="
echo "App URL: http://$(curl -s ifconfig.me)"
echo ""
echo "Logs: docker compose logs -f"
echo "Stop:  docker compose down"
