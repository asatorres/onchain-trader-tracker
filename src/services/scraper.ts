import {
  AMOUNT_DECIMALS,
  CHAIN,
  CHAIN_MAP,
  CHAIN_MAP_BITQUERY,
  MAX_ADDRESSES,
  MAX_ITERATIONS,
} from "../constants";
import { convertToDecimal } from "../utils/functions";
import { getAddress } from "ethers/lib/utils";
import {
  getNewAddresses,
  getPortfolio,
  insertPortfolio,
} from "../utils/functions/scraper";
import {
  getNewTokens,
  getTokenMetadata,
  getTokenMetadataCg,
  insertSpotTokens,
  loadTokenCategories,
} from "../utils/functions/tokens";
import { convertToSqlDate, sqlQuery } from "../utils/database";
import { SQL_USERS_WALLETS } from "../constants/tables";

/**
 * Scrapes and processes the portfolio data for specified trader addresses using Bitquery.
 * This function fetches the portfolio data for a given user on a specified network,
 * processes the buying and selling amounts, calculates average prices, and computes PnLs.
 *
 * @returns {Promise<void>} - A promise that resolves when the portfolio data has been successfully scraped and inserted.
 * @throws {Error} - Logs an error message if any error occurs during the scraping or processing of the portfolio data.
 */
export async function scrapePortfolio() {
  try {
    // Fetch the portfolio data using Bitquery
    let iterations = 0;
    while (true && iterations < MAX_ITERATIONS) {
      const traderAddresses = await getNewAddresses(MAX_ADDRESSES);
      if (traderAddresses.length < 1) break;

      // Convert trader addresses array to a comma-separated string
      const portfolio = await getPortfolio(
        traderAddresses,
        CHAIN_MAP_BITQUERY[CHAIN]
      );

      console.log(portfolio.length);
      let POSITIONS: any[] = [];
      if (portfolio.length < 1) return;

      // Iterate over each position in the portfolio
      for (const position of portfolio) {
        let tokenAddress =
          CHAIN == "sol"
            ? position.BalanceUpdate.Currency.MintAddress
            : position.Currency.SmartContract == "0x"
            ? position.Currency.SmartContract
            : getAddress(position.Currency.SmartContract);
        let traderAddress =
          CHAIN == "sol"
            ? position.BalanceUpdate.Account.Address
            : getAddress(position.BalanceUpdate.Address);
        let chain = CHAIN == "sol" ? "sol" : position.ChainId;

        if (tokenAddress == "0x") continue;
        if (position.buy_amount == 0) continue;
        if (position.buy_value == 0 && position.sell_value == 0) continue;
        POSITIONS.push([
          traderAddress,
          tokenAddress,
          chain,
          await convertToDecimal(position.buy_amount, AMOUNT_DECIMALS),
          await convertToDecimal(position.buy_value, AMOUNT_DECIMALS),
          await convertToDecimal(position.sell_amount, AMOUNT_DECIMALS),
          await convertToDecimal(position.sell_value, AMOUNT_DECIMALS),
          await convertToSqlDate(position.Block.Time),
        ]);
      }

      // Insert the processed portfolio data into the database
      console.log(POSITIONS.length);
      await insertPortfolio(POSITIONS);

      // Mark addresses as scraped
      const addressesString = traderAddresses
        .map((address: any) => `'${address}'`)
        .join(", ");
      await sqlQuery(
        `UPDATE ${SQL_USERS_WALLETS} SET is_scraped_${CHAIN}=1 WHERE address IN (${addressesString})`
      );
      console.log("New Positions scraped!");
      ++iterations;
      console.log(iterations);
    }
  } catch (error) {
    console.log(`Error on function scrapePortfolio: `, error);
  }
}

/**
 * Scrapes metadata for new tokens on a specified blockchain and inserts them into the database.
 * This function fetches a list of new token addresses that are not yet present in the spot tokens database table,
 * retrieves their metadata, formats the data, and inserts it into the database.
 *
 * @param {number} [chain=1] - The chain ID of the blockchain to query. Defaults to 1 (Ethereum mainnet).
 */
export async function scrapeTokens(chain: string = CHAIN) {
  try {
    const tokenAddresses = await getNewTokens(chain);
    if (tokenAddresses.length < 1) return;

    let tokenCategories = await loadTokenCategories();
    for (const tokenAddress of tokenAddresses)
      await getTokenMetadataCg(tokenAddress, CHAIN, tokenCategories);

    console.log("TOKENS SCRAPED");
  } catch (error) {
    console.log(`Error on scrapeToken: `, error);
  }
}
