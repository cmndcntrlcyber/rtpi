#!/bin/bash
set -e

echo "🚀 Starting RTPI development environment..."

# Start Docker services
docker-compose up -d postgres redis

# Wait for services
sleep 5

# Start development server
npm run dev
