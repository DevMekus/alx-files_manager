import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { promises as fsPromises } from "fs";
import dbClient from "./db";
import userUtils from "./user";
import basicUtils from "./basic";

/**
 * file utilities
 */
const fileUtils = {
  /**
   * Function Validates if body is valid for creating file
   */
  async validateBody(request) {
    const { name, type, isPublic = false, data } = request.body;

    let { parentId = 0 } = request.body;

    const allowedTypes = ["file", "image", "folder"];
    let msg = null;

    if (parentId === "0") parentId = 0;

    if (!name) {
      msg = "Missing name";
    } else if (!type || !allowedTypes.includes(type)) {
      msg = "Missing type";
    } else if (!data && type !== "folder") {
      msg = "Missing data";
    } else if (parentId && parentId !== "0") {
      let file;

      if (basicUtils.isValidId(parentId)) {
        file = await this.getFile({
          _id: ObjectId(parentId),
        });
      } else {
        file = null;
      }

      if (!file) {
        msg = "Parent not found";
      } else if (file.type !== "folder") {
        msg = "Parent is not a folder";
      }
    }

    const obj = {
      error: msg,
      fileParams: {
        name,
        type,
        parentId,
        isPublic,
        data,
      },
    };

    return obj;
  },

  /**
   * Fetch file document from db
   */
  async getFile(query) {
    const file = await dbClient.filesCollection.findOne(query);
    return file;
  },

  /**
   * Fetch list of file documents from db belonging
   * to a parent id
   */
  async getFilesOfParentId(query) {
    const list = await dbClient.filesCollection.aggregate(query);
    return list;
  },

  /**
   * saves files to database and disk
   */
  async saveFile(userId, fileParams, FOLDER_PATH) {
    const { name, type, isPublic, data } = fileParams;
    let { parentId } = fileParams;

    if (parentId !== 0) parentId = ObjectId(parentId);

    const query = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    };

    if (fileParams.type !== "folder") {
      const UUID = uuidv4();

      const fileDataDecoded = Buffer.from(data, "base64");

      const path = `${FOLDER_PATH}/${UUID}`;

      query.localPath = path;

      try {
        await fsPromises.mkdir(FOLDER_PATH, { recursive: true });
        await fsPromises.writeFile(path, fileDataDecoded);
      } catch (err) {
        return { error: err.message, code: 400 };
      }
    }

    const result = await dbClient.filesCollection.insertOne(query);

    const file = this.processFile(query);

    const newFile = { id: result.insertedId, ...file };

    return { error: null, newFile };
  },

  /**
   * Updates a file document in database
   */
  async updateFile(query, set) {
    const files = await dbClient.filesCollection.findOneAndUpdate(query, set, {
      returnOriginal: false,
    });
    return files;
  },

  /**
   * Makes a file public or private
   */
  async publishUnpublish(request, setPublish) {
    const { id: fileId } = request.params;

    if (!basicUtils.isValidId(fileId)) {
      return { error: "Unauthorized", code: 401 };
    }

    const { userId } = await userUtils.getUserIdAndKey(request);

    if (!basicUtils.isValidId(userId)) {
      return { error: "Unauthorized", code: 401 };
    }

    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    if (!user) return { error: "Unauthorized", code: 401 };

    const file = await this.getFile({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) return { error: "Not found", code: 404 };

    const result = await this.updateFile(
      {
        _id: ObjectId(fileId),
        userId: ObjectId(userId),
      },
      { $set: { isPublic: setPublish } }
    );

    const {
      _id: id,
      userId: resultUserId,
      name,
      type,
      isPublic,
      parentId,
    } = result.value;

    const updatedFile = {
      id,
      userId: resultUserId,
      name,
      type,
      isPublic,
      parentId,
    };

    return { error: null, code: 200, updatedFile };
  },

  /**
   * Transform _id into id in a file document
   */
  processFile(doc) {
    const file = { id: doc._id, ...doc };

    delete file.localPath;
    delete file._id;

    return file;
  },

  /**
   * Checks if a file is public and belongs to a
   * specific user
   */
  isOwnerAndPublic(file, userId) {
    if (
      (!file.isPublic && !userId) ||
      (userId && file.userId.toString() !== userId && !file.isPublic)
    ) {
      return false;
    }

    return true;
  },

  /**
   * Gets a files data from database
   */
  async getFileData(file, size) {
    let { localPath } = file;
    let data;

    if (size) localPath = `${localPath}_${size}`;

    try {
      data = await fsPromises.readFile(localPath);
    } catch (err) {
      // console.log(err.message);
      return { error: "Not found", code: 404 };
    }

    return { data };
  },
};

export default fileUtils;
