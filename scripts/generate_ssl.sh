#!/bin/bash
# ============================================================
# Generate self-signed SSL certificates for development
# These should be replaced with real certificates (e.g., Let's Encrypt) in production
# ============================================================

CERT_DIR="$(dirname "$0")/../nginx/ssl"

mkdir -p "$CERT_DIR"

echo "🔐 Generating self-signed SSL certificate for development..."

openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/key.pem" \
    -out "$CERT_DIR/cert.pem" \
    -subj "/C=VN/ST=HCM/L=HoChiMinh/O=AIDetector/OU=Dev/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo ""
echo "✅ SSL certificates generated:"
echo "   Certificate: $CERT_DIR/cert.pem"
echo "   Private Key: $CERT_DIR/key.pem"
echo ""
echo "⚠️  These are self-signed certificates for development only."
echo "   Use Let's Encrypt or a real CA certificate for production."
