#!/usr/bin/env bash
# ==============================================================================
# SLR Magic - Automated Cross-Platform Dependency Installer (Linux & macOS)
# ==============================================================================
set -e

# ANSI Color Codes
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# Determine script root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo -e "${CYAN}${BOLD}"
echo "===================================================================="
echo "         SLR Magic - Environment & Dependency Setup Wizard         "
echo "===================================================================="
echo -e "${NC}"

PREREQ_FAILED=0

# ------------------------------------------------------------------------------
# 1. System Prerequisite Diagnostics
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[1/5] Checking System Prerequisites...${NC}"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo -e "  ${GREEN}✔${NC} Node.js detected: ${BOLD}${NODE_VER}${NC}"
else
    echo -e "  ${RED}✖ Node.js is NOT installed or not found in PATH.${NC}"
    echo -e "    ${YELLOW}Manual action required:${NC} Install Node.js LTS (v18+ recommended):"
    echo -e "    → Official Website: https://nodejs.org/"
    echo -e "    → Via NVM: https://github.com/nvm-sh/nvm (e.g. 'nvm install --lts && nvm use --lts')"
    PREREQ_FAILED=1
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VER=$(npm -v)
    echo -e "  ${GREEN}✔${NC} npm detected:     ${BOLD}v${NPM_VER}${NC}"
else
    echo -e "  ${RED}✖ npm is NOT installed.${NC}"
    echo -e "    ${YELLOW}Manual action required:${NC} Install npm (bundled with Node.js)."
    PREREQ_FAILED=1
fi

# Check NVM (Informational)
if [ -n "$NVM_DIR" ] || command -v nvm >/dev/null 2>&1; then
    echo -e "  ${GREEN}✔${NC} NVM environment detected."
else
    echo -e "  ${YELLOW}ℹ NVM (Node Version Manager) is not detected (optional, but recommended for Node management).${NC}"
    echo -e "    → Guide: https://github.com/nvm-sh/nvm"
fi

# Check Python 3
PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    # Verify if 'python' is Python 3
    PY_MAJOR=$(python -c "import sys; print(sys.version_info[0])" 2>/dev/null || echo "2")
    if [ "$PY_MAJOR" = "3" ]; then
        PYTHON_BIN="python"
    fi
fi

if [ -n "$PYTHON_BIN" ]; then
    PY_VER=$($PYTHON_BIN --version 2>&1)
    echo -e "  ${GREEN}✔${NC} Python detected:  ${BOLD}${PY_VER}${NC} (${PYTHON_BIN})"
else
    echo -e "  ${RED}✖ Python 3 is NOT installed or not found in PATH.${NC}"
    echo -e "    ${YELLOW}Manual action required:${NC} Install Python 3.9+:"
    echo -e "    → Debian/Ubuntu:  sudo apt update && sudo apt install python3 python3-pip python3-venv"
    echo -e "    → Fedora/RHEL:    sudo dnf install python3 python3-pip"
    echo -e "    → macOS (Brew):   brew install python"
    PREREQ_FAILED=1
fi

# Check Python 'venv' standard module
if [ -n "$PYTHON_BIN" ]; then
    if $PYTHON_BIN -c "import venv" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✔${NC} Python 'venv' module is functional."
    else
        echo -e "  ${RED}✖ Python 'venv' module is MISSING or broken.${NC}"
        echo -e "    On Debian/Ubuntu systems, python3-venv is packaged separately."
        echo -e "    ${YELLOW}Manual action required:${NC} Run:"
        echo -e "    → sudo apt update && sudo apt install python3-venv"
        PREREQ_FAILED=1
    fi
fi

if [ "$PREREQ_FAILED" -ne 0 ]; then
    echo -e "\n${RED}${BOLD}===================================================================="
    echo " [ERROR] Missing prerequisites detected. Please install them above "
    echo "         and re-run this setup script."
    echo "====================================================================${NC}"
    exit 1
fi

echo -e "  ${GREEN}${BOLD}All prerequisite tools are satisfied!${NC}\n"

# ------------------------------------------------------------------------------
# 2. Root Monorepo Node Dependencies
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[2/5] Installing Root Workspace Dependencies...${NC}"
npm install
echo -e "  ${GREEN}✔ Root workspace ready.${NC}\n"

