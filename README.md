# Game of Life

A multiplayer implementation of Conway's Game of Life using Node.js, Socket.IO, Redis, and Phaser. This implementation focuses on real-time collaboration, state management, and scalability.

Demo: https://app-production-3ffd.up.railway.app

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
   - Optimistic Concurrency Control (OCC) for state accuracy
   - Automatic state cleanup with expiration

2. **Real-time Updates**

   - Socket.IO for immediate player actions and updates
   - Direct state synchronization between players
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
     |            [State Validation]
     |                    |
     |                    v
     |            [Redis Update w/OCC]
     |                    |
     |                    v
Other Players (in same room) <--[Socket.IO Broadcast]
```

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

The game implements Redis persistence and reconnection strategies for improved reliability:

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

2. **Reconnection Strategy**
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

2. **Atomic Operations**

   - Built-in atomic transactions without connection overhead
   - Optimistic concurrency control (WATCH/MULTI) with minimal latency
   - Ideal for concurrent player actions in the same game room

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

   - Chose consistency for game state accuracy
     - OCC ensures accurate state updates
     - Small latency cost for state validation
   - Optimistic UI updates for responsiveness
   - Future options:
     - Add eventual consistency for non-critical updates
     - Implement state diffing for bandwidth optimization

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

- `pnpm dev` - Start development servers
- `pnpm test` - Run tests
- `pnpm build` - Build for production
- `pnpm lint` - Lint code

## Testing

- Unit tests with Vitest
- Integration testing (missing because of time). **TODO later maybe.**
  - We could use Playwrite for E2E testing
  - Vitest for integration testing and since we have a docker-compose file already, we can easily spin up a Redis instance for testing and reuse the images to create test instances for testing.

## Deployment

The easiest way for deployment is to use a service like [Railway](https://railway.app).

## License

This project is licensed under the MIT License - see the LICENSE file for details.
