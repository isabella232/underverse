'use strict';

/**
 * Underverse is backlog state manager. The items in the backlog can have
 * various of states:

 * - undefined: This items is not fetched or received yet.
 * - 0: The item is currently beeing fetched.
 * - 1: The item is fetched
 *
 * The underverse tells you when your id's are out of sync and if there are
 * messages to be fetched. It assumes that your ids are numbers and are issued
 * in order.
 *
 * @constructor
 * @param {Number} size The size of the backlog
 * @api public
 */
function Underverse(size) {
  if (!(this instanceof Underverse)) return new Underverse(size);

  this.size = size || 10000;          // The size of the backlog
  this.ring = new Array(this.size);   // The ring we are going to abuse
  this.cursor = -1;                   // Current position of the cursor
}

Underverse.prototype.__proto__ = require('events').EventEmitter.prototype;

/**
 * A new message is recieved, mark the position of the ring as fetched.
 *
 * @param {Number} id
 * @api public
 */
Underverse.prototype.received = function received(id) {
  this.ring[id] = 1;

  //
  // Check if the message was successor of our previous received message.
  //
  if (this.next(id)) return this.cursor = id;

  //
  // Find all the missing items between the received id and the current cursor
  // position.
  //
  var underverse = this
    , missing;

  missing = this.slice(this.cursor + 1, id).filter(function filter(position) {
    return this.ring[position] === undefined;
  }, this);

  //
  // There aren't items missing, so everything is probably still being fetched.
  //
  if (!missing.length) return;

  this.emit('fetch', missing, function fetching(complete) {
    var state = complete ? 1 : 0;

    missing.forEach(function missing(position) {
      this.ring[position] = state;
    }, this);
  }.bind(this));
};

/**
 * Check if the received messages was is the successor of our previous message.
 *
 * @param {Number} id Message id or index of the backlog
 * @returns {Boolean}
 * @api private
 */
Underverse.prototype.next = function next(id) {
  var overflowing = this.cursor === this.size
    , overflown = overflowing && id === 0;

  //
  // The backlog has overflown as it reached it maxed capacity and the backlog
  // cursor has been reset to 0
  //
  if (overflown) this.overflow();

  return overflown || id - 1 === this.cursor;
};

/**
 * Get a slice of the ring.
 *
 * @param {Number} start The first item that should be sliced of
 * @param {Nunber} until Until this item is reached.
 * @returns {Array}
 * @api private
 */
Underverse.prototype.slice = function slice(start, end) {
  if (start > this.size) start = this.size;
  if (start < 0) start = 0;
  if (end > this.size) end = this.size;
  if (end < 0) end = 0;

  var cursor = start
    , sliced = [];

  //
  // The values are the same return nothing.
  //
  if (end === start) return sliced;

  while (start !== end) {
    sliced.push(cursor);

    cursor = cursor + 1;
    if (cursor === this.size) cursor = 0;
  }

  return sliced;
};