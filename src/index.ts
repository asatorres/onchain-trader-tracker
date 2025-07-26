import {
  refreshWalletsToTrack,
  scrapeNewTokens,
  scrapePortfolios,
  updatePortfolios,
} from "./services/crons";
import { initWebSocketBitquery } from "./services/listener";
import { recomputePortfolio } from "./services/portfolio";
import { scrapePortfolio, scrapeTokens } from "./services/scraper";
import { getAddressesToTrack } from "./utils/functions/listener";
import { getNewAddresses, getPortfolio } from "./utils/functions/scraper";

// Main function to start the application
const startApp = async () => {
  // console.log(await scrapePortfolio());
  await scrapeTokens();
  return;
  // await scrapePortfolio();
  // console.log(await getAddressesToTrack());
  // console.log(
  //   await getPortfolio(["FTAG3PsWqVzipUxgKS8dWEL14nXYAp4yjQ3M4cX3fKSK"], "sol")
  // );
  // return;
  await initWebSocketBitquery();
  // Start cron jobs
  scrapePortfolios.start();
  scrapeNewTokens.start();
  refreshWalletsToTrack.start();
  updatePortfolios.start();
};

startApp();
