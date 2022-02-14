const chat = require("./chat");

const server = require("http")
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("chungus");
    res.end();
  })
  .listen(4455);

chat.startServer(server);

console.log("listening on port 4455");
