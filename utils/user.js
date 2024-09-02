import redisClient from "./redis";
import dbClient from "./db";

/**
 * Module with user utilities
 */
const userUtils = {
  /**
   * Gets a user id and key of redis from request
   */
  async getUserIdAndKey(request) {
    const obj = { userId: null, key: null };

    const tokenX = request.header("X-Token");

    if (!tokenX) return obj;

    obj.key = `auth_${tokenX}`;

    obj.userId = await redisClient.get(obj.key);

    return obj;
  },

  /**
   * Gets a user from database
   */
  async getUser(query) {
    const user = await dbClient.usersCollection.findOne(query);
    return user;
  },
};

export default userUtils;
