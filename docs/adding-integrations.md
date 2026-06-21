# Adding a New Integration

Integrations (data providers) let workflows pull live data and interpolate it into board messages using `{variable}` placeholders.

## Overview

Adding a new provider requires changes to two files:

| File | Change |
|---|---|
| `lib/workflow-integration-defs.ts` | Add the metadata definition |
| `lib/workflow-integrations.ts` | Add the resolver function and a `case` in the dispatcher |

The type system will surface any missing pieces via TypeScript errors.

---

## Step 1 — Add the Type

Open `types/index.ts` and add the new provider ID to the `WorkflowDataSourceProviderId` union:

```ts
export type WorkflowDataSourceProviderId =
  | "weather"
  | "crypto"
  | "stocks"
  | "news"
  | "quote"
  | "exchange-rates"
  | "time"
  | "joke"
  | "my-new-provider"; // ← add this
```

---

## Step 2 — Add the Definition

Open `lib/workflow-integration-defs.ts` and add an entry to the `WORKFLOW_INTEGRATIONS` array:

```ts
{
  id: "my-new-provider",
  label: "My Provider",
  description: "Short description shown in the Workflow Studio.",
  category: "utility",      // "finance" | "news" | "content" | "utility" | "system"
  priority: "public",       // "public" | "free-api-key" | "paid"
  defaultTemplate: "VALUE IS {myVariable}",
  availableVariables: ["myVariable", "otherVar"],
  fields: [
    {
      key: "configKey",
      label: "Config Label",
      placeholder: "example value",
      defaultValue: "default",
      helpText: "Optional helper text shown below the input",
      multiline: false,
      rows: 4,
    },
  ],
},
```

**Fields reference:**

| Property | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | Matches a key in `WorkflowDataSource.config` |
| `label` | `string` | Yes | Input label in the UI |
| `placeholder` | `string` | No | Input placeholder text |
| `defaultValue` | `string` | No | Pre-filled value |
| `helpText` | `string` | No | Secondary description below the input |
| `multiline` | `boolean` | No | Render the field as a textarea instead of a single-line input |
| `rows` | `number` | No | Default textarea rows when `multiline` is enabled |

---

## Step 3 — Add the Resolver

Open `lib/workflow-integrations.ts`. Add a private resolver function:

```ts
import { sanitizeBoardText } from "@/lib/board-utils";

/** Fetches data from My Provider and returns board-safe template variables. */
async function resolveMyProvider(config: Record<string, string>) {
  const configKey = (config.configKey || "default").trim();
  const res = await fetch(`https://api.example.com/data?key=${encodeURIComponent(configKey)}`, {
    cache: "no-store", // always fetch fresh data for workflows
  });
  if (!res.ok) throw new Error("My Provider lookup failed");
  const json = await res.json() as { value?: string; other?: string };
  return {
    myVariable: sanitizeBoardText(json.value ?? "N/A"),
    otherVar: sanitizeBoardText(json.other ?? ""),
  };
}
```

**Important conventions:**
- All returned values must pass through `sanitizeBoardText()` to strip unsupported characters.
- Use `cache: "no-store"` so every workflow execution gets fresh data.
- Throw a descriptive `Error` on failure — the runner catches it and records it in `lastExecution`.
- Return a flat `Record<string, string>` — keys become `{variable}` names.

Then add a `case` to the `resolveWorkflowDataSource` dispatcher:

```ts
export async function resolveWorkflowDataSource(source: WorkflowDataSource) {
  switch (source.providerId) {
    // ... existing cases ...
    case "my-new-provider":
      return resolveMyProvider(source.config);
    default:
      throw new Error(`Unsupported workflow data source: ${String((source as WorkflowDataSource).providerId)}`);
  }
}
```

---

## Step 4 — Test with Preview

Use the Workflow Studio preview panel or call the preview API directly:

```bash
curl -s -X POST http://localhost:3000/api/workflows/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{
    "messageText": "VALUE IS {myVariable}",
    "dataSource": {
      "providerId": "my-new-provider",
      "config": { "configKey": "someValue" }
    }
  }'
```

Expected response:

```json
{
  "renderedText": "VALUE IS HELLO",
  "variables": { "myVariable": "HELLO", "otherVar": "" },
  "providerLabel": "My Provider"
}
```

---

## Checklist

- [ ] Provider ID added to `WorkflowDataSourceProviderId` in `types/index.ts`
- [ ] Definition added to `WORKFLOW_INTEGRATIONS` array
- [ ] Resolver function written with `sanitizeBoardText()` on all returned values
- [ ] `case` added to `resolveWorkflowDataSource`
- [ ] Preview tested with a real template
- [ ] Error path tested (bad config, API down)
