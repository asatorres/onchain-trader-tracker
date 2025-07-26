import { CHAIN, CHAIN_MAP, CHAIN_MAP_BITQUERY } from "../../constants";
import {
  SQL_SPOT_TOKENS,
  SQL_SPOT_TRANSFERS,
  SQL_TOKENS,
  SQL_USERS_WALLETS,
} from "../../constants/tables";
import { sqlBatchQuery, sqlQuery } from "../database";

/**
 * Retrieves a list of user addresses to track from the database.
 *
 * @returns {Promise<any>} - A promise that resolves with the addresses to track.
 */
export async function getAddressesToTrack() {
  try {
    return await sqlQuery(
      `SELECT address FROM ${SQL_USERS_WALLETS} WHERE trader_type != 3 AND type='${
        CHAIN == "sol" ? "sol" : "evm"
      }'`
    );
  } catch (error) {
    console.log(`Error on getAddressToTrack: `, error);
  }
}

/**
 * Retrieves a list of tokens to track for a specified blockchain.
 *
 * @param {string} [chain=CHAIN] - The blockchain identifier for which to retrieve the tokens.
 */
export async function getTokensToTrack(chain: string = CHAIN) {
  try {
    return await sqlQuery(
      `SELECT address, T_1.coingecko_id
       FROM ${SQL_SPOT_TOKENS} as T_1
       JOIN ${SQL_TOKENS} as T_2
       ON T_1.coingecko_id = T_2.coingecko_id
       AND server_group=0 AND T_2.is_active=1 AND T_1.chain=?`,
      [chain]
    );
  } catch (error) {
    console.log(`Error on getTokensToTrack: `, error);
  }
}

/**
 * Generates a GraphQL subscription query for Bitquery to subscribe to real-time information
 * such as balance updates and token price updates for specific trader and tokens addresses.
 *
 * @param {string[]} traderAddresses - An array of trader addresses to subscribe to for updates.
 * @param {string[]} tokenAddresses - An array of token addresses to subscribe to for updates.
 * @returns {string} - A GraphQL subscription query string.
 */
export function getSubscriptionQuery(chain: string = CHAIN) {
  let evm_query = `
    subscription {
      EVM(network: ${CHAIN_MAP_BITQUERY[chain]}) {
        BalanceUpdates(
          where: {
            any: [
              { BalanceUpdate: { Type: {in: transfer}, Amount: {ne: "0"}} }
            ]
          }
          orderBy: { descending: Block_Time }
        ) {
          BalanceUpdate {
            Address
            AmountInUSD
            Amount
          }
          ChainId
          Currency {
            Name
            SmartContract
            Symbol
          }
          Transaction {
            Signature
          }
          Block {
            Time
          }
        }
      }
    }
  `;

  let sol_query = `
    subscription {
      Solana {
        BalanceUpdates(
          where: {any: [{BalanceUpdate: {Type: {in: Transaction}, Currency: {Symbol: {not: "SOL"}}, AmountInUSD: {ne: "0"}}}]}
        ) {
          BalanceUpdate {
            AmountInUSD
            Amount
            Account {
              Address
            }
            Currency {
              Name
              Symbol
              MintAddress
            }
          }
          ChainId
          Transaction {
            Index
          }
          Block {
            Time
          }
        }
      }
    }
  `;

  return chain == "sol" ? sol_query : evm_query;
}

/**
 * Inserts multiple transfer records into the database using a batch query.
 *
 * @param {any[]} transfers - An array of transfer records to be inserted.
 */
export async function insertTransfers(transfers: any[]) {
  await sqlBatchQuery(
    `INSERT IGNORE INTO ${SQL_SPOT_TRANSFERS} 
       (address, token, chain, amount, amount_usd, timestamp, hash) 
       VALUES ?`,
    transfers
  );
}
