{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "ai-image-detector";

  buildInputs = with pkgs; [
    # Python
    python310
    python310Packages.pip
    python310Packages.virtualenv

    # Node.js
    nodejs_20

    # System libs for Python packages / PyTorch / OpenCV
    stdenv.cc.cc.lib
    zlib
    libffi
    openssl

    # Docker tools
    docker
    docker-compose

    # Utilities
    git
    curl
    sqlite
    jq
  ];

  shellHook = ''
    export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:${pkgs.zlib}/lib:$LD_LIBRARY_PATH"

    echo ""
    echo "✅ AI Image Detector dev environment ready!"
    echo ""

    # Python venv
    if [ ! -d "backend/.venv" ]; then
      echo "🔧 Creating Python virtual environment..."
      python -m venv backend/.venv
    fi

    source backend/.venv/bin/activate

    echo "Python: $(python --version)"
    echo "Node:   $(node --version)"
    echo "npm:    $(npm --version)"
    echo ""
    echo "Run backend:"
    echo "  cd backend"
    echo "  pip install -r requirements.txt"
    echo "  uvicorn app.main:app --reload"
    echo ""
    echo "Run frontend:"
    echo "  cd frontend"
    echo "  npm install"
    echo "  npm run dev"
    echo ""
  '';
}