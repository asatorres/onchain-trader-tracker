# OnChain Trader Tracker

A real-time on-chain trader tracking and portfolio analytics system that monitors DEX transactions, computes trader performance, and maintains portfolio positions across multiple blockchains using Bitquery API.

## Features

- **Real-time Transaction Monitoring**: WebSocket-based streaming of DEX transactions across multiple chains
- **Multi-chain Support**: Ethereum, Base, Arbitrum, and Solana blockchain networks
- **Portfolio Analytics**: Automatic computation of buy/sell amounts, P&L, and position tracking
- **Token Metadata Integration**: Automatic token discovery and metadata enrichment via Moralis and CoinGecko APIs
- **Database Persistence**: MySQL-based storage for historical data and analytics
- **Automated Workflows**: Cron-based jobs for portfolio updates and token discovery

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bitquery API  │────│  WebSocket       │────│  Transaction    │
│   (GraphQL)     │    │  Listener        │    │  Processing     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Token APIs    │────│  Token Metadata  │    │  Portfolio      │
│ (Moralis/CoinGecko)  │  Scraper         │    │  Analytics      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                       ┌──────────────────┐    ┌─────────────────┐
                       │   MySQL Database │────│  Cron Jobs      │
                       │   (Positions &   │    │  (Automated     │
                       │    Metadata)     │    │   Updates)      │
                       └──────────────────┘    └─────────────────┘
```

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Database**: MySQL with connection pooling
- **APIs**: Bitquery GraphQL, Moralis, CoinGecko
- **WebSockets**: Real-time data streaming
- **Scheduling**: Node-cron for automated tasks
- **Blockchain**: Ethers.js for address validation and utilities

## Prerequisites

- Node.js 16+ and npm
- MySQL database
- API keys for:
  - [Bitquery](https://bitquery.io/) (API key and token)
  - [Moralis](https://moralis.io/) (API key)
  - [CoinGecko](https://www.coingecko.com/en/api) (API key)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/onchain-trader-tracker.git
   cd onchain-trader-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   
   Configure your environment variables:
   ```env
   # Bitquery Configuration
   BITQUERY_WS_URL=wss://streaming.bitquery.io/graphql
   BIQUERY_API_URL=https://streaming.bitquery.io/graphql
   BITQUERY_API_KEY=your_bitquery_api_key
   BITQUERY_API_TOKEN=your_bitquery_token
   
   # Database Configuration
   SQL_HOST=your_mysql_host
   SQL_USER=your_mysql_user
   SQL_PASSWORD=your_mysql_password
   SQL_DB_NAME=your_database_name
   SQL_PORT=3306
   
   # Blockchain Configuration
   CHAIN=1  # 1=Ethereum, 8453=Base, 42161=Arbitrum, sol=Solana
   MAX_ADDRESSES_BITQUERY=350
   
   # API Keys
   MORALIS_API_KEY=your_moralis_api_key
   COINGECKO_API_KEY=your_coingecko_api_key
   ```

4. **Database Setup**
   
   Create the required database tables (schema not included - contact for setup scripts).

## Usage

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Key Components

- **Real-time Listener**: Monitors specified wallet addresses for new transactions
- **Portfolio Scraper**: Fetches historical portfolio data for tracked wallets
- **Token Discovery**: Automatically discovers and enriches new token metadata
- **Analytics Engine**: Computes trading metrics and portfolio performance

## Configuration

### Supported Chains

| Chain ID | Network | Bitquery Name |
|----------|---------|---------------|
| 1        | Ethereum | eth |
| 8453     | Base | base |
| 42161    | Arbitrum | arbitrum |
| sol      | Solana | solana |

### Monitoring Intervals

- **Transaction Updates**: 5 seconds
- **Portfolio Recomputation**: 2 minutes  
- **Wallet Refresh**: 15 minutes
- **Token Discovery**: 3 minutes

## API Integration

### Bitquery
- Real-time WebSocket subscriptions for transaction monitoring
- GraphQL queries for historical portfolio data
- Rate limiting and reconnection handling

### Moralis
- EVM token metadata retrieval
- Multi-chain support for token information

### CoinGecko
- Token price data and market information
- Token categorization and additional metadata

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is for educational and research purposes. Always verify data independently and ensure compliance with relevant regulations when tracking blockchain transactions.
