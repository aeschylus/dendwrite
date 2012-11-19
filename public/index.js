
/**
 * TODO + Bugs:
 * - if usr types then deletes and msg.length == 0, remove 'is typing' txt
 * - if the usr types words too long, things break (fix: hyphenation)
 * - if you press enter with no text, your name appears x times on line
 * - site susceptible for XSS (sanitize input)
 */

function craftingResponse(from, msg) {
    console.log('msg: '+msg);

    var typingState = {
        typing : from + " is crafting a response.",
        waiting : from + " is sitting on a message." // TODO
    };

    /**
     * setCharAt 
     * @param {String} str - 
     * @param {Number} index - position o
     * 
     */
    function setCharAt(str,index,chr) {
        if(index > str.length-1) return str;
        return str.substr(0,index) + chr + str.substr(index+1);
    };


    /**
     * When a client types, all other clients will see garbled text
     * - spaces, commas, and other punctuation should appear as plaintext
     *
     * This doesn't apply to the person who is actually typing
     *
     */
    function composeMessage(msg) {    
	// Find the current length of the typing client's message
	var length = msg.length;
	for (x=0; x<length; x++) {
            if (msg[x] === ' ' || msg[x] === '.' || msg[x] === ',' || msg[x] === '!' || msg[x] === '?') {
		msg = setCharAt( msg, x, msg[x]);
            } else {
		msg = setCharAt( msg, x, "n" ); 
            }
	};
	return msg
    }
    composeMessage(msg);

    // function showGarbledText() {

    typingState = typingState.typing;
    typingContainer = '<div class="message typing ' + from + '">'

    // if incoming message container (blue garbling) doesn't exist...
    if (!$('.typing')[0]) {
        $('#messages').append(
            $(typingContainer).append(
                $('<blockquote>').append(
                    $('<h3>' + typingState + '</h3>'),
                    $('<p>'+msg+'</p>'), $('<div class="incomingCursorFlash">'))));
    } else if ($('.typing').find('p').text() === ' ') {
        $( '.typing' ).remove();
    } else {
        $('.typing').find('h3').text(typingState);
        $('.typing').find('p').text(msg);
        $('.incomingCursorFlash').addClass('editing');
    };

    $('.incomingCursorFlash').addClass('editing');
    setTimeout(function() { $('.incomingCursorFlash').removeClass('editing');}, 1);

};

function suburls(msg) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return msg.replace(exp,"<a href='$1'>$1</a>"); 
}


/**
 * Add algo to perform entity tagging
 */
function subtags(msg) {
    return msg;
}

/**
 * Display the message to all clients 
 */
function preprocess(msg) {
    return subtags(suburls(msg));
}

function message (from, msg) {
    msg = preprocess(msg);
    if ( from === 'You' ) {
        $('#messages').append($('<div class="message you">').append($('<h3 class="sender">').text(from), $('<blockquote>').append('<p>'+msg+'</p>')));
    } else {
        $('#messages').append($('<div class="message">').append($('<h3 class="sender">').text(from), $('<blockquote>').append('<p>'+msg+'</p>')));
        $('.typing').remove();
    } 
}

(function () {

    'use strict'

    var Utils = {

        store : function( name, record ) {
            if ( arguments.length > 1) {
                return localStorage.setItem( name, JSON.stringify( record ) );
            }
            else {
                var store = localStorage.getItem( name );
                return ( store && JSON.parse( store ) ) || [];
            }   
        },   

        uuidGen : function() {
            var i, random,
            uuid = '';

            for ( i = 0; i < 32; i++ ) { 
                random = Math.random() * 16 | 0;
                if ( i === 8 || i === 12 || i === 16 || i === 20 ) {
                    uuid += '-';
                }
                uuid += ( i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random) ).toString( 16 );
            }
            return uuid;
        } 
    };  

    $(function() {
        var Dendwrite = {
            init : function(){
                this.defineElements();
                this.bindEvents();
                $('#nick').focus();
            },
            defineElements : function() {
                this.ENTER_KEY = 13;
                this.BACKSPACE = 'herpderp';
                this.$inputCursorFlash = $('#inputCursorFlash');
                this.$input = $('#send-message textarea');
                this.$incoming = $('.incomingCursorFlash');
            },

            bindEvents : function(){
                //
                // socket.io code
                //

                var socket = io.connect();

                socket.on('connect', function () {
                    $('body').addClass('connected');
                });

                socket.on('announcement', function (msg) {
                    $('#messages').append($('<p class="systemStream">').append($('<em>').text(msg)));
                });

                socket.on('nicknames', function (nicknames) {
                    $('#nicknames').empty().append($('<span>Online: </span>'));
                    for (var i in nicknames) {
                        $('#nicknames').append($('<b>').text(nicknames[i]));
                    }
                });

		// sends (message func)
                socket.on('user message', message);

		// sends value of textarea (craftingResponse func)
                socket.on('user typing', craftingResponse);

                socket.on('reconnect', function () {
                    $('#messages').remove();
                    message('System', 'Reconnected to the server');
                });

                socket.on('reconnecting', function () {
                    message('System', 'Attempting to re-connect to the server');
                });

                socket.on('error', function (e) {
                    message('System', e ? e : 'An unknown error occurred');
                });

                $('#send-message textarea').keypress(function (e) {
                    if (e.which === Dendwrite.ENTER_KEY || e.keyCode === Dendwrite.ENTER_KEY) {
                        e.preventDefault();
                        $('#send-message').submit();
                    }
                });
                $('#send-message textarea').on('input', function() {
                    Dendwrite.$inputCursorFlash.addClass('editing');
                    Dendwrite.render.chatInput();
                    socket.emit('user typing', $('#message').val());
                });
                $('#send-message').submit(function () {
                    message('You', $('#message').val());
                    socket.emit('user message', $('#message').val());
                    Dendwrite.render.clear();
                    Dendwrite.render.chatInput();
                    // aad render function to incoming messages that adjusts the scroll-height.
                    return false;
                });
                $('#set-nickname').submit(function (ev) {
                    socket.emit('nickname', $('#nick').val(), function (set) {
                        if (!set) {
                            return $('body').addClass('nickname-set');
                        }
                        $('#nickname-err').css('visibility', 'visible');
                    });
                    Dendwrite.render.clear();
                    return false;
                });
            },
            render : {
                chatInput : function() {
                    this.expandTextarea();
                    this.flash();
                },
                expandTextarea : function() {
                    var area = $('#send-message textarea'); 
                    var mirror = area.parent().find('.mirror');
                    mirror.text(area.val());
                    var mirrorHeight = mirror.height();
                    if (mirrorHeight === 0) {
                        area.height('1.2em');
                    } else {
                        area.height(mirrorHeight);
                    }
                },
                flash : function() {
                    Dendwrite.$inputCursorFlash.removeClass('editing');
                },
                receiving : function() {
                    Dendwrite.$incoming.removeClass('editing');
                },
                clear :function() {
                    Dendwrite.$input.val(null).focus();
                }
            },
            submitMessage : function(e) {
                if (e.which == Dendwrite.ENTER_KEY) {
                    $.submit();
                }
            }
        }

        Dendwrite.init();
    });
})();

