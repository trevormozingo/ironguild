#!/usr/bin/env bash
set -euo pipefail

# Start all services except test-client
docker compose -f backend/api-gateway/docker-compose.yaml up --build \
  mongodb \
  mongo-express \
  firebase-emulator \
  profile-service \
  api-gateway
