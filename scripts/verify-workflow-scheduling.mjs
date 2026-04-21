import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const baseUrl = process.env.WORKFLOW_TEST_BASE_URL || "http://127.0.0.1:3000";
const POLL_INTERVAL_MS = 10_000;

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
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    out[key] = value;
  }
  return out;
}

function getVar(key, parsedEnv) {
  return process.env[key] || parsedEnv[key] || "";
}

function logStep(message) {
  console.log(`\n== ${message} ==`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function api(pathname, { method = "GET", body, headers = {}, cookie, expectedStatus } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${method} ${pathname} expected ${expectedStatus} but got ${response.status}: ${text}`);
  }

  if (expectedStatus === undefined && !response.ok) {
    throw new Error(`${method} ${pathname} failed with ${response.status}: ${text}`);
  }

  return {
    status: response.status,
    data: json,
    headers: response.headers,
  };
}

function nextFutureMinute(offsetMinutes = 2) {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date;
}

function formatHHMM(date) {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

async function waitUntil(targetDate, label, leadTimeMs = 3_000) {
  const targetTime = targetDate.getTime() - leadTimeMs;
  while (Date.now() < targetTime) {
    const remainingMs = targetTime - Date.now();
    const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
    process.stdout.write(`Waiting for ${label}: ${remainingSec}s remaining...\r`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(remainingMs, 5_000)));
  }
  process.stdout.write(" ".repeat(80) + "\r");
}

function createName(prefix) {
  return `VERIFY ${prefix} ${Date.now()}`;
}

async function login(accessCode) {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: { accessCode },
    expectedStatus: 200,
  });
  const cookie = response.headers.get("set-cookie");
  assert(cookie, "Login did not return a session cookie");
  return cookie.split(";")[0];
}

async function createWorkflow(cookie, body) {
  const response = await api("/api/workflows", {
    method: "POST",
    body,
    cookie,
    expectedStatus: 201,
  });
  return response.data;
}

async function getWorkflow(cookie, id) {
  const response = await api(`/api/workflows/${id}`, {
    method: "GET",
    cookie,
    expectedStatus: 200,
  });
  return response.data;
}

async function deleteWorkflow(cookie, id) {
  await api(`/api/workflows/${id}`, {
    method: "DELETE",
    cookie,
    expectedStatus: 200,
  });
}

async function runDueWithSession(cookie, source) {
  return api("/api/workflows/runner", {
    method: "POST",
    cookie,
    headers: {
      "X-Workflow-Runner-Source": source,
    },
    body: { mode: "due" },
    expectedStatus: 200,
  });
}

async function runDueWithCron(cronSecret, source) {
  return api("/api/workflows/runner", {
    method: "POST",
    headers: {
      "X-Cron-Secret": cronSecret,
      "X-Workflow-Runner-Source": source,
    },
    body: { mode: "due" },
    expectedStatus: 200,
  });
}

async function previewWorkflow(cookie, message, dataSource) {
  const response = await api("/api/workflows/preview", {
    method: "POST",
    cookie,
    body: { message, dataSource },
    expectedStatus: 200,
  });
  return response.data;
}

async function getHistory(cookie, limit = 100) {
  const response = await api(`/api/messages/history?limit=${limit}`, {
    method: "GET",
    cookie,
    expectedStatus: 200,
  });
  return response.data.messages;
}

async function waitForWorkflowExecution({
  workflowIds,
  pollFn,
  timeoutMs = 120_000,
}) {
  const remaining = new Set(workflowIds);
  const deadline = Date.now() + timeoutMs;
  const results = [];

  while (Date.now() < deadline && remaining.size > 0) {
    const response = await pollFn();
    const matched = response.data.results.filter((item) => remaining.has(item.workflowId));
    for (const result of matched) {
      remaining.delete(result.workflowId);
      results.push(result);
    }
    if (remaining.size === 0) {
      return results;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for workflows to execute: ${Array.from(remaining).join(", ")}`);
}

async function waitForHistoryEntries(cookie, workflowIds, timeoutMs = 30_000) {
  const remaining = new Set(workflowIds);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline && remaining.size > 0) {
    const messages = await getHistory(cookie, 200);
    for (const entry of messages) {
      const workflowId = entry?.meta?.workflowId;
      if (workflowId && remaining.has(workflowId)) {
        remaining.delete(workflowId);
      }
    }
    if (remaining.size === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`Timed out waiting for message history entries: ${Array.from(remaining).join(", ")}`);
}

async function verifyUnauthorizedRunner() {
  const response = await api("/api/workflows/runner", {
    method: "POST",
    body: { mode: "due" },
    expectedStatus: 401,
  });
  assert(response.data.error === "Unauthorized", "Unauthorized runner response did not return Unauthorized");
  console.log("Verified unauthorized runner rejection.");
}

async function verifyPreviewMatrix(cookie) {
  logStep("Preview validation across providers");

  const previewCases = [
    {
      label: "manual",
      message: { text: "SCHEDULE TEST", alignment: "center" },
      dataSource: null,
      expectBoardModel: "flagship",
    },
    {
      label: "time",
      message: { text: "{timezoneLabel} {time}", alignment: "center" },
      dataSource: { providerId: "time", config: { timezone: "America/Los_Angeles" } },
      expectBoardModel: "flagship",
    },
    {
      label: "weather",
      message: { text: "WX {tempDeg}C {condition}", alignment: "center" },
      dataSource: { providerId: "weather", config: { location: "Los Angeles" } },
      expectBoardModel: "flagship",
    },
    {
      label: "crypto",
      message: { text: "{assetName} {price}", alignment: "center" },
      dataSource: { providerId: "crypto", config: { assetId: "bitcoin", currency: "usd" } },
      expectBoardModel: "flagship",
    },
    {
      label: "stocks",
      message: { text: "{symbol} {close}", alignment: "center" },
      dataSource: { providerId: "stocks", config: { symbol: "aapl.us" } },
      expectBoardModel: "flagship",
    },
    {
      label: "news",
      message: { text: "NEWS {headline}", alignment: "center" },
      dataSource: { providerId: "news", config: { query: "technology" } },
      expectBoardModel: "flagship",
    },
    {
      label: "quote",
      message: { text: "{quote}", alignment: "center" },
      dataSource: { providerId: "quote", config: {} },
      expectBoardModel: "flagship",
    },
    {
      label: "exchange-rates",
      message: { text: "1 {base}={rate} {target}", alignment: "center" },
      dataSource: { providerId: "exchange-rates", config: { base: "USD", target: "EUR" } },
      expectBoardModel: "flagship",
    },
    {
      label: "joke",
      message: { text: "{setup}", alignment: "center" },
      dataSource: { providerId: "joke", config: {} },
      expectBoardModel: "flagship",
    },
    {
      label: "gemma",
      message: { text: "{response}", alignment: "center" },
      dataSource: { providerId: "gemma", config: { prompt: "Generate a funny phrase." } },
      expectBoardModel: "note",
    },
  ];

  for (const previewCase of previewCases) {
    const preview = await previewWorkflow(cookie, previewCase.message, previewCase.dataSource);
    assert(preview.renderedText && preview.renderedText.trim().length > 0, `${previewCase.label} preview rendered empty text`);
    assert(preview.boardModel === previewCase.expectBoardModel, `${previewCase.label} preview used ${preview.boardModel} instead of ${previewCase.expectBoardModel}`);
    console.log(`${previewCase.label}: ${JSON.stringify(preview.renderedText)}`);
  }
}

function buildOnceSchedule(date) {
  return { type: "once", at: date.toISOString() };
}

async function verifyHeartbeatPath(cookie, createdWorkflowIds) {
  logStep("Heartbeat/session scheduled execution");

  const target = nextFutureMinute(2);
  const created = await createWorkflow(cookie, {
    name: createName("HEARTBEAT ONCE"),
    enabled: true,
    message: {
      text: "HEARTBEAT TEST",
      alignment: "center",
      style: "default",
      colorInserts: [],
    },
    schedule: buildOnceSchedule(target),
  });
  createdWorkflowIds.push(created.id);
  assert(created.nextRunAt, "Heartbeat workflow did not persist nextRunAt");

  console.log(`Heartbeat workflow due at ${created.nextRunAt}`);
  await waitUntil(target, "heartbeat due time");
  const results = await waitForWorkflowExecution({
    workflowIds: [created.id],
    pollFn: () => runDueWithSession(cookie, "verifier-heartbeat"),
  });
  assert(results.length === 1, "Heartbeat path did not execute exactly one workflow");

  const refreshed = await getWorkflow(cookie, created.id);
  assert(refreshed.lastExecution?.success, "Heartbeat workflow lastExecution was not successful");
  assert(refreshed.lastExecution?.triggerSource === "verifier-heartbeat", `Expected heartbeat triggerSource, got ${refreshed.lastExecution?.triggerSource}`);
  assert(refreshed.lastExecution?.scheduledFor === created.nextRunAt, "Heartbeat workflow scheduledFor did not match original nextRunAt");
  assert(refreshed.nextRunAt === null, "Heartbeat once workflow should clear nextRunAt after execution");
  await waitForHistoryEntries(cookie, [created.id]);
  console.log("Heartbeat path verified.");
}

async function verifyScheduleTypesWithCron(cookie, cronSecret, createdWorkflowIds) {
  logStep("Schedule type verification through cron-secret runner");

  const target = nextFutureMinute(2);
  const hhmm = formatHHMM(target);
  const weekday = target.getDay();

  const workflows = [
    {
      key: "once",
      body: {
        name: createName("ONCE"),
        enabled: true,
        message: { text: "ONCE OK", alignment: "center", style: "default", colorInserts: [] },
        schedule: buildOnceSchedule(target),
      },
      expectNullNextRunAfter: true,
    },
    {
      key: "daily",
      body: {
        name: createName("DAILY"),
        enabled: true,
        message: { text: "DAILY OK", alignment: "center", style: "default", colorInserts: [] },
        schedule: { type: "daily", timeHHMM: hhmm },
      },
      expectNullNextRunAfter: false,
    },
    {
      key: "weekly",
      body: {
        name: createName("WEEKLY"),
        enabled: true,
        message: { text: "WEEKLY OK", alignment: "center", style: "default", colorInserts: [] },
        schedule: { type: "weekly", timeHHMM: hhmm, daysOfWeek: [weekday] },
      },
      expectNullNextRunAfter: false,
    },
    {
      key: "cron",
      body: {
        name: createName("CRON"),
        enabled: true,
        message: { text: "CRON OK", alignment: "center", style: "default", colorInserts: [] },
        schedule: { type: "cron", cron: `${target.getMinutes()} ${target.getHours()} * * *` },
      },
      expectNullNextRunAfter: false,
    },
  ];

  const created = [];
  for (const item of workflows) {
    const workflow = await createWorkflow(cookie, item.body);
    createdWorkflowIds.push(workflow.id);
    assert(workflow.nextRunAt, `${item.key} workflow did not compute nextRunAt`);
    created.push({ ...item, workflow });
  }

  console.log(`Cron matrix due at ${target.toISOString()}`);
  await waitUntil(target, "schedule-type due time");
  const results = await waitForWorkflowExecution({
    workflowIds: created.map((item) => item.workflow.id),
    pollFn: () => runDueWithCron(cronSecret, "verifier-cron"),
  });
  assert(results.length === created.length, `Expected ${created.length} cron results, got ${results.length}`);

  for (const item of created) {
    const refreshed = await getWorkflow(cookie, item.workflow.id);
    assert(refreshed.lastExecution?.success, `${item.key} workflow did not execute successfully`);
    assert(refreshed.lastExecution?.triggerSource === "verifier-cron", `${item.key} workflow triggerSource was ${refreshed.lastExecution?.triggerSource}`);
    assert(refreshed.lastExecution?.scheduledFor === item.workflow.nextRunAt, `${item.key} scheduledFor did not match original nextRunAt`);
    if (item.expectNullNextRunAfter) {
      assert(refreshed.nextRunAt === null, `${item.key} once workflow should clear nextRunAt`);
    } else {
      assert(typeof refreshed.nextRunAt === "string" && refreshed.nextRunAt !== item.workflow.nextRunAt, `${item.key} workflow did not advance nextRunAt`);
    }
  }

  await waitForHistoryEntries(cookie, created.map((item) => item.workflow.id));
  console.log("Schedule type matrix verified.");
}

async function verifyScheduledProviderMatrix(cookie, cronSecret, createdWorkflowIds) {
  logStep("Scheduled provider matrix");

  const target = nextFutureMinute(2);
  const workflows = [
    {
      label: "time",
      body: {
        name: createName("TIME"),
        enabled: true,
        message: { text: "{timezoneLabel} {time}", alignment: "center", style: "default", colorInserts: [] },
        dataSource: { providerId: "time", config: { timezone: "America/Los_Angeles" } },
        schedule: buildOnceSchedule(target),
      },
    },
    {
      label: "weather",
      body: {
        name: createName("WEATHER"),
        enabled: true,
        message: { text: "WX {tempDeg}C {condition}", alignment: "center", style: "default", colorInserts: [] },
        dataSource: { providerId: "weather", config: { location: "Los Angeles" } },
        schedule: buildOnceSchedule(target),
      },
    },
    {
      label: "quote",
      body: {
        name: createName("QUOTE"),
        enabled: true,
        message: { text: "{quote}", alignment: "center", style: "default", colorInserts: [] },
        dataSource: { providerId: "quote", config: {} },
        schedule: buildOnceSchedule(target),
      },
    },
    {
      label: "joke",
      body: {
        name: createName("JOKE"),
        enabled: true,
        message: { text: "{setup}", alignment: "center", style: "default", colorInserts: [] },
        dataSource: { providerId: "joke", config: {} },
        schedule: buildOnceSchedule(target),
      },
    },
    {
      label: "gemma",
      body: {
        name: createName("GEMMA"),
        enabled: true,
        message: { text: "{response}", alignment: "center", style: "default", colorInserts: [] },
        dataSource: { providerId: "gemma", config: { prompt: "Generate a short inspirational quote that fits the output parameters." } },
        schedule: buildOnceSchedule(target),
      },
    },
  ];

  const created = [];
  for (const item of workflows) {
    const workflow = await createWorkflow(cookie, item.body);
    createdWorkflowIds.push(workflow.id);
    created.push({ ...item, workflow });
  }

  console.log(`Provider matrix due at ${target.toISOString()}`);
  await waitUntil(target, "provider due time");
  const results = await waitForWorkflowExecution({
    workflowIds: created.map((item) => item.workflow.id),
    pollFn: () => runDueWithCron(cronSecret, "verifier-cron"),
    timeoutMs: 180_000,
  });
  assert(results.length === created.length, `Expected ${created.length} provider results, got ${results.length}`);

  for (const item of created) {
    const refreshed = await getWorkflow(cookie, item.workflow.id);
    assert(refreshed.lastExecution?.success, `${item.label} scheduled workflow failed`);
    assert(refreshed.lastExecution?.renderedText, `${item.label} scheduled workflow did not persist renderedText`);
    assert(refreshed.lastExecution?.triggerSource === "verifier-cron", `${item.label} scheduled workflow triggerSource mismatch`);
    console.log(`${item.label}: ${JSON.stringify(refreshed.lastExecution.renderedText)}`);
  }

  await waitForHistoryEntries(cookie, created.map((item) => item.workflow.id));
  console.log("Scheduled provider matrix verified.");
}

async function cleanupWorkflows(cookie, workflowIds) {
  for (const id of workflowIds.reverse()) {
    try {
      await deleteWorkflow(cookie, id);
    } catch (error) {
      console.warn(`Cleanup failed for ${id}: ${error.message}`);
    }
  }
}

async function main() {
  const parsedEnv = parseEnvFile(envPath);
  const accessCode = getVar("ACCESS_CODE", parsedEnv);
  const cronSecret = getVar("CRON_SECRET", parsedEnv);

  assert(accessCode, "ACCESS_CODE is required in .env.local or environment");
  assert(cronSecret, "CRON_SECRET is required in .env.local or environment to verify unattended scheduling");

  const createdWorkflowIds = [];
  const cookie = await login(accessCode);

  try {
    logStep("Runner auth checks");
    await verifyUnauthorizedRunner();
    const cronProbe = await runDueWithCron(cronSecret, "verifier-cron-probe");
    assert(typeof cronProbe.data.triggered === "number", "Cron-secret runner probe did not return a valid response");
    console.log(`Cron-secret runner probe succeeded with triggered=${cronProbe.data.triggered}.`);

    await verifyHeartbeatPath(cookie, createdWorkflowIds);
    await verifyPreviewMatrix(cookie);
    await verifyScheduleTypesWithCron(cookie, cronSecret, createdWorkflowIds);
    await verifyScheduledProviderMatrix(cookie, cronSecret, createdWorkflowIds);

    logStep("Workflow scheduling verification complete");
    console.log("All schedule verification checks passed.");
  } finally {
    await cleanupWorkflows(cookie, createdWorkflowIds);
  }
}

main().catch((error) => {
  console.error(`Workflow scheduling verification failed: ${error.message}`);
  process.exit(1);
});
