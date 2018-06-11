const amqp = require('amqplib');
const messages = require("./stock_pb.js");

amqp.connect('amqp://guest:guest@localhost/').then(function(conn) {
  return conn.createChannel().then(function(ch) {
    var ex = 'stock_player';
    var ok = ch.assertExchange(ex, 'topic', {durable: true});
    let msg = new messages.Stock()
    msg.setId("1")
    msg.setActionId("1")
    msg.setAmount(2)
    msg.setPrice(200)
    console.log(msg)
    return ok.then(function() {
      ch.publish(ex, "stock.test", Buffer.from(msg.serializeBinary()));
      console.log(msg.serializeBinary())
      return ch.close();
    });
  }).finally(function() { conn.close(); })
}).catch(console.log);