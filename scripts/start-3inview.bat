@echo off
rem Double-click this to run 3inview in a console window. Close the window (or press Ctrl+C) to stop it.
title 3inview
set "HERE=%~dp0"
"%HERE%3inview-windows-x64.exe" %*
echo.
echo 3inview stopped. Press any key to close this window.
pause >nul
