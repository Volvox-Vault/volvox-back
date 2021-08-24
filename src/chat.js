const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const database = path.join(__dirname, "..", "database", "chat.json");

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
          const { name, code, message } = json;
          if (!name) {
            throw softError("enter a name");
          }
          if (!code) {
            throw softError("enter a secret code");
          }
          if (!message) {
            throw softError("enter a message");
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
  fs.readFile(database, (err, data) => {
    if (err) {
      console.error(
        "failed to read database from file, gonna create a new one!"
      );
    } else {
      messages = JSON.parse(data.toString()).messages;
    }
  });
}

/**
 * @param {string} name
 * @param {string} code
 * @param {string} message
 */
function printMessage(name, code, message) {
  console.log(`(${code.slice(0, 6)})[${name}] ${message}`);
}
