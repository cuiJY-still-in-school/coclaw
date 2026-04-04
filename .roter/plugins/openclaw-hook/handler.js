import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCK_FILE = join(os.tmpdir(), 'roter-hook.lock');

// Simple logging function that should appear in OpenClaw logs
function log(message) {
    // Try to use console.error for better visibility in logs
    console.error(`[roter-hook] ${message}`);
}

/**
 * Check if roter is already running
 */
async function isRoterRunning() {
    try {
        const lockContent = await fs.readFile(LOCK_FILE, 'utf8');
        const { pid, started } = JSON.parse(lockContent);
        // Check if process exists
        try {
            process.kill(pid, 0);
            log(`Roter already running (PID: ${pid})`);
            return true;
        } catch {
            // Process dead
            log(`Lock file exists but process ${pid} is dead`);
            return false;
        }
    } catch (error) {
        log(`No lock file or error reading: ${error.message}`);
        return false;
    }
}

/**
 * Write lock file
 */
async function writeLock(pid) {
    const lockContent = JSON.stringify({
        pid,
        started: new Date().toISOString()
    });
    await fs.writeFile(LOCK_FILE, lockContent);
    log(`Lock file written for PID: ${pid}`);
}

/**
 * Hook handler for roter mod loading
 * @param {import('openclaw').GatewayStartupEvent} event
 */
export default async function roterHook(event) {
    try {
        log(`Hook called with event type: ${event.type}`);
        
        // Only run on gateway startup
        // Event has type: "gateway", action: "startup", sessionKey: "gateway:startup"
        if (event.action !== 'startup') {
            log(`Skipping - not a startup event (action: ${event.action})`);
            return;
        }

        log('Loading mods on gateway startup');

        // Check if already running
        if (await isRoterRunning()) {
            log('Roter already running, skipping');
            return;
        }

        // Path to roter extension (global install)
        // The roter extension is at ~/.roter/dist/extension.js
        const roterExtensionPath = join(process.env.HOME, '.roter', 'dist', 'extension.js');
        
        log(`Roter extension path: ${roterExtensionPath}`);

        // Check if file exists
        try {
            await fs.access(roterExtensionPath);
            log('Roter extension file exists');
        } catch (error) {
            log(`ERROR: Roter extension not found: ${error.message}`);
            return;
        }

        // Spawn roter extension as a child process
        // We'll run it with node and let it load mods in background
        log('Spawning roter extension process...');
        const child = spawn(process.execPath, [roterExtensionPath], {
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, NODE_ENV: 'production' }
        });

        // Write lock file
        await writeLock(child.pid);

        child.unref(); // Allow parent to exit independently

        log(`Started roter extension (PID: ${child.pid})`);
        
        // Clean up lock on exit
        child.on('exit', (code, signal) => {
            log(`Roter process exited with code: ${code}, signal: ${signal}`);
            fs.unlink(LOCK_FILE).catch(() => {
                log('Failed to remove lock file');
            });
        });
        
        child.on('error', (error) => {
            log(`Roter process error: ${error.message}`);
        });
        
    } catch (error) {
        log(`ERROR in roter hook: ${error.message}`);
        if (error.stack) {
            log(`Stack: ${error.stack}`);
        }
    }
}