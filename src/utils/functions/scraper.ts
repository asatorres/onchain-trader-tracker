import axios from "axios";
import {
  BITQUERY_API_KEY,
  BITQUERY_API_TOKEN,
  BITQUERY_API_URL,
  CHAIN,
} from "../../constants";
import { SQL_SPOT, SQL_USERS_WALLETS } from "../../constants/tables";
import { sqlBatchQuery, sqlQuery } from "../database";

/**
 * Fetches new trader addresses from the database.
 * This function retrieves addresses from a specific user wallet table that do not exist in the spot table
 * for a given chain, filtering out certain trader types.
 *
 * @returns {Promise<string[]>} - A promise that resolves to an array of new trader addresses.
 */
export async function getNewAddresses(limit: string | null = null) {
  try {
    // Execute SQL query to fetch new addresses
    const r = await sqlQuery(
      `
        SELECT address
        FROM ${SQL_USERS_WALLETS} 
        WHERE trader_type != 3 
        AND is_scraped_${CHAIN} = 0
        AND type = '${CHAIN == "sol" ? "sol" : "evm"}'
        ${limit ? `LIMIT ${limit}` : ``}
    `
    );

    // Map and return the addresses from the query result
    return r.map((data: any) => data.address);
  } catch (error) {
    console.log(`Error on getNewAddresses: `, error);
    return [];
  }
}

/**
 * Fetches portfolio data for specified trader addresses using Bitquery.
 * This function constructs a GraphQL query to fetch portfolio data, including buy and sell amounts
 * and values, for the given trader addresses on a specified network.
 *
 * @param {string[]} traderAddresses - An array of trader addresses to fetch the portfolio for.
 * @param {string} [network="eth"] - The blockchain network to query. Default is "eth".
 * @returns {Promise<any>} - A promise that resolves with the portfolio data.
 * @throws {Error} - Logs an error message if any error occurs during the fetching of portfolio data.
 */
export async function getPortfolio(
  traderAddresses: string[],
  network: string = "eth"
) {
  try {
    // Convert trader addresses array to a comma-separated string
    const addressesString = traderAddresses
      .map((address) => `"${address}"`)
      .join(", ");

    // Construct the GraphQL query
    let evm_query = `
      query EVMPortfolio {
        EVM(dataset: combined, network: ${network}) {
          BalanceUpdates(
            where: {
              Currency: {ProtocolName: {is: "erc20"}},
              BalanceUpdate: {
                Address: {in: [${addressesString}]},  Amount: {ne: "0"}
              }
            }
          ) {
            buy_amount: sum(
              of: BalanceUpdate_Amount,
              if: {BalanceUpdate: {Amount: {ge: "0"}}}
            )
            buy_value: sum(
              of: BalanceUpdate_AmountInUSD, 
              if: {BalanceUpdate: {Amount: {ge: "0"}}}
            )
            sell_amount: sum(
              of: BalanceUpdate_Amount, 
              if: {BalanceUpdate: {Amount: {le: "0"}}}
            )
            sell_value: sum(
              of: BalanceUpdate_AmountInUSD, 
              if: {BalanceUpdate: {Amount: {le: "0"}}}
            )
            Currency {
              Name
              SmartContract
            }
            ChainId
            BalanceUpdate {
              Address
            }
            Block {
              Time(minimum: Block_Time)
            }
          }
        }
      }
    `;

    let sol_query = `
      query SolanaPortfolio {
        Solana {
          BalanceUpdates(
            where: {any: [{BalanceUpdate: {Type: {in: Transaction}, Account: {Address: {in: [${addressesString}]}}, Amount: {ne: "0"}}}]}
          ) {
            buy_amount: sum(
              of: BalanceUpdate_Amount
              if: {BalanceUpdate: {Amount: {ge: "0"}}}
            )
            buy_value: sum(
              of: BalanceUpdate_AmountInUSD
              if: {BalanceUpdate: {Amount: {ge: "0"}}}
            )
            sell_amount: sum(
              of: BalanceUpdate_Amount
              if: {BalanceUpdate: {Amount: {le: "0"}}}
            )
            sell_value: sum(
              of: BalanceUpdate_AmountInUSD
              if: {BalanceUpdate: {Amount: {le: "0"}}}
            )
            ChainId
            Block {
              Time(minimum: Block_Time)
            }
            BalanceUpdate {
              Account {
                Address
              }
              Currency {
                MintAddress
                Name
              }
            }
          }
        }
      }
    `;

    // Send the request and return the response data
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: BITQUERY_API_URL,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": BITQUERY_API_KEY,
        Authorization: `Bearer ${BITQUERY_API_TOKEN}`,
      },
      data: {
        query: network == "solana" ? sol_query : evm_query,
        variables: {},
      },
    };
    const r = await axios.request(config);
    return network == "solana"
      ? r.data.data.Solana.BalanceUpdates
      : r.data.data.EVM.BalanceUpdates;
  } catch (error) {
    console.log(`Error on getPortfolio: `, error);
  }
}

/**
 * Inserts portfolio data into the database.
 * This function inserts processed portfolio data into a specified SQL table using a batch query.
 *
 * @param {any[]} positions - An array of positions to be inserted. Each position is an array of values corresponding to the columns in the SQL table.
 * @returns {Promise<void>} - A promise that resolves when the data has been successfully inserted.
 */
export async function insertPortfolio(positions: any[]) {
  const tempTableName = "temp_portfolio_updates";

  // Step 1: Create the temporary table
  await sqlQuery(`
    CREATE TEMPORARY TABLE IF NOT EXISTS ${tempTableName} (
      address VARCHAR(100),
      token VARCHAR(100),
      chain VARCHAR(20),
      buy_amount DECIMAL(48, 0),
      buy_amount_usd DECIMAL(48, 0),
      sell_amount DECIMAL(48, 0),
      sell_amount_usd DECIMAL(48, 0),
      start_date TIMESTAMP,
      PRIMARY KEY (address, token, chain)
    );
  `);

  // Step 2: Insert data into the temporary table
  await sqlBatchQuery(
    `INSERT IGNORE INTO ${tempTableName} 
        (address, token, chain, buy_amount, buy_amount_usd, sell_amount, sell_amount_usd, start_date) 
        VALUES ?`,
    positions
  );

  // Step 3: Add user to table
  let userJoinQuery = `
    SELECT T_1.*, T_2.user
    FROM ${tempTableName} as T_1
    JOIN ${SQL_USERS_WALLETS} as T_2
    ON T_1.address = T_2.address
  `;

  // Step 4: Use a LEFT JOIN to include the "user" value and insert or update the SQL_SPOT table
  await sqlQuery(`
    INSERT INTO ${SQL_SPOT} (address, token, chain, buy_amount, buy_amount_usd, sell_amount, sell_amount_usd, start_date, user)
    SELECT * FROM (${userJoinQuery}) AS T
    ON DUPLICATE KEY UPDATE
      buy_amount = VALUES(buy_amount),
      buy_amount_usd = VALUES(buy_amount_usd),
      sell_amount = VALUES(sell_amount),
      sell_amount_usd = VALUES(sell_amount_usd),
      user = VALUES(user),
      timestamp = VALUES(timestamp)
  `);

  // Step 4: Cleanup temporary table
  await sqlQuery(`DROP TEMPORARY TABLE IF EXISTS ${tempTableName}`);
}
