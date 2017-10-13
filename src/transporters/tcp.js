/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

const Promise		= require("bluebird");
const Transporter 	= require("./base");

/**
 * Transporter for TCP & UDP communication
 *
 * @class TcpTransporter
 * @extends {Transporter}
 */
class TcpTransporter extends Transporter {

	/**
	 * Creates an instance of TcpTransporter.
	 *
	 * @param {any} opts
	 *
	 * @memberOf TcpTransporter
	 */
	constructor(opts) {
		super(opts);

	}

	/**
	 * Connect to the server
	 *
	 * @memberOf TcpTransporter
	 */
	connect() {
		return new Promise((resolve, reject) => {

		});
	}

	/**
	 * Disconnect from the server
	 *
	 * @memberOf TcpTransporter
	 */
	disconnect() {
	}

	/**
	 * Subscribe to a command
	 *
	 * @param {String} cmd
	 * @param {String} nodeID
	 *
	 * @memberOf TcpTransporter
	 */
	subscribe(cmd, nodeID) {
		return Promise.resolve();
	}

	/**
	 * Publish a packet
	 *
	 * @param {Packet} packet
	 *
	 * @memberOf TcpTransporter
	 */
	publish(packet) {
		const data = packet.serialize();

		return new Promise((resolve, reject) => {

		});
	}

}

module.exports = TcpTransporter;
