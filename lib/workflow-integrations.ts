import { validateMessageText } from "@/lib/message-validation";
import { getWorkflowIntegrationDefinition } from "@/lib/workflow-integration-defs";
import { BOARD_COLOR_TOKENS, directCodesToMatrix, fitTextToBoard, matrixToPlainText, matrixToSequentialTokens, parseSequentialBoardTokens, sanitizeBoardText } from "@/lib/board-utils";
import { BOARD_PROFILES, type BoardModel } from "@/lib/board-model";
import { GEMMA_MODEL, generateGemmaText } from "@/lib/gemma-server";
import type { TextAlignment, WorkflowDataSource, WorkflowPreviewResponse } from "@/types";

type GemmaScenario = "word" | "phrase" | "pattern";
type GemmaPatternType = "flag" | "zigzag" | "checker" | "stripes" | "diagonal";

const GEMMA_NOTE_ROWS = BOARD_PROFILES.note.rows;
const GEMMA_NOTE_COLS = BOARD_PROFILES.note.cols;
const GEMMA_NOTE_CELLS = GEMMA_NOTE_ROWS * GEMMA_NOTE_COLS;
const PROMPT_COLOR_MAP: Record<string, keyof typeof BOARD_COLOR_TOKENS> = {
  red: "R",
  orange: "O",
  yellow: "Y",
  green: "G",
  blue: "B",
  purple: "P",
  violet: "P",
  white: "W",
};
const GEMMA_WORD_BANK = [
  { word: "RESILIENCE", definition: "BOUNCING BACK", synonyms: "GRIT,SPIRIT" },
  { word: "CLARITY", definition: "CLEAR THINKING", synonyms: "FOCUS,ORDER" },
  { word: "CANDOR", definition: "HONEST SPEECH", synonyms: "FRANKNESS,TRUTH" },
  { word: "WONDER", definition: "AWE AT BEAUTY", synonyms: "AWE,AMAZEMENT" },
  { word: "STEADFAST", definition: "FIRMLY LOYAL", synonyms: "LOYAL,RESOLUTE" },
  { word: "SPARK", definition: "SMALL LIVE ENERGY", synonyms: "GLINT,FLASH" },
  { word: "KINSHIP", definition: "CLOSE HUMAN BOND", synonyms: "UNITY,CLAN" },
  { word: "LUCID", definition: "EASY TO UNDERSTAND", synonyms: "CLEAR,SHARP" },
];

function buildGemmaWordPrompt(userPrompt: string) {
  return [
    "You are generating content for a 3x15 Vestaboard Note.",
    "Return ONLY one line in the format WORD||DETAIL.",
    "WORD must be a single strong word and should fit within 15 characters.",
    "DETAIL must be short plain text that fits within 30 characters.",
    "If the user asks for synonyms, use 1 to 3 common synonyms in DETAIL.",
    "Do not use quotes, bullet points, explanations, or labels.",
    "",
    `USER REQUEST: ${userPrompt}`,
  ].join("\n");
}

function buildGemmaPhrasePrompt(userPrompt: string) {
  return [
    "You are generating content for a 3x15 Vestaboard Note.",
    "Return ONLY a short plain-text phrase.",
    "No quotes, no attribution, no markdown, no labels, no color tokens.",
    "Keep it concise, readable, and suitable for a 45-cell display.",
    "",
    `USER REQUEST: ${userPrompt}`,
  ].join("\n");
}

function buildGemmaShortenPrompt(userPrompt: string, contentText: string) {
  return [
    "Rewrite the content so it fits a 3x15 Vestaboard Note.",
    "Return plain text only.",
    "Keep the meaning, but shorten aggressively.",
    "No quotes, no attribution, no labels, no explanations.",
    "",
    `USER REQUEST: ${userPrompt}`,
    `CONTENT TO SHORTEN: ${contentText}`,
  ].join("\n");
}

function buildGemmaPatternPalettePrompt(userPrompt: string) {
  return [
    "Pick a small color palette for a Vestaboard Note pattern.",
    "Return ONLY 2 or 3 letters separated by commas.",
    "Allowed letters: R,O,Y,G,B,P,W",
    "Do not return words or explanations.",
    "",
    `USER REQUEST: ${userPrompt}`,
  ].join("\n");
}

