var CardView = (function (window, document, Math) {

var rAF = window.requestAnimationFrame	||
	window.webkitRequestAnimationFrame	||
	window.mozRequestAnimationFrame		||
	window.oRequestAnimationFrame		||
	window.msRequestAnimationFrame		||
	function (callback) { window.setTimeout(callback, 1000 / 60); };

var utils = (function () {
	var me = {};

	var _elementStyle = document.createElement('div').style;
	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransform';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	me.getTime = Date.now || function getTime () { return new Date().getTime(); };

	me.extend = function (target, obj) {
		for ( var i in obj ) {
			target[i] = obj[i];
		}
	};

	me.addEvent = function (el, type, fn, capture) {
		el.addEventListener(type, fn, !!capture);
	};

	me.removeEvent = function (el, type, fn, capture) {
		el.removeEventListener(type, fn, !!capture);
	};

	var _transform = _prefixStyle('transform');

	me.extend(me, {
		hasTransform: _transform !== false,
		hasPerspective: _prefixStyle('perspective') in _elementStyle,
		hasTouch: 'ontouchstart' in window,
		hasPointer: navigator.msPointerEnabled,
		hasTransition: _prefixStyle('transition') in _elementStyle
	});

	me.extend(me.style = {}, {
		transform: _transform,
		transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
		transitionDuration: _prefixStyle('transitionDuration'),
		transformOrigin: _prefixStyle('transformOrigin'),
		perspective: _prefixStyle('perspective'),
		transformStyle: _prefixStyle('transformStyle')
	});

	me.extend(me.eventType = {}, {
		touchstart: 1,
		touchmove: 1,
		touchend: 1,

		mousedown: 2,
		mousemove: 2,
		mouseup: 2,

		MSPointerDown: 3,
		MSPointerMove: 3,
		MSPointerUp: 3
	});

	me.tap = function (e, eventName) {
		var ev = document.createEvent('Event');
		ev.initEvent(eventName, true, true);
		ev.pageX = e.pageX;
		ev.pageY = e.pageY;
		e.target.dispatchEvent(ev);
	};

	return me;
})();

////////////////////////////////////////////////////////////////////////////////////////////////////////

function CardView (el, options) {
	this.wrapper = typeof el == 'string' ? document.querySelector(el) : el;
	this.deck = this.wrapper = this.wrapper.children[0];
	this.cards = this.deck.querySelectorAll('.card');

	this.options = {
		direction: 'v',
		effect: 'rotate',
		startPage: 0,

		deg: 25,
		duration: .28,
		perspective: '300px',
		resizePolling: 100,

		dataset: [],
		onUpdateContent: function () {},

		HWCompositing: true,
		//useTransition: true,	// not yet implemented
		//useTransform: true
	};

	for ( var i in options ) {
		this.options[i] = options[i];
	}

	this.translateZ = this.options.HWCompositing && utils.hasPerspective ? ' translateZ(0)' : '';
	//this.options.useTransition = utils.hasTransition && this.options.useTransition;	// not yet implemented
	//this.options.useTransform = utils.hasTransform && this.options.useTransform;

	this.options.direction = this.options.direction != 'v' && this.options.direction != 'vertical' ? 'h' : 'v';
	this.effect = this.options.effect == 'rotate' || this.options.effect == 'zoom' || this.options.effect == 'slide' ? '_effect' + this.options.effect.charAt(0).toUpperCase() + this.options.effect.slice(1) : '_effectRotate';

	this.page = 0;
	this.pageCount = Math.max(this.options.dataset.length, 3);

	this.wrapper.style[utils.style.perspective] = this.options.perspective;

	for ( var i = 0; i < 3; i++ ) {
		this.cards[i].style[utils.style.transformOrigin] = this.effect == '_effectZoom' ? '50% 50%' : '0 100%';
		this.cards[i].style[utils.style.transitionTimingFunction] = 'ease-out';
	}

	this.refresh();		// get the page size

	this.goToPage(this.options.startPage);		// load initial content

	this._initEvents();

	this.enable();
}

CardView.prototype = {
	handleEvent: function (e) {
		switch ( e.type ) {
			case 'touchstart':
			case 'MSPointerDown':
			case 'mousedown':
				this._start(e);
				break;
			case 'touchmove':
			case 'MSPointerMove':
			case 'mousemove':
				this._move(e);
				break;
			case 'touchend':
			case 'MSPointerUp':
			case 'mouseup':
			case 'touchcancel':
			case 'MSPointerCancel':
			case 'mousecancel':
				this._end(e);
				break;
			case 'orientationchange':
			case 'resize':
				this._resize();
				break;
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this._transitionEnd(e);
				break;
			case 'DOMMouseScroll':
			case 'mousewheel':
				//this._wheel(e);
				break;
			case 'keydown':
				//this._key(e);
				break;
		}
	},

	_initEvents: function (remove) {
		var eventType = remove ? utils.removeEvent : utils.addEvent;

		eventType(window, 'orientationchange', this);
		eventType(window, 'resize', this);

		eventType(this.wrapper, 'mousedown', this);
		eventType(window, 'mousemove', this);
		eventType(window, 'mousecancel', this);
		eventType(window, 'mouseup', this);

		if ( utils.hasPointer ) {
			eventType(this.wrapper, 'MSPointerDown', this);
			eventType(window, 'MSPointerMove', this);
			eventType(window, 'MSPointerCancel', this);
			eventType(window, 'MSPointerUp', this);
		}

		if ( utils.hasTouch ) {
			eventType(this.wrapper, 'touchstart', this);
			eventType(window, 'touchmove', this);
			eventType(window, 'touchcancel', this);
			eventType(window, 'touchend', this);
		}
	},

	destroy: function () {
		this._initEvents(true);

		utils.removeEvent(this.cards[this.currCard], 'transitionend', this);
		utils.removeEvent(this.cards[this.currCard], 'webkitTransitionEnd', this);
		utils.removeEvent(this.cards[this.currCard], 'oTransitionEnd', this);
		utils.removeEvent(this.cards[this.currCard], 'MSTransitionEnd', this);
	},

	refresh: function () {
		this.wrapperSize = this.options.direction == 'v' ? this.wrapper.offsetHeight : this.wrapper.offsetWidth;
	},

	_resize: function () {
		var that = this;

		clearTimeout(this.resizeTimeout);

		this.resizeTimeout = setTimeout(this.refresh.bind(this), this.options.resizePolling);
	},

	_start: function (e) {
		// React to left mouse button only
		if ( utils.eventType[e.type] != 1 ) {
			if ( e.button !== 0 ) {
				return;
			}
		}

		if ( !this.enabled || (this.initiated && utils.eventType[e.type] !== this.initiated) ) {
			return;
		}

		var point = e.touches ? e.touches[0] : e,
			pos;

		this.direction   = 0;
		this.lockedDirection = 0;
		this.cardToMove  = undefined;
		this.cardToStay  = undefined;
		this.flipped     = false;
		this.moved       = false;
		this.initiated	 = utils.eventType[e.type];
		this.startTime   = utils.getTime();
		this.startX      = point.pageX;
		this.startY      = point.pageY;
	},

	_move: function (e) {
		if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
			return;
		}

		var point = e.touches ? e.touches[0] : e,
			distance,
			absDistance,
			direction;

		distance = this.options.direction == 'h' ? -(point.pageX - this.startX) : point.pageY - this.startY;
		absDistance = Math.abs(distance);
		this.direction = -distance / absDistance;

		// We need to move at least 10 pixels to initiate
		if ( absDistance < 10 ) {
			return;
		}

		this.moved = true;

		e.preventDefault();
		e.stopPropagation();

		if ( this.direction != this.lockedDirection || this.cardToMove === undefined ) {
			this.cardToMove = this.direction > 0 ? this.nextCard : this.currCard;
			this.lockedDirection = this.direction;

			this[this.effect + 'Init']();
		}

		if ( absDistance < this.wrapperSize / 3 ) {
			this[this.effect + 'Move'](distance);
		} else {
			this.flipped = true;
			this[this.effect + 'Close'](distance);
		}
	},

	_end: function (e) {
		if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
			return;
		}

		this.initiated = 0;

		if ( !this.moved ) {
			return;
		}

		this.disable();

		this[this.effect + 'End']();

		var cardToMove = this.cards[this.cardToMove];

		utils.addEvent(cardToMove, 'transitionend', this);
		utils.addEvent(cardToMove, 'webkitTransitionEnd', this);
		utils.addEvent(cardToMove, 'oTransitionEnd', this);
		utils.addEvent(cardToMove, 'MSTransitionEnd', this);
	},

	_transitionEnd: function (e) {
		if ( e.target != this.cards[this.cardToMove] ) {
			return;
		}

		utils.removeEvent(this.cards[this.cardToMove], 'transitionend', this);
		utils.removeEvent(this.cards[this.cardToMove], 'webkitTransitionEnd', this);
		utils.removeEvent(this.cards[this.cardToMove], 'oTransitionEnd', this);
		utils.removeEvent(this.cards[this.cardToMove], 'MSTransitionEnd', this);

		this.cards[this.currCard].style[utils.style.transitionDuration] = '0s';
		this.cards[this.prevCard].style[utils.style.transitionDuration] = '0s';
		this.cards[this.nextCard].style[utils.style.transitionDuration] = '0s';

		if ( !this.flipped ) {
			this.enable();
			return;
		}

		this.page += this.direction;
		if ( this.page >= this.pageCount ) {
			this.page = 0;
		} else if ( this.page < 0 ) {
			this.page = this.pageCount - 1;
		}

		this.currCard += this.direction;
		if ( this.currCard >= 3 ) {
			this.currCard = 0;
		} else if ( this.currCard < 0 ) {
			this.currCard = 2;
		}

		//this.page - Math.floor(this.page / 3) * 3;

		this.prevCard = this.currCard - 1;
		if ( this.prevCard < 0 ) {
			this.prevCard = 2;
		}

		this.nextCard = this.currCard + 1;
		if ( this.nextCard == 3 ) {
			this.nextCard = 0;
		}

		this._arrangeCards();

		//setTimeout(this._updateContent.bind(this), 0);
		this._updateContent();
	},

	_arrangeCards: function () {
		this.cards[this.currCard].style.zIndex = '100';
		this.cards[this.nextCard].style.zIndex = '101';
		this.cards[this.prevCard].style.zIndex = '99';

		this.cards[this.currCard].style[utils.style.transform] = 'translate(0,0)' + this.translateZ;
		this.cards[this.prevCard].style[utils.style.transform] = 'translate(' + (this.options.direction == 'v' ? '100%,0' : '0,100%') + ')' + this.translateZ;
		this.cards[this.nextCard].style[utils.style.transform] = 'translate(' + (this.options.direction == 'v' ? '0,100%' : '100%,0') + ')' + this.translateZ;
	},

	_updateContent: function () {
		var newPage = this.page + this.direction,
			cardToUpdate = this.direction > 0 ? this.nextCard : this.prevCard;

		if ( newPage < 0 ) {
			newPage = this.pageCount - 1;
		} else if ( newPage >= this.pageCount ) {
			newPage = 0;
		}

		this.options.onUpdateContent(this.cards[cardToUpdate], this.options.dataset[newPage]);

		this.enable();
	},

	goToPage: function (n) {
		if ( n == 'last' ) {
			n = this.pageCount - 1;
		} else if ( n == 'prev' ) {
			n--;
		} else if ( n == 'next' ) {
			n++;
		}

		if ( n < 0 ) {
			n = 0;
		} else if ( n >= this.pageCount ) {
			n = this.pageCount - 1;
		}

		var prev = n - 1,
			next = n + 1;

		if ( prev < 0 ) {
			prev = this.pageCount - 1;
		}

		if ( next >= this.pageCount ) {
			next = 0;
		}

		this.prevCard = 2;
		this.currCard = 0;
		this.nextCard = 1;

		this.options.onUpdateContent(this.cards[this.currCard], this.options.dataset[n]);
		this.options.onUpdateContent(this.cards[this.nextCard], this.options.dataset[next]);
		this.options.onUpdateContent(this.cards[this.prevCard], this.options.dataset[prev]);

		this._arrangeCards();
	},

	enable: function () {
		this.enabled = true;
	},

	disable: function () {
		this.enabled = false;
	},



	/**********************************************
	 *
	 * Effect Rotate
	 *
	 **********************************************/
	_effectRotateInit: function () {
		if ( this.direction < 0 ) {
			if ( this.options.direction == 'v' ) {
				this.cardToMove = this.currCard;
				this.cardToStay = this.prevCard;
			} else {
				this.cardToMove = this.currCard;
				this.cardToStay = this.prevCard;
			}
		} else {
			if ( this.options.direction == 'v' ) {
				this.cardToMove = this.nextCard;
				this.cardToStay = this.currCard;
			} else {
				this.cardToMove = this.nextCard;
				this.cardToStay = this.currCard;
			}
		}

		var cardToStay = this.cards[this.cardToStay].style;

		if ( this.direction < 0 ) {
			if ( this.options.direction == 'v' ) {
				cardToStay[utils.style.transform] = 'rotateX(0deg) translate(100%,0)' + this.translateZ;
			} else {
				cardToStay[utils.style.transform] = 'rotateY(' + this.options.deg + 'deg) translate(0,0)' + this.translateZ;
			}
		} else {
			if ( this.options.direction == 'v' ) {
				cardToStay[utils.style.transform] = 'rotateX(' + this.options.deg + 'deg) translate(0,0)' + this.translateZ;
			} else {
				//cardToStay[utils.style.transform] = 'rotateY(0deg) translate(0,0)' + this.translateZ;
			}
		}
	},

	_effectRotateEnd: function () {
		var cardToMove = this.cards[this.cardToMove].style,
			cardToStay = this.cards[this.cardToStay].style;

		cardToMove[utils.style.transitionDuration] = this.options.duration + 's';
		cardToStay[utils.style.transitionDuration] = this.options.duration + 's';

		if ( this.direction > 0 ) {
			if ( this.options.direction == 'v' ) {
				cardToMove[utils.style.transform] = 'rotateX(0deg) translate(0,100%)' + this.translateZ;
				cardToStay[utils.style.transform] = 'rotateX(0deg)' + this.translateZ;
			} else {
				cardToMove[utils.style.transform] = 'rotateY(-' + this.options.deg + 'deg) translate(-100%,0)' + this.translateZ;
				cardToStay[utils.style.transform] = 'rotateY(0deg)' + this.translateZ;
			}
		} else {
			if ( this.options.direction == 'v' ) {
				cardToMove[utils.style.transform] = 'rotateX(0deg) translate(0,0)' + this.translateZ;
				cardToStay[utils.style.transform] = 'rotateX(' + this.options.deg + 'deg)' + this.translateZ;
			} else {
				cardToMove[utils.style.transform] = 'rotateY(0deg) translate(0,0)' + this.translateZ;
				cardToStay[utils.style.transform] = 'rotateY(' + this.options.deg + 'deg)' + this.translateZ;
			}
		}
	},

	_effectRotateMove: function (distance) {
		var degCardToStay, degCardToMove;

		if ( this.options.direction == 'v' ) {
			if ( this.direction > 0 ) {
				degCardToStay = this.options.deg / this.wrapperSize * Math.abs(distance);
				degCardToMove = Math.min(-this.options.deg + this.options.deg / (this.wrapperSize / 1.2) * Math.abs(distance), 0);
				distance = 100 + 100 / this.wrapperSize * distance;
			} else {
				degCardToStay = this.options.deg - this.options.deg / this.wrapperSize * Math.abs(distance);
				degCardToMove = Math.min(-this.options.deg / (this.wrapperSize / 1.2) * Math.abs(distance), 0);
				distance = 100 / this.wrapperSize * distance;
			}

			this.cards[this.cardToMove].style[utils.style.transform] = 'rotateX(' + degCardToMove + 'deg) translate(0,' + distance + '%)' + this.translateZ;
			this.cards[this.cardToStay].style[utils.style.transform] = 'rotateX(' + degCardToStay + 'deg)' + this.translateZ;
		} else {
			if ( this.direction > 0 ) {
				degCardToStay = -this.options.deg / this.wrapperSize * Math.abs(distance);
				degCardToMove = Math.min(-this.options.deg + this.options.deg / (this.wrapperSize / 1.2) * Math.abs(distance), 0);
				distance = -100 - 100 / this.wrapperSize * distance;
			} else {
				degCardToStay = Math.min(-this.options.deg + this.options.deg / (this.wrapperSize / 1.2) * Math.abs(distance), 0);
				degCardToMove = -this.options.deg / this.wrapperSize * Math.abs(distance);
				distance = -100 / this.wrapperSize * distance;
			}

			this.cards[this.cardToMove].style[utils.style.transform] = 'rotateY(' + degCardToMove + 'deg) translate(' + distance + '%,0)' + this.translateZ;
			this.cards[this.cardToStay].style[utils.style.transform] = 'rotateY(' + -degCardToStay + 'deg)' + this.translateZ;
		}
	},

	_effectRotateClose: function () {
		var cardToMove = this.cards[this.cardToMove],
			cardToStay = this.cards[this.cardToStay];

		this.initiated = 0;
		this.disable();

		cardToMove.style[utils.style.transitionDuration] = this.options.duration + 's';
		cardToStay.style[utils.style.transitionDuration] = this.options.duration + 's';

		if ( this.direction > 0 ) {
			if ( this.options.direction == 'v' ) {
				cardToMove.style[utils.style.transform] = 'rotateX(0deg) translate(0,0)' + this.translateZ;
				cardToStay.style[utils.style.transform] = 'rotateX(' + this.options.deg + 'deg)' + this.translateZ;
			} else {
				cardToMove.style[utils.style.transform] = 'rotateY(0deg) translate(0,0)' + this.translateZ;
				cardToStay.style[utils.style.transform] = 'rotateY(' + this.options.deg + 'deg)' + this.translateZ;
			}
		} else {
			if ( this.options.direction == 'v' ) {
				cardToMove.style[utils.style.transform] = 'rotateX(-' + this.options.deg + 'deg) translate(0,100%)' + this.translateZ;
				cardToStay.style[utils.style.transform] = 'rotateX(0deg)' + this.translateZ;
			} else {
				cardToMove.style[utils.style.transform] = 'rotateY(-' + this.options.deg + 'deg) translate(-100%,0)' + this.translateZ;
				cardToStay.style[utils.style.transform] = 'rotateY(0deg)' + this.translateZ;
			}
		}

		utils.addEvent(cardToMove, 'transitionend', this);
		utils.addEvent(cardToMove, 'webkitTransitionEnd', this);
		utils.addEvent(cardToMove, 'oTransitionEnd', this);
		utils.addEvent(cardToMove, 'MSTransitionEnd', this);
	},


	/**********************************************
	 *
	 * Effect Zoom
	 *
	 **********************************************/
	_effectZoomInit: function () {
		if ( this.direction < 0 ) {
			this.cardToMove = this.currCard;
			this.cardToStay = this.prevCard;
		} else {
			this.cardToMove = this.nextCard;
			this.cardToStay = this.currCard;
		}

		var cardToStay = this.cards[this.cardToStay].style,
			cardToMove = this.cards[this.cardToMove].style;

		if ( this.direction < 0 ) {
			cardToStay[utils.style.transform] = 'translate(0,0) scale(0.5)' + this.translateZ;
			cardToStay.opacity = '0';
		} else {
			cardToMove[utils.style.transform] = 'translate(0,0) scale(2)' + this.translateZ;
			cardToMove.opacity = '0';
		}
	},

	_effectZoomEnd: function () {
		var cardToMove = this.cards[this.cardToMove].style,
			cardToStay = this.cards[this.cardToStay].style;

		cardToMove[utils.style.transitionDuration] = this.options.duration + 's';
		cardToStay[utils.style.transitionDuration] = this.options.duration + 's';

		if ( this.direction > 0 ) {
			cardToMove[utils.style.transform] = 'scale(2)' + this.translateZ;
			cardToMove.opacity = '0';
			cardToStay[utils.style.transform] = 'scale(1)' + this.translateZ;
			cardToStay.opacity = '1';
		} else {
			cardToMove[utils.style.transform] = 'scale(1)' + this.translateZ;
			cardToMove.opacity = '1';
			cardToStay[utils.style.transform] = 'scale(.5)' + this.translateZ;
		}
	},

	_effectZoomMove: function (distance) {
		var scaleCardToStay,
			scaleCardToMove,
			opacity;

		opacity = Math.min(1 / this.wrapperSize * Math.abs(distance) * 1.5, 1);

		if ( this.direction > 0 ) {
			scaleCardToStay = 1 - .5 / this.wrapperSize * Math.abs(distance);
			scaleCardToMove = 2 - 2 / this.wrapperSize * Math.abs(distance);

			this.cards[this.cardToMove].style[utils.style.transform] = 'scale(' + scaleCardToMove + ')' + this.translateZ;
			this.cards[this.cardToMove].style.opacity = opacity;
			this.cards[this.cardToStay].style[utils.style.transform] = 'scale(' + scaleCardToStay + ')' + this.translateZ;
			this.cards[this.cardToStay].style.opacity = 1 - opacity;
		} else {
			scaleCardToStay = .5 + .5 / this.wrapperSize * Math.abs(distance);
			scaleCardToMove = 1 + 1 / this.wrapperSize * Math.abs(distance);

			this.cards[this.cardToMove].style[utils.style.transform] = 'scale(' + scaleCardToMove + ')' + this.translateZ;
			this.cards[this.cardToMove].style.opacity = 1 - opacity;
			this.cards[this.cardToStay].style[utils.style.transform] = 'scale(' + scaleCardToStay + ')' + this.translateZ;
			this.cards[this.cardToStay].style.opacity = opacity;
		}

	},

	_effectZoomClose: function () {
		var cardToMove = this.cards[this.cardToMove],
			cardToStay = this.cards[this.cardToStay];

		this.initiated = 0;
		this.disable();

		cardToMove.style[utils.style.transitionDuration] = this.options.duration + 's';
		cardToStay.style[utils.style.transitionDuration] = this.options.duration + 's';

		if ( this.direction > 0 ) {
			cardToMove.style[utils.style.transform] = 'scale(1)' + this.translateZ;
			cardToMove.style.opacity = '1';
			cardToStay.style[utils.style.transform] = 'scale(.5)';
		} else {
			cardToMove.style[utils.style.transform] = 'scale(2)' + this.translateZ;
			cardToMove.style.opacity = '0';
			cardToStay.style[utils.style.transform] = 'scale(1)';
			cardToStay.style.opacity = '1';
		}

		utils.addEvent(cardToMove, 'transitionend', this);
		utils.addEvent(cardToMove, 'webkitTransitionEnd', this);
		utils.addEvent(cardToMove, 'oTransitionEnd', this);
		utils.addEvent(cardToMove, 'MSTransitionEnd', this);
	},


	/**********************************************
	 *
	 * Effect Slide
	 *
	 **********************************************/
	_effectSlideInit: function () {
		if ( this.direction < 0 ) {
			if ( this.options.direction == 'v' ) {
				this.cardToMove = this.currCard;
				this.cardToStay = this.prevCard;
			} else {
				this.cardToMove = this.currCard;
				this.cardToStay = this.prevCard;
			}
		} else {
			if ( this.options.direction == 'v' ) {
				this.cardToMove = this.nextCard;
				this.cardToStay = this.currCard;
			} else {
				this.cardToMove = this.nextCard;
				this.cardToStay = this.currCard;
			}
		}

		var cardToStay = this.cards[this.cardToStay].style;
		cardToStay[utils.style.transform] = 'translate(0,0)' + this.translateZ;
	},

	_effectSlideEnd: function () {
		var cardToMove = this.cards[this.cardToMove].style,
			cardToStay = this.cards[this.cardToStay].style;

		cardToMove[utils.style.transitionDuration] = this.options.duration + 's';
		cardToStay[utils.style.transitionDuration] = this.options.duration + 's';

		if ( this.direction > 0 ) {
			if ( this.options.direction == 'v' ) {
				cardToMove[utils.style.transform] = 'translate(0,100%)' + this.translateZ;
			} else {
				cardToMove[utils.style.transform] = 'translate(-100%,0)' + this.translateZ;
			}
		} else {
			cardToMove[utils.style.transform] = 'translate(0,0)' + this.translateZ;
		}
	},

	_effectSlideMove: function (distance) {
		if ( this.options.direction == 'v' ) {
			if ( this.direction > 0 ) {
				distance = 100 + 100 / this.wrapperSize * distance;
			} else {
				distance = 100 / this.wrapperSize * distance;
			}

			this.cards[this.cardToMove].style[utils.style.transform] = 'translate(0,' + distance + '%)' + this.translateZ;
		} else {
			if ( this.direction > 0 ) {
				distance = -100 - 100 / this.wrapperSize * distance;
			} else {
				distance = -100 / this.wrapperSize * distance;
			}

			this.cards[this.cardToMove].style[utils.style.transform] = 'translate(' + distance + '%,0)' + this.translateZ;
		}
	},

	_effectSlideClose: function () {
		var cardToMove = this.cards[this.cardToMove],
			cardToStay = this.cards[this.cardToStay];

		this.initiated = 0;
		this.disable();

		cardToMove.style[utils.style.transitionDuration] = this.options.duration + 's';
		cardToStay.style[utils.style.transitionDuration] = this.options.duration + 's';

		if ( this.direction > 0 ) {
			cardToMove.style[utils.style.transform] = 'translate(0,0)' + this.translateZ;
		} else {
			if ( this.options.direction == 'v' ) {
				cardToMove.style[utils.style.transform] = 'translate(0,100%)' + this.translateZ;
			} else {
				cardToMove.style[utils.style.transform] = 'translate(-100%,0)' + this.translateZ;
			}
		}

		utils.addEvent(cardToMove, 'transitionend', this);
		utils.addEvent(cardToMove, 'webkitTransitionEnd', this);
		utils.addEvent(cardToMove, 'oTransitionEnd', this);
		utils.addEvent(cardToMove, 'MSTransitionEnd', this);
	}

};

return CardView;

})(window, document, Math);