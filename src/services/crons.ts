import cron from "node-cron";
import { fetchAddresses, subscribe } from "./listener";
import { scrapePortfolio, scrapeTokens } from "./scraper";
import { recomputePortfolio } from "./portfolio";
import {
  RECOMPUTE_PORTFOLIO_FREQUENCY,
  REFETCH_WALLETS_FREQUENCY,
  SCRAPE_PORTFOLIOS_FREQUENCY,
  SCRAPE_TOKENS_FREQUENCY,
} from "../constants";

/**
 * Schedules a cron job to scrape portfolios of new wallets.
 * The job runs based on the SCRAPE_PORTFOLIOS_FREQUENCY variable.
 */
export const scrapePortfolios = cron.schedule(
  `0 */${SCRAPE_PORTFOLIOS_FREQUENCY} * * *`,
  async () => {
    try {
      console.log("Scraping portfolios of new wallets...");

      // Scrape portfolios of wallets
      await scrapePortfolio();
    } catch (error) {
      console.log("Error on scrapePortfolios cron job: ", error);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

/**
 * Schedules a cron job to scrape new tokens from spot positions
 * The job runs  based on the SCRAPE_TOKENS_FREQUENCY variable.
 */
export const scrapeNewTokens = cron.schedule(
  `*/${SCRAPE_TOKENS_FREQUENCY} * * * *`,
  async () => {
    try {
      console.log("Scraping new tokens...");
      await scrapeTokens();
    } catch (error) {
      console.log("Error on scrapeNewTokens cron job: ", error);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

/**
 * Schedules a cron job to refresh wallets to track.
 * The job runs based on the REFETCH_WALLETS_TO_TRACK variable.
 */
export const refreshWalletsToTrack = cron.schedule(
  `*/${REFETCH_WALLETS_FREQUENCY} * * * *`,
  async () => {
    try {
      console.log("Refreshing tacking wallets...");
      await fetchAddresses();
    } catch (error) {
      console.log("Error on refreshWalletsToTrack cron job: ", error);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

/**
 * Schedules a cron job to update portfolios every 5 minutes.
 * This function uses the `cron` library to schedule periodic execution of the
 * `recomputePortfolio` function, ensuring the portfolios are updated regularly.
 */
export const updatePortfolios = cron.schedule(
  `*/${RECOMPUTE_PORTFOLIO_FREQUENCY} * * * * *`,
  async () => {
    try {
      console.log("Updating portfolios");
      await recomputePortfolio();
    } catch (error) {
      console.log("Error on updatePortfolios cron job: ", error);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);
