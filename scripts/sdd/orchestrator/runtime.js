'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const projectConfig = require('../../lib/projectConfig');

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const ORCHESTRATOR_LOG_PATH = path.join(projectConfig.APP_SDD_DOCS_DIR_ABS, 'orchestrator.log');
const DELETE_CHAR = '\u007f';
const DELETE_SEQUENCE = '\u001b[3~';
const HARD_ABORT_CHAR = '\u0003';

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null,
  };
}

function formatClockTime(date = new Date()) {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
}

function isPathWithin(parentPath, candidatePath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveOrchestratorLogPath({ repoRoot, planPath, logPath }) {
  if (logPath) return path.resolve(logPath);

  if (!planPath || isPathWithin(repoRoot, planPath)) {
    return ORCHESTRATOR_LOG_PATH;
  }

  return path.join(path.dirname(path.resolve(planPath)), 'orchestrator.log');
}

function appendOperatorLog(logPath, line) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`, 'utf8');
}

function formatElapsedDuration(elapsedMs) {
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createProgressReporter({ logPath, stream = process.stderr } = {}) {
  function emit(message, { persist = true } = {}) {
    const line = `[${formatClockTime()}] ${message}`;

    if (persist && logPath) {
      appendOperatorLog(logPath, line);
    }

    stream.write(`${line}\n`);
    return line;
  }

  function startHeartbeat(label, startedAtMs) {
    const isTty = Boolean(stream.isTTY);
    const timer = setInterval(() => {
      const elapsedMs = Date.now() - startedAtMs;
      if (elapsedMs < HEARTBEAT_INTERVAL_MS) return;
      const elapsedLabel = formatElapsedDuration(elapsedMs);

      if (isTty) {
        stream.write(`\r  ${elapsedLabel} elapsed... ${label}`);
        return;
      }

      emit(`${label} still running (${elapsedLabel} elapsed)`, { persist: false });
    }, HEARTBEAT_INTERVAL_MS);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    return {
      stop() {
        clearInterval(timer);
        if (isTty) {
          stream.write('\r\x1b[2K');
        }
      },
    };
  }

  return {
    emit,
    startHeartbeat,
  };
}

function createGracefulStopController({
  stream = process.stdin,
  onStopRequested = null,
  onHardAbort = null,
} = {}) {
  let stopRequested = false;
  let stopSource = null;
  let cleanedUp = false;
  let rawModeEnabled = false;
  let pendingInput = '';
  const requestListeners = new Set();
  const hasTtyInput = Boolean(stream && stream.isTTY && typeof stream.setRawMode === 'function');
  const canPauseInput = Boolean(stream && typeof stream.pause === 'function');

  function notifyRequestListeners(source) {
    for (const listener of requestListeners) {
      listener(source);
    }
  }

  function requestStop(source) {
    if (stopRequested) return false;
    stopRequested = true;
    stopSource = source;

    if (typeof onStopRequested === 'function') {
      onStopRequested(source);
    }

    notifyRequestListeners(source);
    return true;
  }

  function handleSignalStop() {
    requestStop('signal');
  }

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;

    process.off('SIGUSR1', handleSignalStop);

    if (hasTtyInput) {
      stream.off('data', handleInput);
      if (rawModeEnabled) {
        stream.setRawMode(false);
      }
    }

    if (canPauseInput) {
      stream.pause();
    }
  }

  function hardAbort(source) {
    cleanup();
    if (typeof onHardAbort === 'function') {
      onHardAbort(source);
      return;
    }

    process.kill(process.pid, 'SIGINT');
  }

  function trimPendingInput() {
    if (pendingInput.length <= DELETE_SEQUENCE.length) return;
    pendingInput = pendingInput.slice(-DELETE_SEQUENCE.length);
  }

  function handleInput(chunk) {
    pendingInput += chunk.toString('utf8');

    if (pendingInput.includes(HARD_ABORT_CHAR)) {
      hardAbort('keyboard');
      return;
    }

    if (pendingInput.includes(DELETE_CHAR) || pendingInput.includes(DELETE_SEQUENCE)) {
      requestStop('keyboard');
      pendingInput = '';
      return;
    }

    trimPendingInput();
  }

  process.on('SIGUSR1', handleSignalStop);

  if (hasTtyInput) {
    stream.setRawMode(true);
    rawModeEnabled = true;
    stream.resume();
    stream.on('data', handleInput);
  }

  return {
    cleanup,
    isRequested() {
      return stopRequested;
    },
    getSource() {
      return stopSource;
    },
    onRequest(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }

      if (stopRequested) {
        listener(stopSource);
        return () => {};
      }

      requestListeners.add(listener);
      return () => {
        requestListeners.delete(listener);
      };
    },
    requestStop,
  };
}

function runTrackedCommand({ label, command, args, cwd, progress, env = process.env }) {
  const startedAtMs = Date.now();
  progress.emit(`-> ${label}`);
  const heartbeat = progress.startHeartbeat(label, startedAtMs);

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let childError = null;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      childError = error;
    });
    child.on('close', (code) => {
      heartbeat.stop();
      progress.emit(`<- ${label} (${Math.floor((Date.now() - startedAtMs) / 1000)}s)`);
      resolve({
        status: code === null ? 1 : code,
        stdout,
        stderr,
        error: childError,
      });
    });
  });
}

function timestampNow() {
  return new Date().toISOString();
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function ensureDirectoryExists(directoryPath, label) {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`${label} not found: ${directoryPath}`);
  }
}

function ensureCommandSucceeded(result, label) {
  if (result.status !== 0 || result.error) {
    throw new Error(`${
      label
    } failed (exit ${result.status}${
      result.error ? `, ${result.error.message}` : ''
    }):\n${result.stderr || result.stdout || '(no output)'}`);
  }
}

module.exports = {
  appendOperatorLog,
  createGracefulStopController,
  createProgressReporter,
  ensureCommandSucceeded,
  ensureDirectoryExists,
  ensureFileExists,
  formatClockTime,
  formatElapsedDuration,
  resolveOrchestratorLogPath,
  runCommand,
  runTrackedCommand,
  timestampNow,
};
