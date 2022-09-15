const chat = require("./chat");

const server = require("http")
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("we're floating around somewhere in the chatmosphere~");
    res.end();
  })
  .listen(4455);

chat.startServer(server);

console.log("listening on port 4455");
