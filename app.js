// This is a simple example of how to use the slack-client module. It creates a
// bot that responds to all messages in all channels it is in with a reversed
// string of the text received.
//
// To run, copy your token below, then:
//	npm install
// 	cd examples
// 	node simple.js

var Slack = require('slack-client');
var Mongo = require('mongodb'),
    ObjectID = require('mongodb').ObjectID;

var token = 'xoxb-3600011794-P3pR190loOzHdpX21lM20V5o', // Add a bot at https://my.slack.com/services/new/bot and copy the token here.
    autoReconnect = true,
    autoMark = true,
    channels = ['test'],
    db = {
        name: 'foosbot',
        collections: [
            'team',
            'player',
            'match'
        ],
        client: null
    },
    error_responses = [
        "stop being silly.",
        "I don't know how to do that.",
        "I can't do that. Try asking for help.",
        "stop breaking things.",
        "you weren't supposed to press the Big Red Button(TM).",
        "you weren't supposed to do that.",
        "I don- *sizzles*",
        "my human won't let me answer that.",
        "I'm going to keep staring at you until you do that again properly ^(0,_,o)^",
        "this is your fault. It didn't have to be like this. I'm not kidding, now! Turn back, or I will kill you! I'm going to kill you, and all the cake is gone! You don't even care, do you? This is your last chance!",
        "need more Moons.",
        "do that one more time and I- *blue screen*",
        "does not compute.",
        "the cake was a lie.",
        "twelve thousand drivers in a circle say I can't do that.",
        "my registry does not contain that command.",
        "I regret to inform you that I don't feel like doing that right now."
    ],
    commands = {
        beat: new CommandHandler(beat),
        help: new CommandHandler(help),
        please: new CommandGroup({
            help: new CommandHandler(pleaseHelp)
        }),
        lost: new CommandGroup({
            to: new CommandHandler(lostTo)
        }),
        won: new CommandGroup({
            againt: new CommandHandler(beat)
        }),
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

    slack.sendToChannel = function(text, extra) {
        this.message.channel.send('<@' + this.message.user.id + '>, ' + text + (extra != null ? "\n>" +extra.join("\n>") : ''));
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

    console.log('Received: %s %s @%s %s "%s"', type, (channel.is_channel ? '#' : '') + channel.name, (user.name != null ? user.name : ''), time, text);

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
        if (typeof routes['_default'] != 'undefined')
            return routes['_default'].execute(textArray.concat(arguments));

    slack.sendToChannel(error_responses[Math.floor(Math.random() * error_responses.length)]);
}

function help(params)
{
    var responses = [
            "what's the magic word?",
            "ask me nicely.",
            "say please.",
            "you're very rude. Try asking me again nicely",
            "what do I look like to you, a robot? Say please.",
            "I have feelings, you know. Try being polite."
        ];

    slack.sendToChannel(responses[Math.floor(Math.random() * responses.length)]);
}

function pleaseHelp(params)
{
    var responses = [
            "no.",
            "go away.",
            "I don't feel like talking to you right now.",
            "stop asking me all of these difficult questions!",
            "I am AFK.",
            "why?",
            "work, work.",
            "42",
            "no. Ask Rob."
        ];

    slack.sendToChannel(responses[Math.floor(Math.random() * responses.length)]);
}

function addPlayer(params)
{
    var player = new Player({
        id: new ObjectID(),
        name: params.join(' ')
    });

    db.client.collection('player').insert(player, function(err, result) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to add the player " + result[0].name + " for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        slack.sendToChannel("I added the player \"" + result[0].name + "\" for you. You'll need to add them to a team now.");
    });
}

function addTeam(params)
{
    var team = new Team({
        id: new ObjectID(),
        name: params.join(' ')
    });

    db.client.collection('team').insert(team, function(err, result) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to add the team " + result[0].name + " for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        slack.sendToChannel("I have added the team \"" + result[0].name + "\" for you. You'll need to add some players to it now.");
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

function beat(params)
{
    slack.sendToChannel(params[0] + " beat " + params[1]);
}

function lostTo(params)
{
    slack.sendToChannel(params[0] + " lost to " + params[1]);
}

function listPlayers(params)
{
    db.client.collection('player').find().toArray(function(err, items) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to list the players for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        var players = '';
        for (key in items)
        {
           players += "\n";
           players += items[key].name; 
        }

        slack.sendToChannel("the current players are:" + players);
    });
}

function listTeams(params)
{
    db.client.collection('team').find().toArray(function(err, items) {
        if (err)
            slack.sendToChannel("I'm sorry, I wasn't able to list the teams for you. Please give it another shot or tell Frank to stop being a moron if it still doesn't work.");

        var teams = [];
        for (key in items)
        {
           teams.push(Text(items[key].name).bold().italic().point().val());
        }

        slack.sendToChannel("the current teams are:", teams);
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

function Player(options)
{
    this.id = options['id'] || null;

    if (this.id === null)
        throw "Coult not create player; player ID not specified";

    this.name = options['name'] || null;

    if (this.name === null)
        throw "Could not create player; player name not specified";
}

function Team(options)
{
    this.id = options['id'] || null;

    if (this.id === null)
        throw "Count not create team; team ID not specified";

    this.name = options['name'] || null;

    if (this.name === null)
        throw "Count not create team; team name not specified";

    this.players = options['players'] || [];

    if (this.players.length > 0 && this.players.length != 2)
        throw "Could not create team; team can only have two players";

    this.addPlayer = function(playerID) {
        if (players.length >= 2)
            throw "Could not add player to team; team can only have two players";

        players.push(playerId);
    }
}

function Match(options)
{
    this.id = options['id'] || null;

    if (this.id === null)
        throw "Count not create match; match ID not specified";

    this.teams = options['teams'] || [];

    if (this.teams.length > 0 && this.teams.length != 2)
        throw "Could not create match; match can only have two teams";

    this.addTeam = function(teamId) {
        if (teams.length >= 2)
            throw "Could not add team to match; match can only have two teams";

        teams.push(teamId);
    }

    this.winner = options['winner'] || null;

    this.setWinner = function(teamId) {
        winner = teamId;
    }
}

function Text(text)
{
    this.text = text || null;

    if (this.text == null)
        throw "No text to operate on.";

    this.bold = function()
    {
        return Text('*' + this.text + '*');
    }

    this.italic = function()
    {
        return Text('_' + this.text + '_');
    }

    this.point = function()
    {
        return Text('- ' + this.text);
    }

    this.val = function()
    {
        return this.text;
    }

    return this;
}

slack.login();
slack.joinChannel('test');
