import { getWorkflowIntegrationDefinition } from "@/lib/workflow-integration-defs";
import { BOARD_COLOR_TOKENS, charToCode, emptyMatrix, sanitizeBoardText } from "@/lib/board-utils";
import { BOARD_PROFILES, type BoardModel } from "@/lib/board-model";
import { GEMMA_MODEL, generateGemmaText } from "@/lib/gemma-server";
import type { TextAlignment, WorkflowDataSource, WorkflowPreviewResponse } from "@/types";

const GEMMA_DEFAULT_TEMPERATURE = 0.7;
const GEMMA_RANDOM_MIN_TEMPERATURE = 0.52;
const GEMMA_RANDOM_MAX_TEMPERATURE = 0.9;

function buildGemmaPhrasePrompt(userPrompt: string) {
  return [
    "You are generating short copy for a Vestaboard display.",
    "Return plain text only with no markdown and no surrounding quotes.",
    "You may optionally include sparse color tokens like {R} {G} {B} as visual accents.",
    "Use color tokens sparingly, like emphasis, not full-board patterns.",
    "Keep output concise and board-friendly.",
    "",
    `USER REQUEST: ${userPrompt}`,
  ].join("\n");
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const normalizedKey = key.trim();
    if (Object.prototype.hasOwnProperty.call(variables, normalizedKey)) {
      return variables[normalizedKey] ?? "";
    }
    return "";
  });
}

function formatGemmaDebugResponse(responseText: string) {
  return JSON.stringify(responseText);
}

function logGemmaStage(stage: string, payload: Record<string, unknown>) {
  try {
    console.info(`[gemma.${stage}]`, JSON.stringify(payload));
  } catch {
    console.info(`[gemma.${stage}]`, payload);
  }
}

function sanitizeGemmaPlainText(rawResponse: string) {
  return sanitizeBoardText(rawResponse, {
    preserveNewlines: false,
    collapseWhitespace: true,
    trim: true,
  });
}

function randomGemmaTemperature(enabled: boolean) {
  if (!enabled) return GEMMA_DEFAULT_TEMPERATURE;
  const span = GEMMA_RANDOM_MAX_TEMPERATURE - GEMMA_RANDOM_MIN_TEMPERATURE;
  return Math.round((GEMMA_RANDOM_MIN_TEMPERATURE + Math.random() * span) * 100) / 100;
}

function parseTemplateWords(rawLine: string) {
  const words = rawLine.split(" ").filter((word) => word.length > 0);
  return words.map((word) => {
    const codes: number[] = [];
    const normalized = word.toUpperCase();
    for (let index = 0; index < normalized.length;) {
      if (normalized[index] === "{" && normalized[index + 2] === "}") {
        const token = normalized[index + 1];
        const colorCode = BOARD_COLOR_TOKENS[token];
        if (colorCode !== undefined) {
          codes.push(colorCode);
          index += 3;
          continue;
        }
      }

      const code = charToCode(normalized[index]);
      if (code !== 0) {
        codes.push(code);
      }
      index += 1;
    }
    return codes;
  });
}

function buildTemplateMatrix(text: string, boardModel: BoardModel, alignment: TextAlignment = "center") {
  const profile = BOARD_PROFILES[boardModel];
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\t/g, " ")
    .toUpperCase();

  const wrappedRows: number[][] = [];
  for (const rawLine of normalized.split("\n")) {
    const words = parseTemplateWords(rawLine);
    if (words.length === 0) {
      wrappedRows.push([]);
      continue;
    }

    let row: number[] = [];
    for (const word of words) {
      if (word.length === 0) continue;
      const separator = row.length === 0 ? 0 : 1;
      if (row.length + separator + word.length <= profile.cols) {
        if (separator) row.push(0);
        row.push(...word);
        continue;
      }

      if (row.length > 0) {
        wrappedRows.push(row.slice(0, profile.cols));
        row = [];
      }

      if (word.length <= profile.cols) {
        row.push(...word);
        continue;
      }

      for (let i = 0; i < word.length; i += profile.cols) {
        wrappedRows.push(word.slice(i, i + profile.cols));
      }
    }

    wrappedRows.push(row.slice(0, profile.cols));
  }

  const matrix = emptyMatrix(profile.rows, profile.cols);
  const visibleRows = wrappedRows.slice(0, profile.rows);

  for (let r = 0; r < visibleRows.length; r++) {
    const rowCodes = visibleRows[r];
    let startCol = 0;
    if (alignment === "center") {
      startCol = Math.max(0, Math.floor((profile.cols - rowCodes.length) / 2));
    } else if (alignment === "right") {
      startCol = Math.max(0, profile.cols - rowCodes.length);
    }

    for (let c = 0; c < Math.min(rowCodes.length, profile.cols); c++) {
      matrix[r][startCol + c] = rowCodes[c];
    }
  }

  return matrix;
}

