import dotenv from "dotenv";
dotenv.config();

// Moralis
export const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

// Bitquery config
export const BITQUERY_API_URL = process.env.BIQUERY_API_URL;
export const BITQUERY_WS_URL = process.env.BITQUERY_WS_URL;
export const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;
export const BITQUERY_API_TOKEN = process.env.BITQUERY_API_TOKEN;

// Update interval
export const UDPATE_INTERVAL = 5000; // Update new positions
export const RECOMPUTE_PORTFOLIO_FREQUENCY = 120; // Update portfolios in seconds
export const REFETCH_WALLETS_FREQUENCY = 15; // Refreshes the wallets to listen (in minutes)
export const SCRAPE_PORTFOLIOS_FREQUENCY = 12; // Scrape portfolio of wallets (in hours)
export const SCRAPE_TOKENS_FREQUENCY = 3; // Scrape new tokens (in minutes)
export const RATE_LIMIT_TOKENS = 30;

export const MAX_ADDRESSES = process.env.MAX_ADDRESSES_BITQUERY; // The max number of addresses to scrape on a single request -> eth 350, base 700, arb 1000
export const MAX_ITERATIONS = 20; // Max iterations for scraping positions

// Precission
export const AMOUNT_DECIMALS = 6;
export const PRICE_DECIMALS = 18;

// List of chains supported
export const CHAIN = process.env.CHAIN as string;
export const CHAIN_MAP: { [key: string]: string } = {
  ["1"]: "ethereum",
  ["8453"]: "base",
  ["42161"]: "arbitrum-one",
  ["sol"]: "solana",
};
export const CHAIN_MAP_BITQUERY: { [key: string]: string } = {
  ["1"]: "eth",
  ["8453"]: "base",
  ["42161"]: "arbitrum",
  ["sol"]: "solana",
};

// Scraper
export const COINGECKO_API = "https://api.coingecko.com/api";
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
