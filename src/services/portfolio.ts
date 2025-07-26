import { CHAIN } from "../constants";
import {
  SQL_SPOT,
  SQL_SPOT_TRANSFERS,
  SQL_USERS_WALLETS,
} from "../constants/tables";
import { getSqlDate, sqlQuery } from "../utils/database";

let isUpdating = false;

/**
 * Recomputes the portfolios of different tracked addresses by aggregating the latest transfers
 * and computing the dollar equivalent. This function updates the portfolio data with the latest
 * buy and sell amounts and their USD equivalents, then marks the processed transfers.
 *
 * FIRST: it inserts new holdings from TRACKED wallets.
 * SECOND: it updates the spot balances with the new transfers.
 *
 * @returns {Promise<void>} - A promise that resolves when the portfolios have been successfully recomputed.
 */
export async function recomputePortfolio() {
  try {
    // Prevent multiple simultaneous updates
    if (isUpdating) return;
    isUpdating = true;

    // Insert new holdings from tracked wallets
    let query = `
      SELECT DISTINCT S_1.address, S_1.token, S_1.chain
      FROM ${SQL_SPOT_TRANSFERS} as S_1
      LEFT JOIN ${SQL_SPOT} as S_2
      ON S_1.address = S_2.address AND 
        S_1.token = S_2.token AND 
        S_1.chain = S_2.chain
      WHERE S_2.id IS NULL
    `;

    query = `
      SELECT user, SS_1.*, NULL as timestamp
      FROM (${query}) as SS_1
      JOIN ${SQL_USERS_WALLETS} as SS_2
      ON SS_1.address = SS_2.address
      AND is_scraped_${CHAIN}=1
    `;

    await sqlQuery(
      `INSERT IGNORE INTO ${SQL_SPOT} (user, address, token, chain, timestamp) ${query}`
    );

    // Construct SQL query to aggregate unprocessed transfers by user position
    let new_amount_buy =
      "SUM(CASE WHEN T_2.amount > 0 AND T_2.timestamp > T_1.timestamp THEN amount ELSE 0 END)";
    let new_amount_buy_usd =
      "SUM(CASE WHEN amount > 0 AND T_2.timestamp > T_1.timestamp THEN amount_usd ELSE 0 END)";
    let new_amount_sell =
      "SUM(CASE WHEN amount < 0 AND T_2.timestamp > T_1.timestamp THEN amount ELSE 0 END) ";
    let new_amount_sell_user =
      "SUM(CASE WHEN amount < 0 AND T_2.timestamp > T_1.timestamp THEN amount_usd ELSE 0 END)";

    // This query filters the unprocessed transfer checking the last balance update
    let table = `
      SELECT T_1.id,
             buy_amount + ${new_amount_buy} AS amount_buy,
             buy_amount_usd + ${new_amount_buy_usd} AS amount_buy_usd,
             sell_amount + ${new_amount_sell} AS amount_sell,
             sell_amount_usd + ${new_amount_sell_user} AS amount_sell_usd,
             MAX(T_2.timestamp) as timestamp
      FROM ${SQL_SPOT} as T_1
      LEFT JOIN ${SQL_SPOT_TRANSFERS} as T_2
      ON T_1.address = T_2.address AND 
         T_1.token = T_2.token AND 
         T_1.chain = T_2.chain
      WHERE T_2.timestamp >= T_1.timestamp
      GROUP BY T_1.id
    `;

    // Update the positions values and the last balance update date
    await sqlQuery(`
      UPDATE ${SQL_SPOT} as U_1
      JOIN (${table}) as U_2
      ON U_1.id = U_2.id
      SET buy_amount = amount_buy,
          buy_amount_usd = amount_buy_usd,
          sell_amount = amount_sell,
          sell_amount_usd = amount_sell_usd,
          U_1.timestamp = U_2.timestamp
    `);

    // // Mark the processed transfers as processed in the SQL_SPOT_TRANSFERS table
    // await sqlQuery(`
    //   UPDATE ${SQL_SPOT_TRANSFERS}
    //   SET is_processed=1
    //   WHERE is_processed=0 AND timestamp <= '${timestamp}'
    // `);

    console.log("Portfolios recomputed successfully!");
  } catch (error) {
    console.log(`Error on recomputePortfolio: `, error);
  } finally {
    // Ensure isUpdating is reset to false regardless of success or failure
    isUpdating = false;
  }
}
