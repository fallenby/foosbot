// This is a simple example of how to use the slack-client module. It creates a
// bot that responds to all messages in all channels it is in with a reversed
// string of the text received.
//
// To run, copy your token below, then:
//	npm install
// 	cd examples
// 	node simple.js

var Slack = require('slack-client');
var Mongo = require('mongodb');

var token = 'XXXX', // Add a bot at https://my.slack.com/services/new/bot and copy the token here.
    autoReconnect = true,
    autoMark = true,
    channels = ['test'],
    db = {
        name: 'foosbot',
        collections: [
            'team',
            'player',
            'game'
        ],
        client: null
    },
    commands = {
        add: {
            team: addTeam,
            player: addPlayer
        }
    }

var slack = new Slack(token, autoReconnect, autoMark);

slack.on('open', function() {
    var channels = [],
    groups = [],
    unreads = slack.getUnreadCount(),
        key;

    Mongo.connect('mongodb://localhost:27017/foosbot', function(err, database) {
        if (err)
            console.log("Error connecting to database");

        console.log("");
        console.log("Connected to database");

        db.client = database;

        console.log("Initializing database");
        for (key in db.collections)
        {
            db.client.createCollection(db.collections[key], function(err, coll) {
                if (err)
                    console.log("Error creating '%s' collection", coll.collectionName);

                console.log("Created '%s' collection", coll.collectionName);
            });
        }
    });

    for (key in slack.channels) {
        if (slack.channels[key].is_member) {
            channels.push('#' + slack.channels[key].name);
        }
    }

    for (key in slack.groups) {
        if (slack.groups[key].is_open && !slack.groups[key].is_archived) {
            groups.push(slack.groups[key].name);
        }
    }

    console.log('Welcome to Slack. You are @%s of %s', slack.self.name, slack.team.name);
    console.log('You are in: %s', channels.join(', '));
    console.log('As well as: %s', groups.join(', '));
    console.log('You have %s unread ' + (unreads === 1 ? 'message' : 'messages'), unreads);
});

slack.on('message', function(message) {
    var type = message.type,
    channel = slack.getChannelGroupOrDMByID(message.channel),
    user = slack.getUserByID(message.user),
        time = message.ts,
        text = message.text,
            response = '';

    console.log('Received: %s %s @%s %s "%s"', type, (channel.is_channel ? '#' : '') + channel.name, user.name, time, text);

    if (type === 'message') {
        if (text.split(' ')[0] != ('<@' + slack.self.id + '>'))
            return;

        text = text.split(' ');
        text.splice(0, 1);

        text = traverseCommand(text, commands);

        channel.send('<@' + message.user + '>, ' + text);
        console.log('@%s responded with "%s"', slack.self.name, text);
    }
});

slack.on('error', function(error) {
    console.error('Error: %s', error);
});

function traverseCommand(textArray, routes)
{
    if (typeof routes[textArray[0]] == 'undefined')
        return 'Invalid';

    if (typeof routes[textArray[0]] == 'function')
    {
        textArray.splice(0, 1);
        return routes[textArray[0]](textArray);
    }

    if (typeof routes[textArray[0]] != 'undefined')
    {
        var nextRoute = routes[textArray[0]];
        textArray.splice(0, 1);
        return traverseCommand(textArray, nextRoute);
    }

    return 'Invalid';
}

function addPlayer(params)
{
    return 'Add Player';
}

function addTeam(params)
{
    return 'Add Team';
}

slack.login();
slack.joinChannel('test');
