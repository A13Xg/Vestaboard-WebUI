import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const vercelPath = path.join(root, "vercel.json");
const GEMMA_MODEL = "gemma-3-4b-it";

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

async function testGemmaConnectivity(apiKey) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: "Reply with OK only." }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8,
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const rawText = await res.text();
    let detail = rawText.slice(0, 200);
    try {
      const json = JSON.parse(rawText);
      detail = json?.error?.message || detail;
    } catch {}
    throw new Error(detail || `status=${res.status}`);
  }

  const json = await res.json();
  const responseText = json?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join(" ").trim();
  if (!responseText) {
    throw new Error("Gemma returned an empty response");
  }

  return responseText;
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

  const gemmaApiKey = getVar("GEMMA_API_KEY", parsedEnv);
  printResult(
    "Env GEMMA_API_KEY",
    true,
    gemmaApiKey ? "loaded" : "not set (optional)",
  );

  const token = getVar("VESTABOARD_API_TOKEN", parsedEnv);
  const tokenOk = token.length >= 16;
  printResult("VESTABOARD_API_TOKEN basic format", tokenOk, `length=${token.length}`);
  if (!tokenOk) failures++;

  if (gemmaApiKey) {
    const gemmaOk = gemmaApiKey.length >= 16;
    printResult("GEMMA_API_KEY basic format", gemmaOk, `length=${gemmaApiKey.length}`);
    if (!gemmaOk) failures++;

    if (gemmaOk) {
      try {
        const responseText = await testGemmaConnectivity(gemmaApiKey);
        printResult("Gemma API auth", true, `model=${GEMMA_MODEL}; reply=${JSON.stringify(responseText)}`);
      } catch (error) {
        printResult("Gemma API auth", false, error.message);
        failures++;
      }
    }
  }

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
  let cronDetail = "vercel.json not found (advisory — not required for local/Docker)";
  if (fs.existsSync(vercelPath)) {
    try {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
      const crons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : [];
      cronOk = crons.some((c) => c.path === "/api/workflows/runner");
      cronDetail = cronOk ? "runner cron configured" : "runner cron missing from vercel.json";
    } catch {
      cronDetail = "invalid vercel.json (advisory)";
    }
  }
  const cronStatus = cronOk ? "PASS" : "WARN";
  console.log(`[${cronStatus}] Workflow cron config :: ${cronDetail}`);

  if (failures > 0) {
    console.error(`Startup tests failed: ${failures}`);
    process.exit(1);
  }

  console.log("All startup tests passed.");
}

main();
