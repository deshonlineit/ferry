#!/usr/bin/env bash
set -e
if [ ! -f index.html ]; then
  echo "Run this from the Ferry project root (where index.html exists)."
  exit 1
fi
if ! grep -q 'home-reference.css' index.html; then
  sed -i 's#<link rel="stylesheet" href="assets/css/main.css?v=5">#<link rel="stylesheet" href="assets/css/main.css?v=5">\n  <link rel="stylesheet" href="assets/css/home-reference.css?v=1">#' index.html
fi
if ! grep -q 'home-reference.js' index.html; then
  sed -i 's#<script src="assets/js/app.js?v=5"></script>#<script src="assets/js/app.js?v=5"></script>\n  <script src="assets/js/home-reference.js?v=1"></script>#' index.html
fi

echo "Homepage reference design applied."
