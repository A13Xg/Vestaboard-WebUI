import { validateMessageText } from "@/lib/message-validation";
import { getWorkflowIntegrationDefinition } from "@/lib/workflow-integration-defs";
import type { WorkflowDataSource, WorkflowPreviewResponse } from "@/types";

/**
 * Characters not in the Vestaboard character set.
 * Anything not matching the allowed set is replaced with a space in boardSafe().
 */

const BOARD_SAFE_CHAR = /[^A-Z0-9!@#$()\-+&=;:'"%,./?° ]/g;

/**
 * Normalises an arbitrary string to only Vestaboard-printable characters:
 * - Collapses smart quotes, curly quotes, and backticks to ASCII equivalents
 * - Replaces en-dashes and em-dashes with hyphens
 * - Strips unsupported characters via BOARD_SAFE_CHAR
 * - Uppercases all letters (the board only supports uppercase)
 * - Collapses multiple spaces to a single space
 */
function boardSafe(value: string) {
  return value
    .replace(/\r?\n/g, " ")
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(BOARD_SAFE_CHAR, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Substitutes {variableName} placeholders in a template string with resolved values.
 * Unknown variable names resolve to empty string rather than the raw placeholder.
 */
function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => variables[key.trim()] ?? "");
}

/**
 * Maps WMO weather interpretation codes to human-readable condition strings
 * and a single-character board icon symbol.
 * https://open-meteo.com/en/docs#weathervariables
 */
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

/** Geocodes the location name via Open-Meteo, then fetches current weather. Returns board-safe template variables. */
async function resolveWeather(config: Record<string, string>) {
  const location = config.location?.trim() || "Los Angeles";
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
    location: boardSafe(match.country ? `${match.name} ${match.country}` : match.name),
    tempDeg: String(celsius),
    tempDegF: String(fahrenheit),
    condition: boardSafe(weatherInfo.condition),
    conditionIconSymbol: weatherInfo.icon,
    windKph: String(Math.round(current.wind_speed_10m ?? 0)),
  };
}

/** Fetches current price and 24 h change from CoinGecko for the given asset/currency pair. */
async function resolveCrypto(config: Record<string, string>) {
  const assetId = (config.assetId || "bitcoin").trim().toLowerCase();
  const currency = (config.currency || "usd").trim().toLowerCase();
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(assetId)}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true`, { cache: "no-store" });
  if (!res.ok) throw new Error("Crypto price lookup failed");
  const json = await res.json() as Record<string, Record<string, number>>;
  const entry = json[assetId];
  if (!entry) throw new Error(`No crypto data returned for ${assetId}`);
  return {
    assetName: boardSafe(assetId.replace(/-/g, " ")),
    assetId: boardSafe(assetId),
    currency: boardSafe(currency),
    price: String(entry[currency] ?? "N/A"),
    change24hPct: String(Math.round((entry[`${currency}_24h_change`] ?? 0) * 10) / 10),
  };
}

/**
 * Fetches a CSV stock quote from Stooq. The CSV header row is parsed dynamically
 * so new Stooq columns are handled gracefully without code changes.
 */
async function resolveStocks(config: Record<string, string>) {
  const symbol = (config.symbol || "aapl.us").trim().toLowerCase();
  const res = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcvn&e=csv`, { cache: "no-store" });
  if (!res.ok) throw new Error("Stock quote lookup failed");
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`No stock data returned for ${symbol}`);
  const header = lines[0].split(",");
  const values = lines[1].split(",");
  const map = Object.fromEntries(header.map((key, idx) => [key.trim().toLowerCase(), values[idx]?.trim() ?? ""]));
  return {
    symbol: boardSafe(map.symbol || symbol.toUpperCase()),
    date: boardSafe(map.date || ""),
    time: boardSafe(map.time || ""),
    open: boardSafe(map.open || ""),
    high: boardSafe(map.high || ""),
    low: boardSafe(map.low || ""),
    close: boardSafe(map.close || ""),
    volume: boardSafe(map.volume || ""),
  };
}

