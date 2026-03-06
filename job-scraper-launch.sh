#!/bin/bash

# job-scraper - Mac/Linux bootstrap

MIN_NODE_VERSION=18

echo ""
echo "  job-scraper - setup"
echo "  -------------------------------------"
echo ""

# --- Step 1: Check for Node ---

if ! command -v node &> /dev/null; then
    echo "  Node.js not found. Attempting to install..."
    echo ""

    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "  Homebrew not found. Please install Node.js manually:"
            echo ""
            echo "      https://nodejs.org"
            echo ""
            echo "  Or install Homebrew first, then rerun this script:"
            echo ""
            echo "      /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo ""
            exit 1
        fi
    elif command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs
    else
        echo "  Could not install Node.js automatically."
        echo ""
        echo "  Please install it manually from:"
        echo ""
        echo "      https://nodejs.org"
        echo ""
        exit 1
    fi

    echo ""
    echo "  Node.js installed. Please reopen this terminal and run this script again."
    echo ""
    exit 0
fi

# --- Step 2: Check Node version ---

NODE_VERSION_RAW=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION_RAW" | sed 's/v//' | cut -d. -f1)

if [ "$NODE_MAJOR" -lt "$MIN_NODE_VERSION" ]; then
    echo "  WARNING: Node.js $NODE_VERSION_RAW detected, but version $MIN_NODE_VERSION or higher is required."
    echo ""
    echo "  Please update Node.js by running:"
    echo ""

    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "      brew upgrade node"
    elif command -v apt-get &> /dev/null; then
        echo "      curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
    else
        echo "      https://nodejs.org"
    fi

    echo ""
    echo "  Then reopen this terminal and run this script again."
    echo ""
    exit 1
fi

echo "  OK  Node.js $NODE_VERSION_RAW detected"

# --- Step 3: Install npm dependencies ---

if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    echo ""
    npm install playwright playwright-extra puppeteer-extra-plugin-stealth tsx typescript @types/node
    if [ $? -ne 0 ]; then
        echo ""
        echo "  FAILED: npm install failed. Please check the output above."
        exit 1
    fi
    echo ""
    echo "  OK  Dependencies installed"
else
    echo "  OK  Dependencies already installed"
fi

# --- Step 4: Install Playwright browser ---

PLAYWRIGHT_CACHE="$HOME/.cache/ms-playwright"
if [ ! -d "$PLAYWRIGHT_CACHE" ]; then
    echo "  Installing Playwright browser..."
    echo ""
    npx playwright install chromium
    if [ $? -ne 0 ]; then
        echo ""
        echo "  FAILED: Playwright browser installation failed. Please check the output above."
        exit 1
    fi
    echo ""
    echo "  OK  Playwright browser installed"
else
    echo "  OK  Playwright browser already installed"
fi

# --- Step 5: Launch ---

echo ""
echo "  -------------------------------------"
echo "  Launching job-scraper..."
echo "  -------------------------------------"
echo ""

npx tsx job-scraper.ts
