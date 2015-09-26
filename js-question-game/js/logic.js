if (typeof hyper === 'undefined') hyper = console;

var logic = {
    initiate: function() {
        var handleTokenMove = function(options) {
            var token = options.token;
            var constraint = options.constraint;
            hyper.log(token.player.name + " moved to tile " + constraint);
            token.player.location = constraint;
            if (logic.everyOneHasAnswered()) {
                ui.showAnswer();
                return;
            }

            // If the token is the only one, we will not expect any Token-Token events to occur before all (1) token
            // is placed on a tile. Therefore we check if the token is the only one, and trigger the TT-event manually
            // if it is
            if (logic.numberOfConnectedTokens() === 1 && token.player.location === 2) {
                handleTokenTokenTouch({"initiatingToken": token, "respondingToken": token});
            }
        };

        var handleTokenTokenTouch = function(options) {
            var initiatingToken = options.initiatingToken;
            var respondingToken = options.respondingToken;
            if (respondingToken.player.location === 2) {
                hyper.log("handleTokenTokenTouch");
                if (typeof d.currentQuestionPos === "undefined") ui.activatePanel('game');
                else ui.nextQuestion();
            }
        };

        logic.addListener("game", logic.startGame);
        logic.addListener("summary", ui.finishGame);

        logic.addListener("MOVE_TO", handleTokenMove);
        logic.addListener("MOVE_NEXT_TO", handleTokenTokenTouch)
    },

    // Discover bluetooth tokens in proximity
    discover: function() {
        var self = this;

        evothings.easyble.reportDeviceOnce(true);
        evothings.easyble.startScan(function(device){
            hyper.log('Device found: ' + device.name + ' address: ' + device.address + ' rssi: ' + device.rssi);
            device.sendGtHeader = 0x80;
            device.gettingServices = false;
            device.serialChar = null; // Characteristic handle for serial write, set on getServices()
            device.serialDesc = null; // Description for characteristic handle, set on getServices()
            device.singlePacketWrite = true;
            self.addDiscovered(device);
        }, function(errorCode) {
            hyper.log(errorCode)
        });

        setTimeout(function() {evothings.easyble.stopScan();}, 5000);
    },

    // Function to be executed upon having discovered a token
    addDiscovered: function(token) {
        if (!d.devices[token.address]) {
            d.devices[token.address] = token;

            // Add button for token to body
            $('#setup').append('<div class="token center"><button type="button" id="' + token.address +
            '" onclick="logic.connect(' + "'" + token.address + "'" +
            ')" class="grey token">' + token.name + ' </button>' +
            '<button class="player-icon' + '">&nbsp;</button>' + '</div>');

            // Add listener to be executed if the token connects
            logic.addListener('connect', function(token) {
                document.getElementById(token.address).className = 'green token';
                token.color = d.colors.pop();
                token.isConnected = true;
                token.player = {
                    "name": token.color + "-player",
                    "color": token.color,
                    "points": 0,
                    "locations": -1,
                    "token": token
                };
                d.players.push(token.player);
                $(document.getElementById(token.address)).next().addClass(token.color);

                var supportedColors = {
                    'red': [255, 0, 0],
                    'green': [0, 255, 0],
                    'blue': [0, 0, 255],
                    'white': [255, 255, 255]
                };
                var ledOnBitCommand = 129;
                logic._sendOutgoingData(token, new Uint8Array(supportedColors[token.color]).unshift(ledOnBitCommand));
            });

            // Add listener to be executed if the token disconnects
            listener.addListener('disconnect', function(options) {
                var token = options.token;
                token.isConnected = false;
                document.getElementById(token.address).className = 'grey token';
                $(document.getElementById(token.address)).next().removeClass(token.color);
                d.colors.push(token.color);
            })
        }

    },

    _sendOutgoingData: function(device, uint8data, win, fail) {
        evothings.ble.writeCharacteristic(
            device.deviceHandle,
            device.serialChar,
            uint8data,
            function(){ win && win()},
            function(){ fail && fail()}
        );
    },

    _handleIncomingData: function(device, uint8data) {
        var moveBitCommand = 194;
        var cmd = uint8data[0];
        var currentTile = uint8array[1];
        var previousTile = uint8array[2];
        if (cmd === moveBitCommand) {
            logic.trigger("MOVE_TO", {"token": device, "constraint": currentTile});
            logic.addListener("MOVE_NEXT_TO", handleTokenTokenTouch)
        }
        hyper.log(device.address + " moved from " + previousTile + " to " + currentTile);
    },

    _evothingsDisconnect: function(device) {
        device.close();
        device.haveServices = false;
        logic.trigger("disconnect", {"token": device });
    },

    _evothingsConnect: function(device) {
        var requiredCharacteristic = 'a495ff11-c5b1-4b44-b512-1370f02d74de';
        var requiredService = 'a495ff10-c5b1-4b44-b512-1370f02d74de';
        var requiredDescriptor = '00002902-0000-1000-8000-00805f9b34fb';

        device.connect(function() {
            getServices();
        }, function(errorCode) {
            device.haveServices = false;
            fail(errorCode);
        });

        var getServices = function() {
            if (device.gettingServices)
                return;

            var self = device;
            device.gettingServices = true;

            hyper.log('Fetch services for ' + device.address);
            evothings.ble.readAllServiceData(
                device.deviceHandle,
                function(services) {
                    device.services = {};
                    device.characteristics = {};
                    device.descriptors = {};

                    for (var si in services) {
                        var service = services[si];
                        if (service.uuid !== requiredService)
                            continue;

                        device.services[service.uuid] = service;
                        hyper.log('Service: ' + service.uuid);

                        for (var ci in service.characteristics) {
                            var characteristic = service.characteristics[ci];
                            if (characteristic.uuid !== requiredCharacteristic)
                                continue;

                            hyper.log('Characteristic: ' + characteristic.uuid);
                            device.characteristics[characteristic.uuid] = characteristic;

                            for (var di in characteristic.descriptors) {
                                var descriptor = characteristic.descriptors[di];
                                if (descriptor.uuid !== requiredDescriptor)
                                    continue;
                                device.descriptors[descriptor.uuid] = descriptor;
                                device.serialChar = characteristic.handle;
                                device.serialDesc = descriptor.handle;
                            }
                        }
                    }

                    if (device.serialChar) {
                        device.haveServices = true;
                        device.gettingServices = false;
                        logic._evothingsSubscribeToEvents(device, logic._handleIncomingData);
                        logic.trigger('connect', device);
                    }
                    else {
                        device.gettingServices = false;
                        hyper.log('Could not find predefined services for token');
                    }
                },
                function(errorCode) {
                    device.gettingServices = false;
                    hyper.log('Could not fetch services for token ' + device.name + '. ' + errorCode);
                }
            );
        }
    },

    _evothingsSubscribeToEvents: function(device, callback) {
        var enableSubscribeDescriptor = '00002902-0000-1000-8000-00805f9b34fb';
        var notificationCharacteristic = '00002221-0000-1000-8000-00805f9b34fb';

        evothings.ble.writeDescriptor(
            device.deviceHandle,
            device.descriptors[enableSubscribeDescriptor].handle,
            new Uint8Array([1,0])
        );

        evothings.ble.enableNotification(
            device.deviceHandle,
            device.serialChar,
            function(data){
                data = new DataView(data);
                var length = data.byteLength;
                var uint8Data = [];
                for (var i = 0; i < length; i++) {
                    uint8Data.push(data.getUint8(i));
                }
                callback && callback(device, uint8Data);
            },
            function(errorCode){
                hyper.log("Could not subscribe to notifications");
            }
        );
    },

    // Attempts to connect to token.
    connect: function(tokenAddress) {
        var token = d.devices[tokenAddress];

        // If already connecting, stop
        if (document.getElementById(tokenAddress).className.indexOf('blue') !== -1)
            return;

        // If already connected, disconnect
        if (document.getElementById(tokenAddress).className.indexOf('green') !== -1) {
            logic._evothingsDisconnect(token);
            return;
        }
        // Signal that we're attempting to connect
        document.getElementById(tokenAddress).className = 'blue token';

        // Send connect command.
        logic._evothingsConnect(token);
    },

    startGame: function(){
        hyper.log("startGame");
        d.questions = logic.shuffle(d.questions);
        d.currentQuestionPos = -1;
        ui.nextQuestion();
        for (var index in d.players) {
            if (d.players.hasOwnProperty(index))
                d.players[index].points = 0;
        }
    },

    shuffle: function(o){
        for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    },

    addListener: function(name, callback) {
        if (!d.listeners[name])
            d.listeners[name] = [];
        d.listeners[name].push(callback);
    },

    trigger: function(name, options) {
        hyper.log("trigger: " + name);
        if (d.listeners[name]) {
            for (var i = d.listeners[name].length - 1; i >= 0; i--) {
                d.listeners[name][i](options);
            }
        }
    },

    getCurrentQuestion: function() {
        return d.questions[d.currentQuestionPos];
    },

    getNextQuestion: function() {
        hyper.log("nextQuestion");
        d.currentQuestionPos += 1;
        if (d.currentQuestionPos >= d.questions.length) {
            return undefined; // returns undefined if no more questions left
        }
        return d.questions[d.currentQuestionPos];
    },

    givePoints: function() {
        var question = logic.getCurrentQuestion();
        for (var key in d.players) {
            if (d.players.hasOwnProperty(key)) {
                var player = d.players[key];
                var answer = player.location;
                if (question.alternatives.hasOwnProperty(answer-2)) {
                    if (question.alternatives[answer-2].correct)
                        player.points += 1;
                }
            }
        }
    },

    everyOneHasAnswered: function() {
        var tokenSet = d.devices;
        for (var key in tokenSet) {
            if (tokenSet.hasOwnProperty(key) && tokenSet[key].isConnected) {
                if (tokenSet[key].player.location < 3) {
                    return false;
                }
            }
        }
        return true;
    },

    numberOfConnectedTokens: function() {
        var tokenSet = d.devices;
        var numOfConnected = 0;
        for (var key in tokenSet) {
            if (tokenSet.hasOwnProperty(key) && tokenSet[key].isConnected) numOfConnected += 1;
        }
        return numOfConnected;
    }
};