# ------------------------------------------------------------------------------
# 3. Active Submodules Node Dependencies (slr-ide, inter-rater, slr-viewer)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[3/5] Installing Submodule Node Dependencies...${NC}"

# slr-ide
if [ -d "slr-ide" ]; then
    echo -e "  → Installing dependencies for ${BOLD}slr-ide${NC}..."
    (cd slr-ide && npm install)
    echo -e "  ${GREEN}✔ slr-ide dependencies installed.${NC}"
fi

# inter-rater
if [ -d "inter-rater" ]; then
    echo -e "  → Installing dependencies for ${BOLD}inter-rater${NC}..."
    (cd inter-rater && npm install)
    echo -e "  ${GREEN}✔ inter-rater dependencies installed.${NC}"
fi

# slr-viewer
if [ -d "slr-viewer" ]; then
    echo -e "  → Installing dependencies for ${BOLD}slr-viewer${NC}..."
    (cd slr-viewer && npm install)
    echo -e "  ${GREEN}✔ slr-viewer dependencies installed.${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# 4. Python Virtual Environment & Engine Dependencies (slr-ide/python_engine)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[4/5] Setting Up Python Engine Virtual Environment...${NC}"
VENV_DIR="$ROOT_DIR/slr-ide/python_engine/venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"
REQUIREMENTS_FILE="$ROOT_DIR/slr-ide/python_engine/requirements.txt"

if [ -f "$VENV_PYTHON" ]; then
    echo -e "  ${GREEN}ℹ Existing virtual environment detected at:${NC}"
    echo -e "    ${BOLD}${VENV_DIR}${NC}"
    echo -e "  → Updating pip and installing/verifying requirements..."
else
    echo -e "  → Creating new virtual environment at ${BOLD}${VENV_DIR}${NC}..."
    mkdir -p "$(dirname "$VENV_DIR")"
    $PYTHON_BIN -m venv "$VENV_DIR"
    echo -e "  ${GREEN}✔ Virtual environment created successfully.${NC}"
fi

# Upgrade pip inside venv
echo -e "  → Upgrading pip inside virtual environment..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet

# Install requirements
if [ -f "$REQUIREMENTS_FILE" ]; then
    echo -e "  → Installing python packages from requirements.txt..."
    "$VENV_PIP" install -r "$REQUIREMENTS_FILE"
    echo -e "  ${GREEN}✔ Python engine dependencies installed successfully.${NC}"
else
    echo -e "  ${YELLOW}⚠ requirements.txt not found at ${REQUIREMENTS_FILE}.${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# 5. Post-Installation Workspace Sync
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[5/5] Performing Post-Installation Workspace Synchronization...${NC}"
if [ -f "scripts/mirror-to-viewer.mjs" ]; then
    echo -e "  → Mirroring shared components to slr-viewer..."
    node scripts/mirror-to-viewer.mjs
    echo -e "  ${GREEN}✔ Viewer synchronization complete.${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# Completion Summary
# ------------------------------------------------------------------------------
echo -e "${GREEN}${BOLD}===================================================================="
echo "           🎉 SLR Magic Workspace Setup Completed!                 "
echo "====================================================================${NC}"
echo -e "\nYou can now launch any of the SLR Magic submodules:\n"
echo -e "  ${BOLD}1. SLR IDE (Main Desktop Hub):${NC}"
echo -e "     ${CYAN}npm run dev:ide${NC}   (or: cd slr-ide && npm run dev)"
echo -e "     → http://localhost:3000\n"
echo -e "  ${BOLD}2. Inter-Rater Review SPA:${NC}"
echo -e "     ${CYAN}cd inter-rater && npm run dev${NC}"
echo -e "     → http://localhost:3001\n"
echo -e "  ${BOLD}3. SLR Viewer (Standalone Visualization):${NC}"
echo -e "     ${CYAN}npm run dev:viewer${NC} (or: cd slr-viewer && npm run dev)"
echo -e "     → http://localhost:3002\n"
echo -e "${BOLD}Enjoy researching with SLR Magic!${NC}"
