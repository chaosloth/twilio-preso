#!/bin/bash
set -e

echo "Building audience app..."
pnpm --filter @twilio-preso/audience build

echo "Building backend..."
pnpm --filter @twilio-preso/backend build

echo "Done! Deploy backend and serve audience dist/ as static files."
echo "Presenter runs locally on stage machine."
