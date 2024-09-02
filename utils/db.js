import { MongoClient } from "mongodb";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 27017;
const DB_DATABASE = process.env.DB_DATABASE || "files_manager";
const url = `mongodb://${DB_HOST}:${DB_PORT}`;

/**
 * operations with Mongo service
 */
class DBClient {
  constructor() {
    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
      if (!err) {
        this.db = client.db(DB_DATABASE);
        this.usersCollection = this.db.collection("users");
        this.filesCollection = this.db.collection("files");
      } else {
        console.log(err.message);
        this.db = false;
      }
    });
  }

  /**
   * Verifies if connection to Redis is Alive
   * @return {boolean} true if connection alive or false if not
   */
  isAlive() {
    return Boolean(this.db);
  }

  /**
   * Check the number of documents in the collection users
   */
  async nbUsers() {
    const users = this.usersCollection.countDocuments();
    return users;
  }

  /**
   * number of documents in the collection files
   * @return {number} amount of files
   */
  async nbFiles() {
    const files = this.filesCollection.countDocuments();
    return files;
  }
}

const dbClient = new DBClient();

export default dbClient;