function weatherCodeToLabel(code: number) {
  const map: Record<number, { condition: string; icon: string }> = {
    0: { condition: "CLEAR", icon: "°" },
    1: { condition: "MAINLY CLEAR", icon: "°" },
    2: { condition: "PARTLY CLOUDY", icon: "#" },
    3: { condition: "OVERCAST", icon: "#" },
    45: { condition: "FOG", icon: "?" },
    48: { condition: "RIME FOG", icon: "?" },
    51: { condition: "LIGHT DRIZZLE", icon: "." },
    61: { condition: "RAIN", icon: "." },
    71: { condition: "SNOW", icon: "*" },
    80: { condition: "SHOWERS", icon: "." },
    95: { condition: "THUNDER", icon: "!" },
  };
  return map[code] ?? { condition: "UNKNOWN", icon: "?" };
}

async function resolveWeather(config: Record<string, string>) {
  const location = config.location?.trim() || "Los Angeles";
  const preferFahrenheit = config.units === "true";
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`, { cache: "no-store" });
  if (!geoRes.ok) throw new Error("Weather geocoding failed");
  const geoJson = await geoRes.json() as { results?: Array<{ name: string; country?: string; latitude: number; longitude: number }> };
  const match = geoJson.results?.[0];
  if (!match) throw new Error(`No weather location found for ${location}`);

  const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${match.latitude}&longitude=${match.longitude}&current=temperature_2m,weather_code,wind_speed_10m`, { cache: "no-store" });
  if (!forecastRes.ok) throw new Error("Weather forecast lookup failed");
  const forecastJson = await forecastRes.json() as {
    current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
  };
  const current = forecastJson.current;
  if (!current) throw new Error("No current weather data available");
  const weatherInfo = weatherCodeToLabel(current.weather_code ?? 0);
  const celsius = Math.round(current.temperature_2m ?? 0);
  const fahrenheit = Math.round((celsius * 9) / 5 + 32);

  return {
    location: sanitizeBoardText(match.country ? `${match.name} ${match.country}` : match.name),
    tempDeg: String(preferFahrenheit ? fahrenheit : celsius),
    tempDegF: String(fahrenheit),
    condition: sanitizeBoardText(weatherInfo.condition),
    conditionIconSymbol: weatherInfo.icon,
    windKph: String(Math.round(current.wind_speed_10m ?? 0)),
  };
}

async function resolveCrypto(config: Record<string, string>) {
  const assetId = (config.assetId || "bitcoin").trim().toLowerCase();
  const currency = (config.currency || "usd").trim().toLowerCase();
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(assetId)}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true`, { cache: "no-store" });
  if (!res.ok) throw new Error("Crypto price lookup failed");
  const json = await res.json() as Record<string, Record<string, number>>;
  const entry = json[assetId];
  if (!entry) throw new Error(`No crypto data returned for ${assetId}`);
  return {
    assetName: sanitizeBoardText(assetId.replace(/-/g, " ")),
    assetId: sanitizeBoardText(assetId),
    currency: sanitizeBoardText(currency),
    price: String(entry[currency] ?? "N/A"),
    change24hPct: String(Math.round((entry[`${currency}_24h_change`] ?? 0) * 10) / 10),
  };
}

async function resolveStocks(config: Record<string, string>) {
  const symbol = (config.symbol || "aapl.us").trim().toLowerCase();
  const res = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcvn&e=csv`, { cache: "no-store" });
  if (!res.ok) throw new Error("Stock quote lookup failed");
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1 || !lines[0]) throw new Error(`No stock data returned for ${symbol}`);
  const hasHeader = lines.length >= 2 && /^symbol,/i.test(lines[0]);
  const header = hasHeader
    ? lines[0].split(",")
    : ["symbol", "date", "time", "open", "high", "low", "close", "volume", "name"];
  const values = hasHeader ? lines[1].split(",") : lines[0].split(",");
  if (values.length < 8) throw new Error(`No stock data returned for ${symbol}`);
  const map = Object.fromEntries(header.map((key, idx) => [key.trim().toLowerCase(), values[idx]?.trim() ?? ""]));
  return {
    symbol: sanitizeBoardText(map.symbol || symbol.toUpperCase()),
    date: sanitizeBoardText(map.date || ""),
    time: sanitizeBoardText(map.time || ""),
    open: sanitizeBoardText(map.open || ""),
    high: sanitizeBoardText(map.high || ""),
    low: sanitizeBoardText(map.low || ""),
    close: sanitizeBoardText(map.close || ""),
    volume: sanitizeBoardText(map.volume || ""),
  };
}

