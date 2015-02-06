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

var token = 'xoxb-3600011794-P3pR190loOzHdpX21lM20V5o', // Add a bot at https://my.slack.com/services/new/bot and copy the token here.
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
        add: new CommandGroup({
            team: new CommandGroup({
                with: new CommandGroup({
                    players: new CommandHandler(addTeamWithPlayers)
                }),
               _default: new CommandHandler(addTeam)
            }),
            win: new CommandGroup({
                for: new CommandGroup({
                    against: new CommandHandler(addWinForTeamAgainst)
                })
            }),
            player: new CommandHandler(addPlayer)
        }),
        list: new CommandGroup({
            teams: new CommandHandler(listTeams)
        })
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

    slack.sendToChannel = function(text) {
        this.message.channel.send('<@' + this.message.user.id + '>, ' + text);
        console.log('@%s sent message "%s"', slack.self.name, text);
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

        var command_arguments = [];

        // Grab arguments between quotes
        text = text.replace(/"([^"]*)"/g, function(m, p1) {
            command_arguments.push(p1);
            return '';
        });
        text = text.replace(/\s{2,}/g, ' '); // Remove double spaces
        text = text.replace(',', ''); // Remove rogue commas

        text = text.trim();

        console.log(text);

        text = text.split(' ');
        text.splice(0, 1);

        slack.message = message;
        slack.message.channel = channel;
        slack.message.user = user;

        text = executeCommand(text, commands, command_arguments);
    }
});

slack.on('error', function(error) {
    console.error('Error: %s', error);
});

function executeCommand(textArray, routes, arguments)
{
    if (routes[textArray[0]] instanceof CommandHandler)
        return routes[textArray.splice(0, 1)].execute(textArray.concat(arguments));

    if (routes[textArray[0]] instanceof CommandGroup)
        return executeCommand(textArray, routes[textArray.splice(0, 1)].commands, arguments);

    if (typeof routes[textArray[0]] == 'undefined')
    {
        if (typeof routes['_default'] != 'undefined')
            return routes['_default'].execute(textArray.concat(arguments));

        return 'invalid command';
    }

    return 'invalid command';
}

function addPlayer(params)
{
    db.client.collection('player').insert({name: params.join(' ')}, function(err, result) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to add the player " + params.join(' ') + " for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        slack.sendToChannel("I added the player \"" + params.join(' ') + "\" for you. You'll need to add them to a team now.");
    });
}

function addTeam(params)
{
    db.client.collection('team').insert({name: params.join(' ')}, function(err, result) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to add the team " + params.join(' ') + " for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        slack.sendToChannel("I have added the team \"" + params.join(' ') + "\" for you. You'll need to add some players to it now.");
    });
}

function addTeamWithPlayers(params)
{
    console.log(params);
    slack.sendToChannel("add team with players");
}

function addWinForTeamAgainst(params)
{
    slack.sendToChannel("add win for team against");
}

function listTeams(params)
{
    db.client.collection('team').find().toArray(function(err, items) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to list the teams for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        var teams = '';
        for (key in items)
        {
           teams += "\n";
           teams += items[key].name; 
        }

        slack.sendToChannel("the current teams are:" + teams);
    });
}

function CommandHandler(handler)
{
    this.handler = handler;

    if (this.handler === null)
        throw "No command handler";

    this.execute = function(arguments)
    {
        return this.handler(arguments);
    }
}

function CommandGroup(commands)
{
    this.commands = commands || null;

    if (this.commands === null)
        throw "No command group commands";
}

slack.login();
slack.joinChannel('test');
