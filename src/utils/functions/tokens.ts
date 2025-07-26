import Moralis from "moralis";
import {
  CHAIN,
  CHAIN_MAP,
  COINGECKO_API,
  COINGECKO_API_KEY,
  MORALIS_API_KEY,
  RATE_LIMIT_TOKENS,
} from "../../constants";
import { getSqlDate, sqlBatchQuery, sqlQuery } from "../database";
import {
  SQL_SPOT,
  SQL_SPOT_TOKENS,
  SQL_TOKENS,
  SQL_TOKENS_CATEGORIES,
  SQL_TOKENS_CATEGORY_LIST,
} from "../../constants/tables";
import axios from "axios";
import { parseTokenPrice } from "../functions";

// Initialize Moralis
Moralis.start({
  apiKey: MORALIS_API_KEY,
});

const CATEGORY_MAP: { [key: string]: number } = {};

/**
 * Retrieves the list of token categories from the database and
 * maps category names to their IDs.
 *
 * @returns {Promise<{[key: string]: number}>} - A promise that resolves to an object mapping category names to their IDs.
 */
export async function loadTokenCategories() {
  try {
    // Query to select id and category_name from the tokens category list
    const result = await sqlQuery(
      `SELECT id, category_name FROM ${SQL_TOKENS_CATEGORY_LIST}`
    );

    // Populate the CATEGORY_MAP with category_name as key and id as value
    for (const r of result) {
      CATEGORY_MAP[r?.category_name] = r.id;
    }

    return CATEGORY_MAP;
  } catch (error) {
    console.log("Error on loadTokenCategories: ", error);
  }
}

/**
 * Retrieves new tokens that are not yet present in the spot tokens database table
 *  for a specified blockchain.
 *
 * @param {number} [chain=CHAIN] - The chain ID of the blockchain to query.
 */
export async function getNewTokens(
  chain: string = CHAIN,
  limit = RATE_LIMIT_TOKENS
) {
  try {
    const result = await sqlQuery(
      `SELECT token 
       FROM ${SQL_SPOT} as T_1
       LEFT JOIN ${SQL_SPOT_TOKENS} as T_2
       ON T_1.token = T_2.address
       WHERE T_2.address IS NULL AND 
             T_1.chain=? AND 
             T_1.token != '0x'
       LIMIT ${limit}`,
      [chain]
    );

    const addresses = result.map((item: any) => item.token);
    return addresses;
  } catch (error) {
    console.error("Error on getNewTokens:", error);
    return [];
  }
}

/**
 * Retrieves metadata for a list of token addresses from a specified blockchain using the Moralis API.
 * This function initializes the Moralis API with the provided API key, fetches the token metadata for the given
 * token addresses and blockchain, and returns the metadata in JSON format.
 *
 * @param {string[]} tokenAddresses - An array of token addresses to fetch metadata for.
 * @param {number} [chain=CHAIN] - The chain ID of the blockchain to query.
 */
export async function getTokenMetadata(
  tokenAddresses: string[],
  chain: string = CHAIN
) {
  try {
    // Fetch token metadata from Moralis API
    const response = await Moralis.EvmApi.token.getTokenMetadata({
      addresses: tokenAddresses,
      chain: chain,
    });

    return response.toJSON();
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    throw error;
  }
}

/**
 * Fetches token metadata from CoinGecko and updates the database with the token information.
 *
 * @param {string} tokenAddress - The contract address of the token.
 * @param {string} [chain=CHAIN] - The blockchain network the token is on.
 * @param {Object} CATEGORY_MAP - An object mapping category names to their IDs.
 * @returns {Promise<any>} - A promise that resolves to the CoinGecko API response data.
 */
