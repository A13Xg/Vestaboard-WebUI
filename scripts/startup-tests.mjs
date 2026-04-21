import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const vercelPath = path.join(root, "vercel.json");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function getVar(key, parsedEnv) {
  return process.env[key] || parsedEnv[key] || "";
}

async function testVestaboardConnectivity(token) {
  const res = await fetch("https://rw.vestaboard.com/", {
    method: "GET",
    headers: {
      "X-Vestaboard-Read-Write-Key": token,
    },
    cache: "no-store",
  });
  return res.status;
}

function printResult(name, ok, detail) {
  const status = ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function main() {
  console.log("Running startup tests...");

  const parsedEnv = parseEnvFile(envPath);
  const required = ["SESSION_SECRET", "ACCESS_CODE", "VESTABOARD_API_TOKEN"];

  let failures = 0;

  for (const key of required) {
    const value = getVar(key, parsedEnv);
    const ok = Boolean(value);
    printResult(`Env ${key}`, ok, ok ? "loaded" : "missing");
    if (!ok) failures++;
  }

  const cronSecret = getVar("CRON_SECRET", parsedEnv);
  printResult(
    "Env CRON_SECRET",
    true,
    cronSecret ? "loaded" : "not set (optional)",
  );

  const token = getVar("VESTABOARD_API_TOKEN", parsedEnv);
  const tokenOk = token.length >= 16;
  printResult("VESTABOARD_API_TOKEN basic format", tokenOk, `length=${token.length}`);
  if (!tokenOk) failures++;

  if (tokenOk) {
    try {
      const status = await testVestaboardConnectivity(token);
      const ok = status >= 200 && status < 300;
      printResult("Vestaboard API auth", ok, `status=${status}`);
      if (!ok) failures++;
    } catch (error) {
      printResult("Vestaboard API auth", false, error.message);
      failures++;
    }
  }

  const buildIdPath = path.join(root, ".next", "BUILD_ID");
  const buildOk = fs.existsSync(buildIdPath);
  printResult("Next build artifact", buildOk, buildOk ? "BUILD_ID found" : "BUILD_ID missing");
  if (!buildOk) failures++;

  let cronOk = false;
  let cronDetail = "vercel.json missing";
  if (fs.existsSync(vercelPath)) {
    try {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
      const crons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : [];
      cronOk = crons.some((c) => c.path === "/api/workflows/runner");
      cronDetail = cronOk ? "runner cron configured" : "runner cron missing";
    } catch {
      cronDetail = "invalid vercel.json";
    }
  }
  printResult("Workflow cron config", cronOk, cronDetail);
  if (!cronOk) failures++;

  if (failures > 0) {
    console.error(`Startup tests failed: ${failures}`);
    process.exit(1);
  }

  console.log("All startup tests passed.");
}

main();
