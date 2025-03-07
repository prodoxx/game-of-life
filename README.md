# Game of Life

A multiplayer implementation of Conway's Game of Life using Node.js, Socket.IO, Redis, and Phaser. This implementation focuses on real-time collaboration, state management, and scalability.

Demo: https://app-production-3ffd.up.railway.app

One-click Deploy to Railway:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/FN2JJN?referralCode=xcSIvP)

## Table of Contents

- [Game of Life](#game-of-life)
  - [Table of Contents](#table-of-contents)
  - [Technical Architecture](#technical-architecture)
    - [State Management and Concurrency](#state-management-and-concurrency)
      - [Current Implementation](#current-implementation)
      - [Event Flow](#event-flow)
      - [Game State Processing](#game-state-processing)
      - [Game Metadata Persistence](#game-metadata-persistence)
      - [Redis Persistence \& Reliability](#redis-persistence--reliability)
      - [Why Redis Over Traditional Databases](#why-redis-over-traditional-databases)
    - [Technical Choices](#technical-choices)
    - [Trade-offs and Considerations](#trade-offs-and-considerations)
  - [Assumptions Made](#assumptions-made)
  - [Other projects](#other-projects)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Development](#development)
  - [Testing](#testing)
  - [Deployment](#deployment)
  - [License](#license)

## Technical Architecture

![image](https://github.com/user-attachments/assets/5a3b1fab-e489-4060-9937-cd2196337202)

The application is split into three main components:

1. **Frontend (app/)**

   - Built with Phaser 3 for game rendering
   - TypeScript for type safety
   - Tailwind CSS for UI styling
   - Socket.IO client for real-time communication
   - Vite for development and building
   - Vitest for testing

2. **Backend (api/)**

   - Node.js with TypeScript
   - Socket.IO for WebSocket communication
   - Redis for state management
   - Zod for runtime type validation

3. **Shared (shared/)**
   - Common types and schemas
   - Shared utilities and constants
   - Cross-package type definitions

### State Management and Concurrency

#### Current Implementation

The game uses a focused state management system:

1. **Game State Storage**

   - Game room metadata and grid state stored in Redis
   - Queue-based update system with timestamps for state accuracy
   - Automatic state cleanup with expiration

2. **Real-time Updates**

   - Socket.IO for immediate player actions and updates
   - Batched state updates with timestamp ordering
   - Automatic reconnection handling

3. **Recovery Handling**
   - Latest state snapshot always available
   - Automatic state recovery on reconnection
   - Clean session management

#### Event Flow

```
Player Action (UI) --[Socket.IO]--> Server
     ^                    |
     |                    v
     |            [Update Queue]
     |                    |
     |                    v
     |            [Batch Processing]
     |                    |
     |                    v
     |            [Redis Update]
     |                    |
     |                    v
Other Players (in same room) <--[Socket.IO Broadcast]
```

#### Game State Processing

1. **Update Queueing**

   - Updates are queued with timestamps for ordering
   - Batched processing reduces Redis operations
   - 50ms delay for optimal batching

2. **State Synchronization**

   - Updates processed in timestamp order
   - Heartbeat system for generation tracking
   - Atomic batch application of changes

3. **Conflict Resolution**
   - Timestamp-based ordering ensures consistency
   - Latest state always reflected across all clients
   - Automatic conflict resolution through queue processing

#### Game Metadata Persistence

Game metadata is persisted in Redis for several critical reasons:

1. **Player Reconnection**

   - Maintains player colors, roles (host), and status
   - Enables seamless rejoin after disconnection
   - Preserves game room membership

2. **Game State Recovery**

   - Stores current grid state and generation count
   - Allows players to sync when joining ongoing games
   - Prevents game state loss during server restarts

3. **Room Management**
   - Tracks active game rooms and their properties
   - Handles room cleanup through Redis expiration
   - Manages player limits and room access

#### Redis Persistence & Reliability

The game implements Redis persistence and queue-based update strategies for improved reliability:

1. **Persistence Configuration**

   ```
    redis-server --save 3600 1 --save 300 100 --save 60 10000 --appendonly yes --appendfsync everysec
   ```

- Enables AOF (Append-Only File) persistence with trade-offs:
  - Every write operation is logged to the AOF file
  - `everysec` setting buffers writes and syncs every second
  - Small chance of losing 1 second of data on server crash
  - Better performance than `always` sync, more durable than `no` sync
- RDB snapshots at multiple intervals:
  - Every 60 minutes if at least 1 change
  - Every 5 minutes if at least 100 changes
  - Every 1 minute if at least 10000 changes
- Low impact for our use case as:
  - Data stored is minimal (room metadata and grid state)
  - Each room has an expiration time
  - Redis is primarily used as a temporary state holder
  - Game can recover from brief state loss through client reconnection

2. **Update Processing**

   - Queue-based system with 50ms batching window
   - Timestamp ordering for consistent state updates
   - Heartbeat mechanism for generation tracking
   - Automatic conflict resolution through queue processing

3. **Reconnection Strategy**
   - Exponential backoff with 50ms base delay
   - Maximum retry delay capped at 3 seconds
   - Automatic reconnection handling
   - Minimal impact as:
     - Socket.IO handles real-time communication
     - Client UI remains responsive during reconnection
     - Game state can be recovered from other players

#### Why Redis Over Traditional Databases

Redis provides significant advantages for our real-time game state management:

1. **In-Memory Performance**

   - Sub-millisecond response times for state updates
   - Minimal disk I/O impact (async AOF writes every second)
   - Reads always served from memory, perfect for game state queries

2. **Queue Processing**

   - Efficient batching of state updates
   - Timestamp-based ordering for consistency
   - Minimal latency for real-time game updates

3. **Simpler Architecture**

   - No ORM or complex query layers needed
   - Direct key-value operations match our data access patterns
   - Built-in TTL for automatic room cleanup

4. **Memory Efficiency**
   - Small memory footprint for our simple data structures
   - No index overhead unlike MongoDB or PostgreSQL
   - Automatic memory management with maxmemory policies

Traditional databases like PostgreSQL or MongoDB would add unnecessary complexity and latency for our temporary, fast-changing game state data.

### Technical Choices

1. **Redis Usage**

   - Redis Key-Value for state persistence
     - Accurate snapshots with OCC
     - Automatic expiration for cleanup
   - Redis Transactions for state consistency
   - Future scaling options:
     - Implement sharding for game rooms
     - Add caching layers if needed
     - Optimize state storage patterns

2. **Socket.IO over Raw WebSockets**

   - Automatic reconnection handling
   - Built-in room management
   - Fallback to long polling
   - Binary data support

3. **Phaser over Canvas/WebGL**

   - Optimized game rendering
   - Built-in game loop
   - Input handling and scaling
   - Cross-browser compatibility

4. **TypeScript + Zod**
   - Type safety during development
   - Runtime type validation
   - Shared type definitions
   - Enhanced IDE support
5. **Github Actions**
   - Mostly used for CI
   - Future:
     - We can use [Dagger](https://dagger.io/) to keep CI/CD code using Typescript.

### Trade-offs and Considerations

1. **Performance vs. Consistency**
   OCC didn't work out because handling updates one by one is too slow and wouldn't scale if we don't add
   concurrency. Therefore, I chose to use a queue-based strategy with batching.
   Trade offs:

   - Balanced approach favoring consistency:
     - Queue-based updates with 50ms batching window for performance
     - Timestamp ordering ensures state consistency
     - Heartbeat system for accurate generation tracking
   - Performance optimizations:
     - Batched state updates reduce Redis operations
     - Client-side state prediction for responsiveness
     - Efficient update merging on server
   - Future options:
     - Implement state diffing for bandwidth optimization
     - Add regional server nodes for lower latency
     - Fine-tune batching window based on player count

2. **Scalability**

   - Current: Single server with Redis backend
     - Room-based state partitioning
     - Efficient state storage and retrieval
   - Future scaling options:
     - Implement horizontal scaling with Redis cluster
     - Add load balancing across game rooms
     - Optimize state storage patterns

3. **State Management**

   - Current: Latest state snapshot approach
     - Simple and efficient storage
     - Quick recovery from disconnections
     - Easy state synchronization
   - Future options:
     - Add state versioning
     - Implement advanced state reconciliation
     - Add conflict resolution strategies

4. **Error Recovery**
   - Automatic reconnection handling
   - State recovery from Redis
   - Clean session management
   - Future options:
     - Add distributed error handling
     - Implement advanced state reconciliation
     - Add conflict resolution strategies

## Assumptions Made

I made a few assumptions.

1. Typlically games like this have rooms and since rooms fits in perfectly with Socket.io. I went with this design. There is a 5 users per game that can be configured at `api/src/config/config.ts`. the grid is small so I figured we would want more than 5. I could have also allowed for panning and unlimited cells and with this allow a lot of users but we could do this later if we had time.
2. Predefined pattern put by a user covers an alive cell. They don't go out of the grid container, though.
3. I added a room link so the host can share it with others so other people can join. This wasn't in the spec but it made sense to me given that I play games often.
4. I tag a user with a userId that we save in localStorage so if they disconnect and come back later, their color and state stayed the same and they can continue playing.
5. The specs didn't say but I made the game rooms short lived. I set it to 24 hours in `api/src/config/config.ts` so it should automatically remove the room state and game state after that time. I did this because I just assumed the games won't be long and also to save resources especially since we are using redis.
6. I used esbuild for the API because it's faster to build and also easier to configure with Typescript's ESM related config.
7. Users can't join a room once the game as started. This is a typical design for most games I've seen. It simplifies things but its possible to allow this.
8. This will only be a desktop game so time wasn't spent making it look good on smaller screens.

## Other projects

[MyQA](https://myqa.is)

A personal side project: **MyQA** is a social Q&A platform that enables creators and influencers to monetize answers to questions from their followers and fans. Payments are processed via Stripe, with a blockchain-based payment version—powered by the **Decentralized Content Access Protocol (DCAP)**—planned for future release. I previously wrote an open-source Solana smart contract for an earlier version, available here: [Solana Smart Contract V1 for MyQA](https://github.com/prodoxx/myqa-is/blob/main/programs/myqa/src/lib.rs) _(deprecated)._

[MyCredit](https://mycredit.bz)

An e-commerce platform for selling virtual debit cards, powered by a custom bank payment layer I developed. Designed for countries with limited financial infrastructure, it processes payments via bank transfers. The system automatically detects incoming transfers and completes orders seamlessly.

## Getting Started

### Prerequisites

- Node.js 18+
- Redis 6.2+
- pnpm (preferred package manager)
- Docker (latest)

### Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:prodoxx/game-of-life.git
   cd game-of-life
   ```

2. Install dependencies (in root):

   ```bash
   pnpm install
   ```

3. Configure environment variables:
   For both `api/` and `app/`

   ```bash
   cp app/.env.example app/.env && cp api/.env.example api/.env
   ```

4. Start development services:
   ```bash
   docker compose up
   ```

### Development

In both `/app` and `/api` you have access to these commands:

- `pnpm dev` - Start development servers
- `pnpm test` - Run tests
- `pnpm build` - Build for production
- `pnpm lint` - Lint code

## Testing

- Unit tests with Vitest were done for both app and api with a focus on `app` because of time.
- Integration testing (missing because of time). **TODO later maybe.**
  - I could use Playwrite for E2E testing
  - Vitest for integration testing and since we have a docker-compose file already, we can easily spin up a Redis instance for testing and reuse the images to create test instances for testing.

## Deployment

The easiest way for deployment is to use a service like [Railway](https://railway.app).
Try it out:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/FN2JJN?referralCode=xcSIvP)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
