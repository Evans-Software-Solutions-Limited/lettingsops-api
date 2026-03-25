#!/bin/bash
# Workspace verification script
# Checks core files exist, are non-empty, and daily memory is present

set -euo pipefail

WORKSPACE="${WORKSPACE:-$HOME/.openclaw/workspace}"
TODAY=$(date +%Y-%m-%d)

ERRORS=0

echo "=== Workspace Verification ==="
echo "Workspace: $WORKSPACE"
echo "Date: $TODAY"
echo ""

# Check core files exist and are non-empty
for file in SOUL.md USER.md MEMORY.md; do
    filepath="$WORKSPACE/$file"
    if [[ ! -f "$filepath" ]]; then
        echo "❌ MISSING: $file"
        ERRORS=$((ERRORS + 1))
    elif [[ ! -s "$filepath" ]]; then
        echo "❌ EMPTY: $file"
        ERRORS=$((ERRORS + 1))
    else
        echo "✓ $file exists and non-empty"
    fi
done

# Check today's daily memory note
daily_note="$WORKSPACE/memory/$TODAY.md"
if [[ ! -f "$daily_note" ]]; then
    echo "❌ MISSING: daily note $TODAY.md"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ daily note $TODAY.md exists"
fi

# Check distillation-meta.json if present
distillation_meta="$WORKSPACE/memory/.distillation-meta.json"
if [[ -f "$distillation_meta" ]]; then
    if jq empty "$distillation_meta" 2>/dev/null; then
        echo "✓ .distillation-meta.json is valid JSON"
    else
        echo "❌ INVALID: .distillation-meta.json is not valid JSON"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "○ .distillation-meta.json not present (optional)"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo "=== FAILED: $ERRORS error(s) ==="
    exit 1
else
    echo "=== PASSED: All checks ok ==="
    exit 0
fi
