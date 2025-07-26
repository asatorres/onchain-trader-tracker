import WebSocket from "ws";
import {
  AMOUNT_DECIMALS,
  BITQUERY_API_TOKEN,
  BITQUERY_WS_URL,
  CHAIN,
  PRICE_DECIMALS,
  UDPATE_INTERVAL,
} from "../constants";
import { convertToDecimal } from "../utils/functions";
import { convertToSqlDate } from "../utils/database";
import { insertSpotPrices } from "../utils/functions/tokens";
import { getAddress } from "ethers/lib/utils";
import {
  getAddressesToTrack,
  getSubscriptionQuery,
  getTokensToTrack,
  insertTransfers,
} from "../utils/functions/listener";

// Set up variables
let intervalId: any = null;
let ws: WebSocket | null = null;
let reconnectAttempts = 0;

const traderAddressMap = new Map();
const tokenAddressMap = new Map();

/**
 * Updates the lists and maps of trader and token addresses to track.
 * Fetches addresses from two asynchronous sources and updates
 * the corresponding arrays and maps.
 */
export async function fetchAddresses() {
  const [traderAddresses, tokenAddresses] = await Promise.all([
    getAddressesToTrack(),
    getTokensToTrack(),
  ]);

  // Populate address maps
  traderAddressMap.clear();
  tokenAddressMap.clear();
  traderAddresses.forEach((r: any) =>
    traderAddressMap.set(
      CHAIN == "sol" ? r.address : getAddress(r.address),
      true
    )
  );
  tokenAddresses.forEach((r: any) =>
    tokenAddressMap.set(r.address, r.coingecko_id)
  );
}

/**
 * Subscribes to the bitquery WebSocket server with a bitquery
 * based on trader and token addresses.
 * Sends a subscription message with a dynamically generated message.
 */
export async function subscribe() {
  const message = JSON.stringify({
    type: "start",
    id: "1",
    payload: {
      query: await getSubscriptionQuery(),
      variables: {},
    },
  });
  ws?.send(message);
}

/**
 * Initializes and manages a WebSocket connection to Bitquery.
 */
export const initWebSocketBitquery = () => {
  /**
   * Establishes a WebSocket connection and sets up event listeners.
   * It handles connection initialization, message handling, errors,
   * and reconnections.
   */
  async function connect() {
    let TRANSFERS: any[] = [];
    let PRICES = new Map();
    await fetchAddresses();

    // Initialize WebSocket connection
    ws = new WebSocket(
      `${BITQUERY_WS_URL}?token=${BITQUERY_API_TOKEN}`,
      ["graphql-ws"],
      {
        headers: {
          "Sec-WebSocket-Protocol": "graphql-ws",
          "Content-Type": "application/json",
        },
      }
    );

    /**
     * Sets up an interval to periodically update transfers and prices.
     * The updates are fetched and processed, and any errors
     * during the update process are handled.
     */
    intervalId = setInterval(async () => {
      // Update Transfers if there are any
      if (TRANSFERS.length > 0) {
        let transfers = [...TRANSFERS];
        try {
          TRANSFERS = [];
          await insertTransfers(transfers);
          console.log("Transfers updated: ", transfers.length);
        } catch (error) {
          TRANSFERS = [...transfers, ...TRANSFERS];
          console.log("Error updating transfers ", error);
        }
      }
      // Update Prices if there are any
      if (PRICES.size > 0) {
        const prices = Array.from(PRICES.values());
        PRICES.clear();
        try {
          await insertSpotPrices(prices);
          console.log("Prices updated: ", prices.length);
        } catch (error) {
          console.log("Error updating prices ", error);
        }
      }
    }, UDPATE_INTERVAL);

    /**
     * Handles WebSocket 'open' event.
     * Sends initialization and subscription messages
     * to start receiving data.
     */
    ws.on("open", async () => {
      console.log("Connected to Bitquery.");
      reconnectAttempts = 0;
      // Send initialization message
      const initMessage = JSON.stringify({ type: "connection_init" });
      ws?.send(initMessage);
      // After initialization, send the actual subscription message
      setTimeout(async () => {
        await subscribe();
      }, 1000);
    });

    /**
     * Handles WebSocket 'message' event.
     * Processes incoming data, extracts balance updates,
     * and updates transfers and prices.
     *
     * @param {WebSocket.Data} data - The data received from the WebSocket server.
     */
    ws.on("message", async (data: WebSocket.Data) => {
      const response = JSON.parse(data.toString());
      if (response.type === "data") {
        const balanceUpdates =
          CHAIN == "sol"
            ? response.payload.data.Solana.BalanceUpdates
            : response.payload.data.EVM.BalanceUpdates;

        console.log("Balances ==> ", balanceUpdates.length);
        for (const update of balanceUpdates) {
          try {
            const traderAddress =
              CHAIN == "sol"
                ? update.BalanceUpdate.Account.Address
                : getAddress(update.BalanceUpdate.Address);
            const tokenAddress =
              CHAIN == "sol"
                ? update.BalanceUpdate.Currency.MintAddress
                : getAddress(update.Currency.SmartContract);
            const chain = CHAIN == "sol" ? "sol" : update.ChainId;
            const hash =
              CHAIN == "sol"
                ? update.Transaction.Signature
                : update.Transaction.Hash;

            // Insert balances updates
            if (tokenAddress == "0x") continue;
            if (traderAddressMap.has(traderAddress)) {
              TRANSFERS.push([
                traderAddress,
                tokenAddress,
                chain,
                await convertToDecimal(
                  update.BalanceUpdate.Amount,
                  AMOUNT_DECIMALS
                ),
                await convertToDecimal(
                  update.BalanceUpdate.AmountInUSD,
                  AMOUNT_DECIMALS
                ),
                await convertToSqlDate(update.Block.Time),
                hash,
              ]);
              console.log("TRANSFERS...", TRANSFERS);
            }

            // Insert tokens updates
            if (
              tokenAddressMap.has(tokenAddress) &&
              update.BalanceUpdate.Amount != 0 &&
              update.BalanceUpdate.AmountInUSD != 0
            ) {
              let coingecko_id = tokenAddressMap.get(tokenAddress);
              let price =
                update.BalanceUpdate.AmountInUSD / update.BalanceUpdate.Amount;
              PRICES.set(tokenAddress, [
                coingecko_id,
                await convertToDecimal(price.toString(), PRICE_DECIMALS),
              ]);
              console.log("PRICES...", PRICES);
            }
          } catch (error) {
            console.log("Error processing update: ", error);
          }
        }
      }
    });

    /**
     * Handles WebSocket 'error' event.
     * Logs the error and attempts to close the WebSocket connection.
     * @param {Error} error - Error object
     */
    ws.on("error", async (error: Error) => {
      console.error("WebSocket error:", error);
      if (ws) {
        ws.close();
      }
    });

    /**
     * Handles WebSocket 'close' event.
     * Attempts to reconnect after a delay, implementing
     * an exponential backoff strategy.
     */
    ws.on("close", async () => {
      console.log("WebSocket connection closed. Attempting to reconnect...");
      reconnectAttempts++;
      const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
      setTimeout(() => {
        connect();
      }, delay);
    });
  }

  // Initiate the WebSocket connection
  connect();
};
