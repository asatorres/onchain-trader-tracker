import { parseUnits } from "ethers/lib/utils";
import { PRICE_DECIMALS } from "../constants";
import { ethers } from "ethers";

/**
 * Converts a string representation of a number into its decimal form based on
 * a specified number of decimals.
 *
 * @param {string} amount - The amount to convert, represented as a string to avoid precision loss.
 * @param {number} decimals - The number of decimal places to include in the converted amount.
 * @returns {Promise<string>} A promise that resolves to the amount in its decimal form, as a string.
 */

export const convertToDecimal = async (amount: string, decimals: number) => {
  if (amount === null) return null;

  // Convert the number to a decimal with 18 decimal places max
  let parts = amount.toString().split(".");
  if (parts.length > 1 && parts[1].length > decimals) {
    parts[1] = parts[1].substring(0, decimals);
  }
  const adjustedAmount = parts.join(".");
  return await parseUnits(adjustedAmount, decimals).toString();
};

/**
 * Parses a token price, ensuring proper precision and format
 * @param {any} price_ - The price to parse
 * @returns {Promise<string>} - A promise that resolves to the parsed price as a string
 */
export async function parseTokenPrice(price_: any) {
  let originalPrice = price_.toString();
  let numericPrice = Number(originalPrice);

  // Fix for scientific notation and ensuring correct precision
  let adjustedPrice = numericPrice.toFixed(PRICE_DECIMALS);

  // Truncate the number to the required decimal places
  let parts = adjustedPrice.split(".");
  if (parts.length > 1 && parts[1].length > 18) {
    parts[1] = parts[1].substring(0, 18); // Truncate to 18 decimal places
  }
  adjustedPrice = parts.join(".");

  // Parse the adjusted price using ethers.js
  const price = ethers.utils
    .parseUnits(adjustedPrice, PRICE_DECIMALS)
    .toString();

  return price;
}