/** Fetches the top Hacker News Algolia result matching the given query. */
async function resolveNews(config: Record<string, string>) {
  const query = config.query?.trim() || "technology";
  const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=1`, { cache: "no-store" });
  if (!res.ok) throw new Error("News search failed");
  const json = await res.json() as { hits?: Array<{ title?: string; story_title?: string; author?: string; points?: number; url?: string; story_url?: string }> };
  const hit = json.hits?.[0];
  if (!hit) throw new Error(`No news results for ${query}`);
  return {
    query: boardSafe(query),
    headline: boardSafe(hit.title || hit.story_title || "NO HEADLINE"),
    author: boardSafe(hit.author || "UNKNOWN"),
    points: String(hit.points ?? 0),
    url: boardSafe(hit.url || hit.story_url || ""),
  };
}

async function resolveQuote() {
  const res = await fetch("https://dummyjson.com/quotes/random", { cache: "no-store" });
  if (!res.ok) throw new Error("Quote lookup failed");
  const json = await res.json() as { quote?: string; author?: string };
  return {
    quote: boardSafe(json.quote || ""),
    author: boardSafe(json.author || "UNKNOWN"),
  };
}

async function resolveExchangeRates(config: Record<string, string>) {
  const base = (config.base || "USD").trim().toUpperCase();
  const target = (config.target || "EUR").trim().toUpperCase();
  const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(target)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Exchange rate lookup failed");
  const json = await res.json() as { amount?: number; base?: string; date?: string; rates?: Record<string, number> };
  return {
    base: boardSafe(json.base || base),
    target: boardSafe(target),
    rate: String(json.rates?.[target] ?? "N/A"),
    date: boardSafe(json.date || ""),
  };
}

async function resolveTime(config: Record<string, string>) {
  const timezone = config.timezone?.trim() || "America/Los_Angeles";
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return {
    timezone: boardSafe(timezone),
    timezoneLabel: boardSafe(timezone.split("/").pop()?.replace(/_/g, " ") || timezone),
    time: boardSafe(time),
    date: boardSafe(date),
  };
}

async function resolveJoke() {
  const res = await fetch("https://official-joke-api.appspot.com/random_joke", { cache: "no-store" });
  if (!res.ok) throw new Error("Joke lookup failed");
  const json = await res.json() as { type?: string; setup?: string; punchline?: string };
  return {
    type: boardSafe(json.type || "GENERAL"),
    setup: boardSafe(json.setup || ""),
    punchline: boardSafe(json.punchline || ""),
  };
}

/**
 * Dispatches to the appropriate integration resolver based on `source.providerId`,
 * returning a flat key→value variables map for template substitution.
 */
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
    default:
      throw new Error(`Unsupported workflow data source: ${String((source as WorkflowDataSource).providerId)}`);
  }
}

/**
 * Resolves the data source, renders the message template, strips unsupported
 * characters, and validates the final text against the board character set.
 * Throws if the resolved text is empty or invalid — callers should catch and
 * surface the error to the user or the run-result log.
 */
export async function buildWorkflowPreview(messageText: string, dataSource?: WorkflowDataSource | null): Promise<WorkflowPreviewResponse> {
  const definition = dataSource ? getWorkflowIntegrationDefinition(dataSource.providerId) : undefined;
  const variables = dataSource ? await resolveWorkflowDataSource(dataSource) : {};
  const raw = dataSource ? renderTemplate(messageText, variables) : messageText;
  const safe = boardSafe(raw);
  const validation = validateMessageText(safe, "flagship");
  if (!validation.valid) {
    throw new Error(validation.error ?? "Rendered workflow output is invalid");
  }
  return {
    renderedText: validation.normalizedText,
    variables,
    providerLabel: definition?.label,
  };
}
