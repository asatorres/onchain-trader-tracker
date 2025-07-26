import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// Function to create and return a MySQL database connection pool
const pool = mysql.createPool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  port: parseInt(process.env.SQL_PORT as any, 10),
  connectionLimit: 10,
  charset: "utf8mb4",
});

export const connectDatabase = (): mysql.Pool => {
  return pool;
};
