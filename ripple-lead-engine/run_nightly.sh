#!/usr/bin/env bash
# Nightly run. Add to crontab with:
#   0 2 * * *  /path/to/ripple-lead-engine/run_nightly.sh >> /var/log/ripple.log 2>&1
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

python3 -m ripple.cli \
  --mode all \
  --towns Worcester Droitwich Malvern Kidderminster Evesham \
  --radius 30 \
  --output-dir "data/out/$(date +%F)" \
  --max-places 150 \
  --max-websites 250 \
  "$@"
