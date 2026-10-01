#!/bin/sh
set -eu

cd /app
node scripts/db.mjs migrate
exec node server.js
