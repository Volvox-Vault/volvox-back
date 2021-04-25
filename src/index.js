const chat = require("./chat");

const server = require("http")
  .createServer((req, res) => {
    console.log(req);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("chungus");
    res.end();
  })
  .listen(4455);

chat.startServer(server);
