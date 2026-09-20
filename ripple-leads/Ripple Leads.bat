@echo off
REM ---------------------------------------------------------------------
REM  Ripple Leads - double-click this file to open the app.
REM
REM  If you installed into a conda environment with a different name,
REM  change "ripple" on the CALL line below to match.
REM ---------------------------------------------------------------------

cd /d "%~dp0"

REM Activate the conda environment. CALL is required - without it, this
REM script exits as soon as conda finishes.
CALL conda activate ripple 2>nul

REM pythonw runs without a console window. If it is missing, fall back to
REM python so you at least get the app plus a terminal.
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw desktop.py
) else (
    python desktop.py
)
