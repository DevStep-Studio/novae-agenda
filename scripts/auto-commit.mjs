#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const isWatch = args.includes("--watch");
const shouldPush = args.includes("--push");
const customMessage = args.find((arg) => !arg.startsWith("--"));

function run(command, options = {}) {
  try {
    const res = execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options });
    return options.noTrim ? res : res.trim();
  } catch (err) {
    if (options.ignoreError) return "";
    throw err;
  }
}

function getChangedFiles() {
  const statusOutput = run("git status --porcelain", { ignoreError: true, noTrim: true });
  if (!statusOutput) return [];
  return statusOutput
    .split("\n")
    .map((line) => {
      const match = line.match(/^(.{2})\s+(.*)$/);
      if (!match) return null;
      const code = match[1].trim();
      let file = match[2].trim().replace(/^"|"$/g, "");
      if (file.includes(" -> ")) {
        file = file.split(" -> ")[1].trim().replace(/^"|"$/g, "");
      }
      return { code, file };
    })
    .filter(Boolean);
}

function generateCommitMessage(changedFiles) {
  if (customMessage) return customMessage;
  if (!changedFiles || changedFiles.length === 0) return "ajuste: atualizações gerais";

  const fileNames = changedFiles
    .map((item) => path.basename(item.file))
    .filter((name) => !name.startsWith(".DS_Store"));

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  if (fileNames.length === 1) {
    return `ajuste: ${fileNames[0]} (${timeStr})`;
  } else if (fileNames.length <= 3) {
    return `ajuste: ${fileNames.join(", ")} (${timeStr})`;
  } else {
    return `ajuste: ${fileNames.slice(0, 2).join(", ")} e outros ${fileNames.length - 2} arquivos (${timeStr})`;
  }
}

function commitChanges() {
  const changed = getChangedFiles();
  if (changed.length === 0) {
    return false;
  }

  const commitMsg = generateCommitMessage(changed);

  console.log(`\n📦 Detectadas ${changed.length} alteração(ões). Preparando commit...`);
  changed.forEach((f) => console.log(`   - [${f.code || "?"}] ${f.file}`));

  try {
    run("git add -A");
    // Garante que .DS_Store não seja incluído se tiver sido criado
    run("git reset -- .DS_Store src/.DS_Store 2>/dev/null || true", { ignoreError: true });
    
    // Verifica se sobrou algo staged
    const staged = run("git diff --cached --name-only", { ignoreError: true });
    if (!staged) {
      console.log("ℹ️  Nenhum arquivo relevante para commit.");
      return false;
    }

    run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    const commitHash = run("git rev-parse --short HEAD");
    console.log(`✅ Commit realizado com sucesso! [${commitHash}] "${commitMsg}"`);

    if (shouldPush) {
      console.log("🚀 Enviando para o repositório remoto (git push)...");
      run("git push");
      console.log("✨ Push concluído com sucesso!");
    }

    return true;
  } catch (err) {
    console.error("❌ Erro ao commitar alterações:", err.message);
    return false;
  }
}

if (!isWatch) {
  const committed = commitChanges();
  if (!committed) {
    console.log("ℹ️  Nenhuma alteração pendente para commitar.");
  }
  process.exit(0);
}

// Modo Watcher
console.log("👀 Modo Watch ativado: monitorando alterações nos arquivos...");
console.log("Pressione Ctrl+C para encerrar.\n");

let debounceTimer = null;
const DEBOUNCE_MS = 4000;

function scheduleCommit() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    commitChanges();
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

// Executa verificação inicial
commitChanges();

// Monitora alterações via fs.watch no diretório do projeto (excluindo .git e .next)
const projectRoot = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules", "dist", "build"]);

function watchDirectory(dir) {
  try {
    fs.watch(dir, { recursive: false }, (eventType, filename) => {
      if (!filename) return;
      if (filename.startsWith(".git") || filename.startsWith(".next") || filename.endsWith(".DS_Store")) {
        return;
      }
      scheduleCommit();
    });

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !ignoredDirs.has(entry.name) && !entry.name.startsWith(".")) {
        watchDirectory(path.join(dir, entry.name));
      }
    }
  } catch (err) {
    // Ignora erros de permissão ou diretórios excluídos
  }
}

watchDirectory(projectRoot);

// Intervalo de segurança a cada 15 segundos para capturar qualquer mudança não disparada pelo fs.watch
setInterval(() => {
  const changed = getChangedFiles();
  if (changed.length > 0 && !debounceTimer) {
    scheduleCommit();
  }
}, 15000);
