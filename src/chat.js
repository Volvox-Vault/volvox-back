const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const database = path.join(__dirname, "..", "database", "chat.json");
const profanity = require("./bannedforprofanity");
const HISTORY_LENGTH = 10_000;

/**
 * @typedef {{name: string, hash: string, message: string, time: number}} Message
 *
 * @type Message[]
 */
let messages = [];

loadMessages();

// Make sure this is the same on the front & backend!
const salt = "!volvox!";

const adminHashes = [
  "b27c4615a13694b4a333a429a046599e002e0a0a2fcfa9fdfc92683f625152b3", // algae
  "214daf1018e057516f40b9e6de727bf034ba748b2188ad7a311ed580834ec63e", // ari
];
const scrubbedName = [
  "(°°)～",
  "くコ:彡",
  "≧(゜゜)≦",
  "<º)))><",
  "◕ᴥ◕",
  ">゜)))彡",
  "ミ．．ミ",
  "><(((º>",
  "><((((●ﾟ<",
  ". ><{{{o ______)",
  ">゜)))<",
];
const scrubbedMessages = [
  "*splashes*",
  "*drips*",
  "*bubbles*",
  "*glub*",
  "*glub glub*",
  "*fizzes*",
  "*gurgles*",
  "*bloop*",
];
/**
 * @param {string} name
 * @param {string} code
 * @param {string} message
 */
function addMessage(name, code, message) {
  const newMessage = {
    name,
    hash: crypto
      .createHash("sha256")
      .update(Buffer.from(salt + code, "utf-8"))
      .digest("hex"),
    message,
    time: Date.now(),
  };
  messages.push(newMessage);
  if (messages.length > HISTORY_LENGTH) {
    messages.shift();
  }

  connections.forEach((c) => c.send(JSON.stringify(newMessage)));

  saveMessages();
}

/**
 * @type Set<WebSocket>
 */
const connections = new Set();

/**
 *
 * @param {string} message
 */
function softError(message) {
  return new Error(`soft: ${message}`);
}

const allowedTimeInMs = 48 * 60 * 60 * 1000; // 48 hours

module.exports = {
  /**
   * @param {import('http').Server | import('https').Server} server
   *  */
  startServer(server) {
    const wss = new WebSocket.Server({ server, path: "/chat" });
    wss.on("connection", (ws) => {
      connections.add(ws);
      let indexOfAllowedTime = messages.findIndex(
        (message) => Date.now() - message.time < allowedTimeInMs
      );
      if (indexOfAllowedTime === -1) {
        indexOfAllowedTime = Infinity;
      }
      ws.send(JSON.stringify({ admins: adminHashes }));
      messages
        .slice(indexOfAllowedTime)
        .forEach((message) => ws.send(JSON.stringify(message)));
      ws.on("close", () => connections.delete(ws));
      ws.on("message", (data) => {
        if (data.toString() === "heartbeat") {
          return;
        }
        try {
          const json = JSON.parse(data.toString());
          if ("delete" in json) {
            const { hash, time, code } = json.delete;
            if (!hash) {
              throw softError("no hash passed to delete");
            }
            if (!time) {
              throw softError("no time passed to delete");
            }
            const t = Number.parseInt(time, 10);
            if (Number.isNaN(t)) {
              throw softError("invalid time passed to delete");
            }
            const hashedCode = crypto
              .createHash("sha256")
              .update(Buffer.from(salt + code, "utf-8"))
              .digest("hex");
            if (!adminHashes.includes(hashedCode)) {
              throw softError("you're not an admin");
            }
            const message = messages.find(
              (m) => m.hash === hash && m.time === t
            );
            if (!message) {
              throw softError("message not found to delete!");
            }
            // ok, remove!
            message.name =
              scrubbedName[Math.floor(Math.random() * scrubbedName.length)];
            message.message =
              scrubbedMessages[
                Math.floor(Math.random() * scrubbedMessages.length)
              ];

            saveMessages();

            connections.forEach(async (c) => {
              c.send(JSON.stringify({ reload: true }));
              await new Promise((res) => setTimeout(res, 1000));
              let indexOfAllowedTime = messages.findIndex(
                (message) => Date.now() - message.time < allowedTimeInMs
              );
              if (indexOfAllowedTime === -1) {
                indexOfAllowedTime = Infinity;
              }
              messages
                .slice(indexOfAllowedTime)
                .forEach((message) => ws.send(JSON.stringify(message)));
            });

            return;
          }
          const { name, code, message } = json;
          if (!name || typeof name !== "string") {
            throw softError("enter a name");
          }
          if (!code || typeof code !== "string") {
            throw softError("enter a secret code");
          }
          if (!message || typeof message !== "string") {
            throw softError("enter a message");
          }
          if (profanity.some((word) => message.includes(word))) {
            throw softError("that's not very nice.");
          }
          addMessage(name, code, message);
          printMessage(name, code, message);
          console.log(`(${code.slice(0, 6)})[${name}] ${message}`);
        } catch (err) {
          if (!err.message.startsWith("soft:")) {
            console.error("<error>", err.message);
          }
          ws.send(
            JSON.stringify({
              error: err.message.replace(/^soft\:/, ""),
            })
          );
        }
      });
    });
  },
};

function saveMessages() {
  fs.writeFile(database, JSON.stringify({ messages }), (err) => {
    if (err) {
      console.error("FAILED TO WRITE DATABASE TO FILE!!!");
    }
  });
}

function loadMessages() {
  try {
    messages = JSON.parse(fs.readFileSync(database, "utf-8")).messages;
  } catch (err) {
    console.error("failed to read database from file, gonna create a new one!");
  }
}

/**
 * @param {string} name
 * @param {string} code
 * @param {string} message
 */
function printMessage(name, code, message) {
  console.log(`(${code.slice(0, 6)})[${name}] ${message}`);
}
