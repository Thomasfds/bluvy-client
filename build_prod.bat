@echo off
echo Lancement du build production...
echo.

call npm run build:prod
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Le build a echoue. Regardez les erreurs ci-dessus.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo [SUCCES] Fin de build et ouverture d'Android Studio.
echo.
pause