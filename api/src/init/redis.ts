import { createClient, RedisClientType } from "redis";

if (!process.env.REDIS_URL) {
  throw new Error("redis url is not defined in environment variables");
}

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // exponential backoff with max delay of 3s
      const delay = Math.min(retries * 50, 3000);
      return delay;
    },
  },
});

redisClient.on("error", (err) => {
  console.error("redis client error:", err);
});

redisClient.on("connect", () => {
  console.info("connected to redis successfully");
});

redisClient.on("reconnecting", () => {
  console.info("reconnecting to redis...");
});

await redisClient.connect();

// this is cached :D
export default redisClient;
