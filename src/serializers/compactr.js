/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

/* UNSTABLE - Not recommended */

"use strict";

const BaseSerializer = require("./base");
const P = require("../packets");

function createSchemas() {
	const Compactr = require("compactr");
	const schemas = {};

	schemas[P.PACKET_EVENT] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		event: { type: "string" },
		data: { type: "string" },
		groups: { type: "array", items: { type: "string" } }
	});

	schemas[P.PACKET_REQUEST] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		id: { type: "string" },
		action: { type: "string" },
		params: { type: "string" },
		meta: { type: "string" },
		timeout: { type: "double" },
		level: { type: "number" },
		metrics: { type: "boolean" },
		parentID: { type: "string" },
		requestID: { type: "string" }
	});

	schemas[P.PACKET_RESPONSE] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		id: { type: "string" },
		success: { type: "boolean" },
		data: { type: [ "null", "string"], default: null },
		error: { type: [ "null", "string"], default: null }
	});

	schemas[P.PACKET_DISCOVER] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" }
	});

	schemas[P.PACKET_INFO] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		services: { type: "string" },
		config: { type: "string" },
		ipList: { type: "array", items: { type: "string" } },
		port: { type: "number" },
		client: { type: "object", schema: {
			type: { type: "string" },
			version: { type: "string" },
			langVersion: { type: "string" }
		}}
	});

	schemas[P.PACKET_DISCONNECT] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
	});

	schemas[P.PACKET_HEARTBEAT] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		cpu: { type: "number" }
	});

	schemas[P.PACKET_PING] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		time: { type: "number" }
	});

	schemas[P.PACKET_PONG] = Compactr.schema({
		ver: { type: "string" },
		sender: { type: "string" },
		time: { type: "number" },
		arrived: { type: "number" }
	});

	return schemas;
}

/**
 * Compactr serializer for Moleculer
 *
 * https://github.com/compactr/compactr.js
 *
 * @class CompactrSerializer
 */
class CompactrSerializer extends BaseSerializer {

	/**
	 * Initialize Serializer
	 *
	 * @param {any} broker
	 *
	 * @memberOf Serializer
	 */
	init(broker) {
		super.init(broker);

		try {
			require("compactr");
		} catch(err) {
			/* istanbul ignore next */
			this.broker.fatal("The 'compactr' package is missing! Please install it with 'npm install compactr --save' command!", err, true);
		}

		this.schemas = createSchemas(broker);
	}

	/**
	 * Serializer a JS object to Buffer
	 *
	 * @param {Object} obj
	 * @param {String} type of packet
	 * @returns {Buffer}
	 *
	 * @memberOf Serializer
	 */
	serialize(obj, type) {
		this.serializeCustomFields(type, obj);

		const t = this.schemas[type].write(obj).buffer();

		return t;
	}

	/**
	 * Deserialize Buffer to JS object
	 *
	 * @param {Buffer} buf
	 * @param {String} type of packet
	 * @returns {Object}
	 *
	 * @memberOf Serializer
	 */
	deserialize(buf, type) {
		const obj = this.schemas[type].read(buf);

		this.deserializeCustomFields(type, obj);

		return obj;
	}
}

module.exports = CompactrSerializer;