function buildGemmaWordRepairPrompt(userPrompt: string, rawResponse: string) {
  return [
    "Your previous word-card response was invalid because it did not clearly provide both the word and the short detail.",
    "Return ONLY one line in the format WORD||DETAIL.",
    "WORD must be a single word that fits within 15 characters.",
    "DETAIL must be short plain text that fits within 30 characters.",
    "Do not stop after the word.",
    "Do not use labels, quotes, or explanations.",
    "",
    `USER REQUEST: ${userPrompt}`,
    `PREVIOUS RESPONSE: ${rawResponse}`,
  ].join("\n");
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => variables[key.trim()] ?? "");
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

function classifyGemmaScenario(prompt: string): GemmaScenario {
  if (/\b(word(?:\s+of\s+the\s+day)?|definition|define|synonym|synonyms|vocabulary)\b/i.test(prompt)) {
    return "word";
  }

  if (/\b(pattern|visual|flag|zig[\s-]*zag|checker|checkerboard|stripe|stripes|diagonal|geometric|color|colour|ascii|art)\b/i.test(prompt)) {
    return "pattern";
  }

  return "phrase";
}

function parseGemmaWordEntry(rawResponse: string) {
  const normalized = rawResponse.replace(/\r\n?/g, "\n").trim();
  const line = normalized.split("\n").find((entry) => entry.trim().length > 0) ?? "";
  const [rawWord, ...rawDetailParts] = line.split("||");
  const sanitizedLine = sanitizeGemmaPlainText(line);
  const delimiterParts = sanitizedLine.split(/\s+-\s+|\s+:\s+/);
  const wordAndRestParts = sanitizedLine.split(/\s+/);
  const fallbackWord = delimiterParts[0] || wordAndRestParts[0] || "";
  const fallbackDetail = delimiterParts.length > 1
    ? delimiterParts.slice(1).join(" ")
    : wordAndRestParts.slice(1).join(" ");
  const word = sanitizeGemmaPlainText(rawWord || fallbackWord).slice(0, GEMMA_NOTE_COLS);
  const detail = sanitizeGemmaPlainText(rawDetailParts.join("||") || fallbackDetail);

  return { word, detail };
}

function pickPatternType(prompt: string): GemmaPatternType {
  if (/\bflag\b/i.test(prompt)) return "flag";
  if (/\bzig[\s-]*zag\b/i.test(prompt)) return "zigzag";
  if (/\bchecker|checkerboard\b/i.test(prompt)) return "checker";
  if (/\bstripe|stripes\b/i.test(prompt)) return "stripes";
  return "diagonal";
}

function extractPaletteFromPrompt(prompt: string) {
  const matches = Array.from(prompt.toLowerCase().matchAll(/\b(red|orange|yellow|green|blue|purple|violet|white)\b/g));
  return Array.from(new Set(matches.map((match) => PROMPT_COLOR_MAP[match[1]]))).filter(Boolean).slice(0, 3);
}

function parsePaletteResponse(rawResponse: string) {
  return Array.from(new Set((rawResponse.toUpperCase().match(/[ROYGBPW]/g) ?? []).filter((token) => BOARD_COLOR_TOKENS[token] !== undefined))).slice(0, 3);
}

function selectGemmaWordEntry(prompt: string) {
  const now = new Date();
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - startOfYear) / 86400000);
  const promptHash = Array.from(prompt.toUpperCase()).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const entry = GEMMA_WORD_BANK[(dayOfYear + promptHash) % GEMMA_WORD_BANK.length];
  const wantsSynonyms = /\bsynonym/i.test(prompt);

  return {
    word: entry.word,
    detail: wantsSynonyms ? entry.synonyms : entry.definition,
  };
}

