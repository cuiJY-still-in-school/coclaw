---
name: roter
description: "Load all roter mods on gateway startup"
homepage: https://github.com/cuiJY-still-in-school/CSIS-roter
metadata:
  {
    "openclaw":
      {
        "emoji": "🦞",
        "events": ["gateway:startup"],
        "install": [{ "id": "roter", "kind": "extension", "label": "CSIS roter mod manager" }],
      },
  }
---

# Roter Mod Loader Hook

Loads all enabled roter mods when the OpenClaw gateway starts.

## What It Does

When the OpenClaw gateway starts:

1. **Initializes roter** - Ensures roter config is loaded
2. **Loads all mods** - Loads all enabled mods from `~/.openclaw/mods/`
3. **Starts mod processes** - Each mod's `onLoad` function is called, starting any background services (like dashboard server)

## Requirements

- roter must be installed globally (`npm install -g @csis/roter` or from source)
- roter must be initialized (`roter init`)
- Mods must be installed and enabled (`roter install`, `roter enable`)

## Configuration

No configuration needed. The hook automatically uses your existing roter configuration at `~/.openclaw/roter.json`.

## Disabling

To disable this hook:

```bash
openclaw hooks disable roter
```

Or via config:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "roter": { "enabled": false }
      }
    }
  }
}
```