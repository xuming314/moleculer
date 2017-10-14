/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

const Promise		= require("bluebird");
const net 			= require("net");

const { IGNORABLE_ERRORS }	= require("./constants");

class Socket {

	constructor(socket) {
		this._socket = socket;

		// If already connected
		if (socket)
			this.addEventHandlers();
	}

	static connect(host, port) {
		this.host = host;
		this.port = port;

		return new Promise((resolve, reject) => {
			const socket = net.connect({ host, port }, () => {
				resolve(new Socket(socket));
			});

			socket.on("error", err => {
				if (IGNORABLE_ERRORS.indexOf(err.code) !== -1)
					reject(err);
			});
		});
	}

	/*reconnect() {
		setTimeout(() => this.connect(cb), 1000);
	}*/

	addEventHandlers() {
		this._socket.setNoDelay();

		this._socket.on("data", msg => {
			this.logger.info("Incoming client data:");
			this.logger.info(msg.toString());

			const wrapPacket = JSON.parse(msg);

			this.messageHandler(wrapPacket.cmd, wrapPacket.packet);
		});

		this._socket.on("end", () => {
			this.logger.info("Socket disconnected!");
		});

		this._socket.on("error", err => {
			if (IGNORABLE_ERRORS.indexOf(err.code) === -1) {
				this.logger.warn("Socket client socket error!", err);
			}
		});

		this._socket.on("timeout", () => {
			this.logger.info("Socket timeout!");
		});

		if (this.opts.timeout > 0)
			this._socket.setTimeout(this.opts.timeout);

		this._socket.unref();
	}

}

module.exports = Socket;