async function chooseGemmaPatternPalette(prompt: string) {
  const explicitPalette = extractPaletteFromPrompt(prompt);
  if (explicitPalette.length >= 2) {
    return explicitPalette;
  }

  const rawResponse = await generateGemmaText(buildGemmaPatternPalettePrompt(prompt), {
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 12,
    },
  });
  const palette = parsePaletteResponse(rawResponse);
  return palette.length >= 2 ? palette : ["R", "W", "B"];
}

function buildPatternCodes(patternType: GemmaPatternType, palette: string[]) {
  const resolvedPalette = palette
    .map((token) => BOARD_COLOR_TOKENS[token])
    .filter((code): code is number => code !== undefined);
  const usablePalette = resolvedPalette.length > 0 ? resolvedPalette : [BOARD_COLOR_TOKENS.B, BOARD_COLOR_TOKENS.W];
  const codes: number[] = [];

  for (let row = 0; row < GEMMA_NOTE_ROWS; row++) {
    for (let col = 0; col < GEMMA_NOTE_COLS; col++) {
      let paletteIndex = 0;

      switch (patternType) {
        case "flag":
          paletteIndex = row % usablePalette.length;
          break;
        case "zigzag":
          paletteIndex = (col + (row % usablePalette.length)) % usablePalette.length;
          break;
        case "checker":
          paletteIndex = (row + col) % usablePalette.length;
          break;
        case "stripes":
          paletteIndex = Math.floor((col * usablePalette.length) / GEMMA_NOTE_COLS) % usablePalette.length;
          break;
        case "diagonal":
        default:
          paletteIndex = (row + col) % usablePalette.length;
          break;
      }

      codes.push(usablePalette[paletteIndex]);
    }
  }

  return codes;
}

async function shortenGemmaText(prompt: string, contentText: string) {
  const response = await generateGemmaText(buildGemmaShortenPrompt(prompt, contentText), {
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 64,
    },
  });
  return sanitizeGemmaPlainText(response);
}

