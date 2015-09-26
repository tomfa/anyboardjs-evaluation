// short for data. "data" variable seems to be overwritten, perhaps by evothings tools, and unavailable
var d = {
    locations: {
        1: "red", // 12228
        2: "black", // 5737
        3: "yellow", // 18330
        4: "green", // 4560
        5: "purple", // 8550
        6: "blue", // 6306
        7: "brown", // 5920
        8: "grey" // 8436
    },
    currentQuestionPos: undefined,
    questions: [
        {
            "question": "Who was the first president of USA?",
            "alternatives": [
                {"text": "Abraham Lincoln", "correct": true },
                {"text": "George Washington", "correct": true },
                {"text": "Simone Mora", "correct": false },
                {"text": "Monica Divitini", "correct": false },
            ],
            "answer": "George Washington bla bla bla bla"
        },
        {
            "question": "From which country comes Samsung?",
            "alternatives": [
                {"text": "Japan", "correct": true },
                {"text": "China", "correct": false },
                {"text": "South Korea", "correct": false },
                {"text": "Nepal", "correct": false },
            ],
            "answer": "Japan bla bla bla bla"
        }
    ],
    devices: {},
    listeners: {},
    players: [],
    colors: ['white', 'green', 'red', 'blue'] // Player colors
};

var ui = {
    initiate: function() {
        $('.activate-next-panel').click(function(){
            $(this).parents('.panel').hide();
            $(this).parents('.panel').next().show();
            logic.trigger($(this).parents('.panel').next()[0].id);
        });
        $('.activate-start-panel').click(function(){
            ui.activatePanel('start');
        });
        $('.discover-bluetooth').click(function(){
            logic.discover();
        });

        $('.activate-question').click(function(){
            ui.nextQuestion();
        });
        $('.activate-answer').click(ui.showAnswer);
    },

    activatePanel: function(panelName) {
        $('.panel:visible').hide();
        $('.panel.panel-' + panelName).show();
        logic.trigger(panelName);
    },

    nextQuestion: function(){
        var question = logic.getNextQuestion();

        if (question) {
            $('.question-wrapper').remove();
            var alternativesHTML = "";
            var alternatives = question.alternatives;
            for (var i = 0; i < alternatives.length; i++) {
                alternativesHTML += '<p class="alternative ' + d.locations[i+3] + '">' +
                '    ' + alternatives[i].text +
                '</p>'
            }
            $('#game').prepend("" +
                '<div class="question-wrapper">' +
                '<p class="question-text">' + question.question + '</p>' +
                alternativesHTML +
                '</div>'
            )
        } else {
            ui.activatePanel('summary');
        }
    },

    showAnswer: function() {
        var question = logic.getCurrentQuestion();
        logic.givePoints();
        $('.question-wrapper').remove();
        $('#game').prepend("" +
            '<div class="question-wrapper">' +
            '<p class="question-text">' + question.question + '</p>' +
            '<p class="answer">Answer: ' + question.answer + '</p>' +
            '<p class="game-instruction">Put your tokens back on black question tile when you\'re ready for the next question</p>' +
            '</div>'
        )
    },

    finishGame: function(){
        $('#summary').prepend('<h4>You finished!</h4>');
        var playersHTML = "";
        for (var index in d.players) {
            playersHTML += '<div class="result"><button class="player-icon ' + d.players[index].color +
            '">&nbsp;</button>' + d.players[index].points + ' poeng</div>';
        }
        $('#summary').append(playersHTML)
    }
};