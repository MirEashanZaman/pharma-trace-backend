@echo off
cd /d "%~dp0"
title PharmaTrace Backend
echo ===================================================
echo Starting PharmaTrace Backend Server
echo ===================================================
npm run start:dev
