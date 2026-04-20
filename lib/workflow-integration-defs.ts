import type { WorkflowDataSourceProviderId, WorkflowIntegrationDefinition } from "@/types";

export const WORKFLOW_INTEGRATIONS: WorkflowIntegrationDefinition[] = [
  {
    id: "weather",
    label: "Weather",
    description: "Current conditions using Open-Meteo public weather data.",
    category: "utility",
    priority: "public",
    defaultTemplate: "WEATHER IN {location} TEMP:{tempDeg}C {conditionIconSymbol}",
    availableVariables: ["location", "tempDeg", "tempDegF", "condition", "conditionIconSymbol", "windKph"],
    fields: [
      { key: "location", label: "Location", placeholder: "Los Angeles, CA", defaultValue: "Los Angeles" },
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    description: "CoinGecko market pricing for major crypto assets.",
    category: "finance",
    priority: "public",
    defaultTemplate: "{assetName} {price} {currency} ({change24hPct}%)",
    availableVariables: ["assetName", "assetId", "currency", "price", "change24hPct"],
    fields: [
      { key: "assetId", label: "Asset ID", placeholder: "bitcoin", defaultValue: "bitcoin", helpText: "CoinGecko asset id" },
      { key: "currency", label: "Currency", placeholder: "usd", defaultValue: "usd" },
    ],
  },
  {
    id: "stocks",
    label: "Stocks",
    description: "Public stock quote data via Stooq.",
    category: "finance",
    priority: "public",
    defaultTemplate: "{symbol} {close} O:{open} H:{high} L:{low}",
    availableVariables: ["symbol", "date", "time", "open", "high", "low", "close", "volume"],
    fields: [
      { key: "symbol", label: "Symbol", placeholder: "aapl.us", defaultValue: "aapl.us" },
    ],
  },
  {
    id: "news",
    label: "News",
    description: "Headline search using Hacker News Algolia public search.",
    category: "news",
    priority: "public",
    defaultTemplate: "NEWS {headline}",
    availableVariables: ["query", "headline", "author", "points", "url"],
    fields: [
      { key: "query", label: "Search Query", placeholder: "weather", defaultValue: "weather" },
    ],
  },
  {
    id: "quote",
    label: "Quote",
    description: "Random quote using DummyJSON public API.",
    category: "content",
    priority: "public",
    defaultTemplate: "{quote} - {author}",
    availableVariables: ["quote", "author"],
    fields: [],
  },
  {
    id: "exchange-rates",
    label: "Exchange Rates",
    description: "FX pricing using Frankfurter public exchange rates.",
    category: "finance",
    priority: "public",
    defaultTemplate: "1 {base} = {rate} {target}",
    availableVariables: ["base", "target", "rate", "date"],
    fields: [
      { key: "base", label: "Base Currency", placeholder: "USD", defaultValue: "USD" },
      { key: "target", label: "Target Currency", placeholder: "EUR", defaultValue: "EUR" },
    ],
  },
  {
    id: "time",
    label: "Time",
    description: "Formatted date and time for any timezone.",
    category: "system",
    priority: "public",
    defaultTemplate: "{timezoneLabel} {time} {date}",
    availableVariables: ["timezone", "timezoneLabel", "time", "date"],
    fields: [
      { key: "timezone", label: "Timezone", placeholder: "America/Los_Angeles", defaultValue: "America/Los_Angeles" },
    ],
  },
  {
    id: "joke",
    label: "Joke",
    description: "Official Joke API random programming/general jokes.",
    category: "content",
    priority: "public",
    defaultTemplate: "{setup} {punchline}",
    availableVariables: ["type", "setup", "punchline"],
    fields: [],
  },
];

export function getWorkflowIntegrationDefinition(id: WorkflowDataSourceProviderId) {
  return WORKFLOW_INTEGRATIONS.find((item) => item.id === id);
}
