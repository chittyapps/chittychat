#!/bin/bash
# Chitty | Can™ Full Deploy Script

echo "📁 Creating Git project..."
git init
git branch -M main
git add .
git commit -m 'Initial commit: Chitty | Can™ landing + tile'
git remote add origin https://github.com/NeverShitty/chitty-can.git

echo "🚀 Pushing to GitHub..."
git push -u origin main

echo "🌐 Done. Visit your Pages URL after enabling Pages: https://nevershitty.github.io/chitty-can"
