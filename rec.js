var amqp = require('amqplib/callback_api');
const messages = require("./stock_pb.js");


amqp.connect('amqp://guest:guest@localhost/', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'stock_player';

    ch.assertExchange(ex, 'topic', {durable: true});

    ch.assertQueue('buy.*', {exclusive: false}, function(err, q) {
      console.log(' [*] Waiting for logs. To exit press CTRL+C');

    ch.bindQueue(q.queue, ex, 'buy.*');

      ch.consume(q.queue, function(msg) {
        console.log(messages.Stock.deserializeBinary(new Uint8Array(msg.content)).toObject())
        
      }, {noAck: true});
    });
  });
});