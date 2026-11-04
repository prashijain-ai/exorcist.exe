#!/bin/bash
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env
npm install && npm run dev -- --open