async function fitGemmaTextToNote(prompt: string, initialText: string) {
  let contentText = sanitizeGemmaPlainText(initialText);

  for (let attempt = 0; attempt < 3; attempt++) {
    const fitted = fitTextToBoard(contentText, "note", { alignment: "center" });
    if (!fitted.truncated) {
      return { contentText, fitted };
    }

    logGemmaStage("shorten-request", {
      prompt,
      attempt,
      contentText,
      wrappedRows: fitted.wrappedRows,
    });

    const shortened = await shortenGemmaText(prompt, contentText);
    if (!shortened || shortened === contentText) {
      break;
    }

    contentText = shortened;
  }

  const fitted = fitTextToBoard(contentText, "note", { alignment: "center" });
  return { contentText, fitted };
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
    tempDeg: String(celsius),
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
  if (lines.length < 2) throw new Error(`No stock data returned for ${symbol}`);
  const header = lines[0].split(",");
  const values = lines[1].split(",");
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
    timezone: sanitizeBoardText(timezone),
    timezoneLabel: sanitizeBoardText(timezone.split("/").pop()?.replace(/_/g, " ") || timezone),
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
  const scenario = classifyGemmaScenario(prompt);
  logGemmaStage("scenario", { prompt, scenario, model: GEMMA_MODEL });

  if (scenario === "pattern") {
    const patternType = pickPatternType(prompt);
    const palette = await chooseGemmaPatternPalette(prompt);
    const renderedMatrix = directCodesToMatrix(buildPatternCodes(patternType, palette), GEMMA_NOTE_ROWS, GEMMA_NOTE_COLS);
    const response = matrixToSequentialTokens(renderedMatrix);

    logGemmaStage("compose", {
      scenario,
      patternType,
      palette,
      response,
      cellCount: parseSequentialBoardTokens(response).codes.length,
    });

    return {
      response,
      prompt: sanitizeBoardText(prompt),
      model: sanitizeBoardText(GEMMA_MODEL),
      scenario: sanitizeBoardText(scenario),
      content: sanitizeBoardText(`${patternType} ${palette.join(" ")}`),
    };
  }

  if (scenario === "word") {
    const { word, detail } = selectGemmaWordEntry(prompt);
    const fitted = fitTextToBoard(`${word}\n${detail}`, "note", { alignment: "center" });
    const response = matrixToSequentialTokens(fitted.matrix);

    logGemmaStage("content", { scenario, word, detail, source: "word-bank" });
    logGemmaStage("compose", {
      scenario,
      word,
      detail,
      wrappedRows: fitted.wrappedRows,
      response,
    });

    return {
      response,
      prompt: sanitizeBoardText(prompt),
      model: sanitizeBoardText(GEMMA_MODEL),
      scenario: sanitizeBoardText(scenario),
      content: sanitizeBoardText(`${word} ${detail}`),
    };
  }

  const contentPrompt = buildGemmaPhrasePrompt(prompt);
  const rawContent = await generateGemmaText(contentPrompt, {
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 80,
    },
  });
  logGemmaStage("content", { scenario, rawContent });

  const initialContent = sanitizeGemmaPlainText(rawContent);
  if (!initialContent) {
    throw new Error(`Gemma phrase pass returned empty output. Raw response: ${formatGemmaDebugResponse(rawContent)}`);
  }

  const { contentText, fitted } = await fitGemmaTextToNote(prompt, initialContent);
  const response = matrixToSequentialTokens(fitted.matrix);
  logGemmaStage("compose", {
    scenario,
    contentText,
    wrappedRows: fitted.wrappedRows,
    response,
  });

  return {
    response,
    prompt: sanitizeBoardText(prompt),
    model: sanitizeBoardText(GEMMA_MODEL),
    scenario: sanitizeBoardText(scenario),
    content: contentText,
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

function buildStandardWorkflowPreview(
  messageText: string,
  variables: Record<string, string>,
  providerId: WorkflowDataSource["providerId"] | undefined,
  alignment: TextAlignment | undefined,
) {
  const raw = renderTemplate(messageText, variables);
  const formatted = fitTextToBoard(raw, "flagship", {
    alignment: alignment ?? "center",
    hyphenateOverflowWords: providerId === "gemma",
  });

  if (!formatted.renderedText.trim()) {
    throw new Error("Rendered workflow output is empty");
  }

  const validation = validateMessageText(formatted.renderedText, "flagship");
  if (!validation.valid) {
    throw new Error(validation.error ?? "Rendered workflow output is invalid");
  }

  return {
    boardModel: "flagship" as BoardModel,
    renderedMatrix: formatted.matrix,
    renderedText: validation.normalizedText,
  };
}

function buildGemmaWorkflowPreview(variables: Record<string, string>) {
  const profile = BOARD_PROFILES.note;
  const directBoardText = variables.response ?? "";
  const parsed = parseSequentialBoardTokens(directBoardText);
  if (parsed.codes.length !== profile.rows * profile.cols) {
    throw new Error(
      `Gemma response must contain exactly ${profile.rows * profile.cols} board cells. Raw response: ${formatGemmaDebugResponse(directBoardText)}`,
    );
  }

  const renderedMatrix = directCodesToMatrix(parsed.codes, profile.rows, profile.cols);
  const renderedText = matrixToPlainText(renderedMatrix) || variables.content || parsed.normalized;

  return {
    boardModel: "note" as BoardModel,
    renderedMatrix,
    renderedText,
  };
}

export async function buildWorkflowPreview(
  messageText: string,
  dataSource?: WorkflowDataSource | null,
  options: { alignment?: TextAlignment } = {},
): Promise<WorkflowPreviewResponse> {
  const definition = dataSource ? getWorkflowIntegrationDefinition(dataSource.providerId) : undefined;
  const variables = dataSource ? await resolveWorkflowDataSource(dataSource) : {};
  const preview = dataSource?.providerId === "gemma"
    ? buildGemmaWorkflowPreview(variables)
    : buildStandardWorkflowPreview(
        dataSource ? messageText : sanitizeBoardText(messageText, { preserveNewlines: true }),
        variables,
        dataSource?.providerId,
        options.alignment,
      );

  return {
    boardModel: preview.boardModel,
    renderedText: preview.renderedText,
    renderedMatrix: preview.renderedMatrix,
    variables,
    providerLabel: definition?.label,
  };
}