async function resolveNews(config: Record<string, string>) {
  const query = config.query?.trim() || "technology";
  const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=1`, { cache: "no-store" });
  if (!res.ok) throw new Error("News search failed");
  const json = await res.json() as { hits?: Array<{ title?: string; story_title?: string; author?: string; points?: number; url?: string; story_url?: string }> };
  const hit = json.hits?.[0];
  if (!hit) throw new Error(`No news results for ${query}`);
  return {
    query: sanitizeBoardText(query),
    headline: sanitizeBoardText(hit.title || hit.story_title || "NO HEADLINE"),
    author: sanitizeBoardText(hit.author || "UNKNOWN"),
    points: String(hit.points ?? 0),
    url: sanitizeBoardText(hit.url || hit.story_url || ""),
  };
}

async function resolveQuote() {
  const res = await fetch("https://dummyjson.com/quotes/random", { cache: "no-store" });
  if (!res.ok) throw new Error("Quote lookup failed");
  const json = await res.json() as { quote?: string; author?: string };
  return {
    quote: sanitizeBoardText(json.quote || ""),
    author: sanitizeBoardText(json.author || "UNKNOWN"),
  };
}

async function resolveExchangeRates(config: Record<string, string>) {
  const base = (config.base || "USD").trim().toUpperCase();
  const target = (config.target || "EUR").trim().toUpperCase();
  const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(target)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Exchange rate lookup failed");
  const json = await res.json() as { amount?: number; base?: string; date?: string; rates?: Record<string, number> };
  return {
    base: sanitizeBoardText(json.base || base),
    target: sanitizeBoardText(target),
    rate: String(json.rates?.[target] ?? "N/A"),
    date: sanitizeBoardText(json.date || ""),
  };
}

async function resolveTime(config: Record<string, string>) {
  const timezone = config.timezone?.trim() || "America/Los_Angeles";
  const locale = config.locale?.trim() || "en-US";
  const use24Hour = config.use24Hour !== "false";
  const location = config.location?.trim() || timezone.split("/").pop()?.replace(/_/g, " ") || timezone;
  const now = new Date();

  const timeParts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !use24Hour,
  }).formatToParts(now);

  const dateParts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(now);

  const monthWord = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: "long",
  }).format(now);

  const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  const hour = part(timeParts, "hour");
  const min = part(timeParts, "minute");
  const sec = part(timeParts, "second");
  const month = part(dateParts, "month");
  const day = part(dateParts, "day");
  const year = part(dateParts, "year");
  const weekDay = part(dateParts, "weekday");
  const time = [hour, min, sec].filter(Boolean).join(":");
  const date = [month, day, year].filter(Boolean).join("/");

  return {
    location: sanitizeBoardText(location),
    timezone: sanitizeBoardText(timezone),
    timezoneLabel: sanitizeBoardText(timezone.split("/").pop()?.replace(/_/g, " ") || timezone),
    locale: sanitizeBoardText(locale),
    monthWord: sanitizeBoardText(monthWord),
    month: sanitizeBoardText(month),
    day: sanitizeBoardText(day),
    weekDay: sanitizeBoardText(weekDay),
    year: sanitizeBoardText(year),
    hour: sanitizeBoardText(hour),
    min: sanitizeBoardText(min),
    sec: sanitizeBoardText(sec),
    time: sanitizeBoardText(time),
    date: sanitizeBoardText(date),
  };
}

async function resolveJoke() {
  const res = await fetch("https://official-joke-api.appspot.com/random_joke", { cache: "no-store" });
  if (!res.ok) throw new Error("Joke lookup failed");
  const json = await res.json() as { type?: string; setup?: string; punchline?: string };
  return {
    type: sanitizeBoardText(json.type || "GENERAL"),
    setup: sanitizeBoardText(json.setup || ""),
    punchline: sanitizeBoardText(json.punchline || ""),
  };
}

async function resolveGemma(config: Record<string, string>) {
  const prompt = config.prompt?.trim();
  if (!prompt) {
    throw new Error("Gemma prompt is required");
  }
  const randomTemperatureEnabled = config.randomTemperature === "true";
  const temperature = randomGemmaTemperature(randomTemperatureEnabled);
  logGemmaStage("request", { prompt, model: GEMMA_MODEL, randomTemperatureEnabled, temperature });

  const rawContent = await generateGemmaText(buildGemmaPhrasePrompt(prompt), {
    generationConfig: {
      temperature,
      maxOutputTokens: 120,
    },
  });
  logGemmaStage("content", { rawContent });

  const initialContent = sanitizeGemmaPlainText(rawContent);
  if (!initialContent) {
    throw new Error(`Gemma returned empty output. Raw response: ${formatGemmaDebugResponse(rawContent)}`);
  }

  return {
    response: initialContent,
    prompt: sanitizeBoardText(prompt),
    model: sanitizeBoardText(GEMMA_MODEL),
    content: initialContent,
    temperature: String(temperature),
    randomTemperature: randomTemperatureEnabled ? "TRUE" : "FALSE",
  };
}

export async function resolveWorkflowDataSource(source: WorkflowDataSource) {
  switch (source.providerId) {
    case "weather":
      return resolveWeather(source.config);
    case "crypto":
      return resolveCrypto(source.config);
    case "stocks":
      return resolveStocks(source.config);
    case "news":
      return resolveNews(source.config);
    case "quote":
      return resolveQuote();
    case "exchange-rates":
      return resolveExchangeRates(source.config);
    case "time":
      return resolveTime(source.config);
    case "joke":
      return resolveJoke();
    case "gemma":
      return resolveGemma(source.config);
    default:
      throw new Error(`Unsupported workflow data source: ${String((source as WorkflowDataSource).providerId)}`);
  }
}

function normalizeDataSources(
  dataSource?: WorkflowDataSource | null,
  dataSources?: WorkflowDataSource[] | null,
) {
  const fromArray = Array.isArray(dataSources) ? dataSources : [];
  const merged = fromArray.length > 0 ? fromArray : (dataSource ? [dataSource] : []);
  return merged.filter((source) => source && source.providerId).map((source) => ({
    ...source,
    enabled: source.enabled !== false,
  }));
}

async function resolveWorkflowDataSources(
  messageText: string,
  dataSource?: WorkflowDataSource | null,
  dataSources?: WorkflowDataSource[] | null,
) {
  const resolvedSources = normalizeDataSources(dataSource, dataSources).filter((source) => source.enabled !== false);
  const usedVariables = new Set(Array.from(messageText.matchAll(/\{([^}]+)\}/g)).map((entry) => entry[1].trim()));
  const mergedVariables: Record<string, string> = {};
  const providerLabels: string[] = [];

  for (const source of resolvedSources) {
    const definition = getWorkflowIntegrationDefinition(source.providerId);
    if (usedVariables.size > 0 && definition) {
      const providerPrefixDot = `${source.providerId}.`;
      const providerPrefixUnderscore = `${source.providerId}_`;
      const isReferenced = Array.from(usedVariables).some((token) => {
        if (definition.availableVariables.includes(token)) return true;
        if (token.startsWith(providerPrefixDot)) {
          return definition.availableVariables.includes(token.slice(providerPrefixDot.length));
        }
        if (token.startsWith(providerPrefixUnderscore)) {
          return definition.availableVariables.includes(token.slice(providerPrefixUnderscore.length));
        }
        return false;
      });

      if (!isReferenced) {
        continue;
      }
    }

    const vars = await resolveWorkflowDataSource(source);
    const label = definition?.label;
    if (label) providerLabels.push(label);

    for (const [key, value] of Object.entries(vars)) {
      mergedVariables[key] = value;
      mergedVariables[`${source.providerId}.${key}`] = value;
      mergedVariables[`${source.providerId}_${key}`] = value;
    }
  }

  for (const token of Object.keys(BOARD_COLOR_TOKENS)) {
    mergedVariables[token] = `{${token}}`;
  }

  return {
    variables: mergedVariables,
    providerLabel: providerLabels.join(" + ") || undefined,
  };
}

function buildStandardWorkflowPreview(
  messageText: string,
  variables: Record<string, string>,
  alignment: TextAlignment | undefined,
  boardModel: BoardModel,
) {
  const raw = renderTemplate(messageText, variables);
  const renderedMatrix = buildTemplateMatrix(raw, boardModel, alignment ?? "center");

  const renderedText = raw.trim();
  if (!renderedText) {
    throw new Error("Rendered workflow output is empty");
  }

  return {
    boardModel,
    renderedMatrix,
    renderedText,
  };
}

export async function buildWorkflowPreview(
  messageText: string,
  dataSource?: WorkflowDataSource | null,
  options: { alignment?: TextAlignment; boardModel?: BoardModel; dataSources?: WorkflowDataSource[] } = {},
): Promise<WorkflowPreviewResponse> {
  const resolved = await resolveWorkflowDataSources(messageText, dataSource, options.dataSources);
  const variables = resolved.variables;
  const boardModel = options.boardModel ?? "flagship";
  const preview = buildStandardWorkflowPreview(
    dataSource || (options.dataSources && options.dataSources.length > 0)
      ? messageText
      : sanitizeBoardText(messageText, { preserveNewlines: true }),
    variables,
    options.alignment,
    boardModel,
  );

  return {
    boardModel: preview.boardModel,
    renderedText: preview.renderedText,
    renderedMatrix: preview.renderedMatrix,
    variables,
    providerLabel: resolved.providerLabel,
  };
}
