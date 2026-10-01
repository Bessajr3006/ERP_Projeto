#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ASKPASS="$DIR/askpass.sh"
chmod +x "$ASKPASS"

rm -f /tmp/ssh_deploy_bessa

export DISPLAY=d:0
export SSH_ASKPASS_REQUIRE=force
export SSH_ASKPASS="$ASKPASS"

./deploy.sh root@187.77.24.126
