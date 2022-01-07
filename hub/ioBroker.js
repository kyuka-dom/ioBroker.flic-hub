const net = require('net');
const buttonManager = require("buttons");

const tcpPort = 30000;

const writeFunc = function(c, data) {
  c.write(JSON.stringify(data).toString('utf8') + "\r\n")
}

const handleConnection = function(conn) {
  const buttons = buttonManager.getButtons();
  writeFunc(conn, {buttons: buttons}) // send buttonlist immediately
  setInterval(function() {
    const buttons = buttonManager.getButtons();
    writeFunc(conn, {name: 'buttons', buttons: buttons}) // send buttonlist every 10 minutes
  }, 10 * 60 * 10000)

  buttonManager.on("buttonSingleOrDoubleClickOrHold", function(obj) {
    console.log('button click detected: ' + JSON.stringify(obj));
    var button = buttonManager.getButton(obj.bdaddr);
    if (conn) writeFunc(conn, {name: 'click', eventObj: obj, button: button})
  });
}
const server = new net.createServer(handleConnection)
server.listen({port:tcpPort, host: '0.0.0.0'})