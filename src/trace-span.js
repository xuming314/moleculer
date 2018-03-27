/*
 * moleculer
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

"use strict";

const { generateToken } = require("./utils");

/**
 * Tracing Span class for Context
 *
 * @property {String} id - Context ID
 * @property {ServiceBroker} broker - Broker instance
 * @property {Action} action - Action definition
 * @property {String} [nodeID=null] - Node ID
 * @property {String} parentID - Parent Context ID
 * @property {Boolean} metrics - Need send metrics events
 * @property {Number} [level=1] - Level of Context
 *
 * @class TraceSpan
 */
class TraceSpan {

	/**
	 * Creates an instance of TraceSpan.
	 *
	 * @param {String?} id - Span ID
	 * @param {String} name - Span name
	 * @param {Object} fields - Span fields
	 *
	 * @memberof TraceSpan
	 */
	constructor(broker, id, name, fields, parentID) {
		this.broker = broker;
		this.id = id || generateToken();
		this.name = name;
		this.active = true;

		this.startTime = Date.now();
		this.startHrTime = process.hrtime();
		this.stopTime = null;
		this.duration = 0;

		this.fields = fields;
		this.err = null;

		if (parentID)
			this.parentID = parentID;

		this.spans = [];

		this._sendStart();
	}

	startSpan(name, fields) {
		const span = new TraceSpan(this.broker, null, name, fields, this.id);
		this.spans.push(span);

		return span;
	}

	_sendStart() {
		let payload = {
			id: this.id,
			name: this.name,
			startTime: this.startTime
		};

		if (this.fields)
			Object.assign(payload, this.fields);

		if (this.parentID)
			payload.parent = this.parentID;


		this.broker.emit("metrics.trace.span.start", payload);
	}

	update(fields) {
		if (!this.fields)
			this.fields = fields;
		else
			Object.assign(this.fields, fields);
	}

	finish(err = null) {
		if (!this.active) return;

		this.active = false;

		if (this.startHrTime) {
			let diff = process.hrtime(this.startHrTime);
			this.duration = (diff[0] * 1e3) + (diff[1] / 1e6); // milliseconds with fractions
		}
		this.stopTime = this.startTime + this.duration;

		this.error = err;

		// Close nested active spans
		this.spans.forEach(span => {
			if (span.active)
				span.finish();
		});

		this._sendFinish();
	}

	_sendFinish() {
		let payload = {
			id: this.id,
			name: this.name,
			startTime: this.startTime,
			endTime: this.stopTime,
			duration: this.duration
		};

		if (this.fields)
			Object.assign(payload, this.fields);

		if (this.parentID)
			payload.parent = this.parentID;

		if (this.error) {
			payload.error = {
				name: this.error.name,
				code: this.error.code,
				type: this.error.type,
				message: this.error.message
			};
		}
		this.broker.emit("metrics.trace.span.finish", payload);
	}
}

module.exports = TraceSpan;
