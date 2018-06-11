'use strict';

/**
 * IMPORTS
 */
const amqp = require('amqplib');
const util = require('util');
const _ = require('lodash');
const messages = require("./stock_pb.js");

/**
 * PARSE COMMAND LINE ARGS
 */

const usage = () => "[INFO] usage node player.js [login] [money] [strategy] [lookback amount]";

if(process.argv.length !== 6){
    console.log("[ERROR] Wrong arguments number");
    console.log(usage());
    return;
}
const login = process.argv[2];
let money = parseInt(process.argv[3]);
const strategy = process.argv[4];
const player_look_back = parseInt(process.argv[5]);

/**
 * CONFIGS
 */

const exchangeName = "stock_player";
const q1_name = "actions";
const q2_name = "stock_info";
const q1_routing = "stock.*";
const q2_routing = `payback.*.${login}`;

const connection =   amqp.connect('amqp://guest:guest@localhost/')
// console.log(q2_routing)
/**
 * STRATEGIES
 */

const weakStrategy  = () => {
    
};

const middleStrategy = () => {

};

const strongStrategy = () => {

};

/**
 * DATA
 */

const user_actions = {};
const stock_info = {};
const pendingTransactions = [];

/**
 * DATA PROCESSING FUNCTIONS
 */

const add_stock_info = (info) => {
    if(!stock_info[info.id]){
        stock_info[info.id]={};
    }
    if(stock_info[info.id][info.actionId]){
        if(stock_info[info.id][info.actionId].actions.length === player_look_back){
            stock_info[info.id][info.actionId].actions.pop();
        }
    } else {
        stock_info[info.id][info.actionId]={
            actions: [],
            lastTrend: false
        };
    }
    stock_info[info.id][info.actionId].actions.unshift(info);
};


const buy_action = (action) => {
    if(!user_actions[action.id]){
        user_actions[action.id] = {}
    }
    if(user_actions[action.id][action.actionId]){
        user_actions[action.id][action.actionId].amount += action.amount;
    } else {
        user_actions[action.id][action.actionId] = action;
    }
    let index = pendingTransactions.findIndex((item) => item.id === action.id && item.actionId === action.actionId);
    pendingTransactions.splice(index, 1)
    // money -= action.amount * action.price;
};

const buy_action_request = (action, amount) => {
    amount = amount || action.amount
    action.amount = amount
    connection.then((conn) => {conn.createChannel().then((ch) => {
        var ok = ch.assertExchange(exchangeName, 'topic', {durable: true});
        let msg = new messages.Stock()
        msg.setId(action.id)
        msg.setActionId(action.actionId)
        msg.setAmount(amount)
        msg.setPrice(action.price)
        ok.then(() => {
            pendingTransactions.unshift(action);
            money -= action.price * action.amount;
            ch.publish(exchangeName, `buy.${login}`, Buffer.from(msg.serializeBinary()));
            return ch.close();
            });
        });
    });
};
const sell_action = (action, amount) => {
    if(!amount){
        amount = user_actions[action.id][actionId].amount
    }
    user_actions[action.id][action.actionId].amount -= amount;
    money += amount * action.price;
    connection.then((conn) => {conn.createChannel().then((ch) => {
        var ok = ch.assertExchange(exchangeName, 'topic', {durable: true});
        let msg = new messages.Stock()
        msg.setId(action.id)
        msg.setActionId(action.actionId)
        msg.setAmount(amount)
        msg.setPrice(action.price)
        ok.then(() => {
            pendingTransactions.unshift(action);
            money -= action.price * action.amount;
            ch.publish(exchangeName, `sell.${login}`, Buffer.from(msg.serializeBinary()));
            return ch.close();
            });
        });
    });
};

const getTrends = (action) => {
    let action_info = stock_info[action.id][action.actionId];
    if(action_info.actions.length !== player_look_back){
        return false
    }
    let yAvgEl = 0; 
    let player_look_back_average_el = 0
    for(let i = 0 ; i < action_info.actions.length; i++){
        yAvgEl += action_info.actions[i].price;
        player_look_back_average_el += i;
    }
    let player_look_back_average = player_look_back_average_el / action_info.actions.length

    let yAvg = yAvgEl / action_info.actions.length;
    let top = 0;
    let down = 0;
    for(let i = 0 ; i < action_info.actions.length; i++){
        top += (i - player_look_back_average) * (action_info.actions[i].price - yAvg);
        down += Math.pow((i - player_look_back_average), 2);
    }
    let newTrend = top/down

    if(action_info.lastTrend === false){
        action_info.lastTrend = newTrend;
        return false;
    } else {
        let diff = ( newTrend - action_info.lastTrend ) / action_info.lastTrend
        action_info.lastTrend = newTrend
        return diff
    }

}

const deserailizer = (msg) => messages.Stock.deserializeBinary(new Uint8Array(msg.content)).toObject()

/**
 * CONNECTIONS
 */

                    connection.then((connector) => connector.createChannel()
                    .then((channel) => {
                        // console.log("channel")
                        const exchange = channel.assertExchange(exchangeName, 'topic', {durable: true});
                        exchange.then(
                            ()=>channel.assertQueue(q1_name, {exclusive: false}).then(
                                (q1) => {
                                    channel.bindQueue(q1.queue, exchangeName, q1_routing);
                                    channel.consume(q1.queue, (msg) => {
                                        let deserialized = deserailizer(msg);
                                        add_stock_info(deserialized);
                                        let trend = getTrends(deserialized)
                                        console.log(trend)
                                        console.log(stock_info)
                                        if(user_actions[deserialized.id] && user_actions[deserialized.id][deserialized.actionId] && trend !== false && trend > 0){
                                            sell_action(deserialized)
                                        }
                                        if(trend !== false && trend > 0){
                                            buy_action_request(deserialized)
                                        }
                                    })
                                }
                            )
                        );
                        exchange.then(
                            ()=>channel.assertQueue(q2_name, {exclusive: false}).then(
                                (q2) => {
                                    channel.bindQueue(q2.queue, exchangeName, q2_routing);
                                    channel.consume(q2.queue, (msg) => {
                                        let deserialized = deserailizer(msg);
                                        console.log(msg.fields.routingKey)
                                        let action = msg.fields.routingKey.split("."[1])
                                        if(action === "buy"){
                                            buy_action(deserialized)
                                        }
                                        // buy_action(deserialized)                                        
                                        // console.log(messages.Stock.deserializeBinary(new Uint8Array(msg.content)).toObject())
                                        // console.log(msg.content.toString());
                                        //     msg.content.toString());
                                    })
                                }
                            )
                        );


        }
    )
);

/**
 * 
 */