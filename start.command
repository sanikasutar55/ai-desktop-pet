#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js from https://nodejs.org first."; read -p "Press Enter"; exit; }
[ -d node_modules ] || npm install
npm start