export async function getTokenMetadataCg(
  tokenAddress: string,
  chain: string = CHAIN,
  CATEGORY_MAP: any
) {
  try {
    // Make CoinGecko API call to get token information
    const response = await axios.request({
      method: "GET",
      url: `${COINGECKO_API}/v3/coins/${CHAIN_MAP[chain]}/contract/${tokenAddress}`,
      headers: {
        accept: "application/json",
        "x-cg-demo-api-key": COINGECKO_API_KEY,
      },
    });
    let r = response.data;

    // Check if the token is already registered in the system
    const s = await sqlQuery(
      `SELECT id FROM ${SQL_TOKENS} WHERE coingecko_id=?`,
      [r.id]
    );
    if (s.length < 1) await registerToken(r, CATEGORY_MAP);

    // Mark token as scraped and update with CoinGecko ID
    await sqlQuery(
      `INSERT IGNORE INTO ${SQL_SPOT_TOKENS} (address, chain, coingecko_id) VALUES (?, ?, ?)`,
      [tokenAddress, chain, r.id]
    );

    console.log("Scraped token... ", r.id, tokenAddress);
    return response;
  } catch (error) {
    await sqlQuery(
      `INSERT IGNORE INTO ${SQL_SPOT_TOKENS} (address, chain, coingecko_id) VALUES (?, ?, ?)`,
      [tokenAddress, chain, null]
    );
    console.error("Error fetching token metadata: ", error);
  }
}

/**
 * Inserts token data into the spot tokens database table.
 * This function executes a batch SQL query to insert multiple token records into the database.
 *
 * @param {any[]} tokens - An array of token data to be inserted.
 */
export async function insertSpotTokens(tokens: any[]) {
  await sqlBatchQuery(
    `INSERT IGNORE INTO ${SQL_SPOT_TOKENS} 
        (address, chain, name, symbol, image) 
        VALUES ?`,
    tokens
  );
}

/**
 * Inserts token prices into a temporary table and updates the
 * main token table with the new prices.
 *
 * @param {any[]} tokens - An array of token price records to be inserted.
 * @returns {Promise<void>} - A promise that resolves when the price updates are complete.
 */
export async function insertSpotPrices(tokens: any[]) {
  const tempTableName = "temp_spot_prices";

  // Step 1: Create the temporary table
  await sqlQuery(`
    CREATE TEMPORARY TABLE IF NOT EXISTS ${tempTableName} (
      id VARCHAR(50),
      price DECIMAL(48, 0),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    );
  `);

  // Step 2: Truncate the temporary table to remove previous data
  await sqlQuery(`TRUNCATE TABLE ${tempTableName};`);

  // Step 3: Insert tokens into the temporary table
  await sqlBatchQuery(
    `INSERT INTO ${tempTableName} (id, price) VALUES ?`,
    tokens
  );

  // Step 4: Update the main table using the temporary table
  await sqlQuery(`
    UPDATE ${SQL_TOKENS} as T_1
    JOIN ${tempTableName} as T_2
    ON T_1.coingecko_id = T_2.id
    SET T_1.price = T_2.price,
        T_1.timestamp=T_2.timestamp;
  `);
}

/**
 * Registers a token in the database by inserting token data and its categories.
 *
 * @param {any} r - The token data object.
 * @param {Object} CATEGORY_MAP - An object mapping category names to their IDs.
 * @returns {Promise<void>}
 */
async function registerToken(r: any, CATEGORY_MAP: any) {
  try {
    // Insert token data into the database
    const insert = await sqlQuery(
      `INSERT IGNORE INTO ${SQL_TOKENS} 
        (symbol, from_pair, to_pair, name, image, coingecko_id, market_cap, market_cap_rank, description, price, timestamp, server_group, is_active, is_bettable) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        r.symbol.toUpperCase() + "USD",
        r.symbol.toUpperCase(),
        "USD",
        r.name,
        r.image.large,
        r.id,
        r.market_cap || null,
        r.market_cap_rank,
        r.description?.en,
        await parseTokenPrice(r?.market_data.current_price.usd),
        await getSqlDate(),
        0,
        1,
        0,
      ]
    );

    // Insert token categories into the database
    const CATEGORIES: any[] = [];
    for (const category of r?.categories)
      CATEGORIES.push([insert.insertId, CATEGORY_MAP[category]]);
    await sqlBatchQuery(
      `INSERT IGNORE INTO ${SQL_TOKENS_CATEGORIES} (token, category) VALUES ?`,
      CATEGORIES
    );
  } catch (error) {
    console.log("Error on registerToken: ", error);
  }
}
