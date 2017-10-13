/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

const net 			= require("net");
const dgram 		= require("dgram");

const Promise		= require("bluebird");
const Transporter 	= require("./base");

const P 			= require("../packets");

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
		this.opts = Object.assign({
			udpAddress: "0.0.0.0",
			udpPort: 60220,
			udpReuseAddr: true,
			tcpPort: null // random
		}, this.opts);

		this.connections = {};
	}

	/**
	 * Connect to the server
	 *
	 * @memberOf TcpTransporter
	 */
	connect() {
		return new Promise((resolve, reject) => {
			this.server = net.createServer(this.onClientConnected.bind(this));
			this.server.on("error", err => {
				this.logger.error("Server error.", err);
				reject(err);
			});

			this.server.listen(this.opts.tcpPort, () => {
				this.port = this.server.address().port;
				this.logger.info(`TCP server is listening on ${this.port}.`);
				this.connected = true;

				return this.startUdpServer()
					.then(() => {
						this.logger.info("Transporter connected.");
						this.onConnected().then(resolve);
					});
			});

		});
	}

	startUdpServer() {
		return new Promise((resolve, reject) => {

			this.udpServer = dgram.createSocket({type: "udp4", reuseAddr: this.opts.udpReuseAddr });

			this.udpServer.on("message", (msg, rinfo) => {
				this.logger.info(`UDP message received from ${rinfo.address}. Size: ${rinfo.size}`);
				this.logger.info(msg.toString());
				const wrapPacket = JSON.parse(msg);

				if (wrapPacket.nodeID == this.broker.nodeID)
					return;

				this.establishConnection(wrapPacket.nodeID, rinfo.address, wrapPacket.port)
					.then(() => {
						this.messageHandler(P.PACKET_DISCOVER, wrapPacket.packet);
					})
					.catch(err => {
						this.logger.warn(`Can't establish connection with ${wrapPacket.nodeID} on ${rinfo.address}:${wrapPacket.port}!`, err);
					});
			});

			this.udpServer.on("error", err => {
				this.logger.error("UDP server error!", err);
				reject(err);
			});

			this.udpServer.bind(this.opts.udpPort, this.opts.udpAddress, () => {
				this.logger.info(`UDP server is listening on ${this.opts.udpAddress}:${this.opts.udpPort}`);
				this.udpServer.setBroadcast(true);
				resolve();
			});
		});
	}


	establishConnection(nodeID, host, port) {
		if (nodeID == this.broker.nodeID)
			return Promise.resolve();

		let socket = this.connections[nodeID];
		if (socket)
			return Promise.resolve(socket);

		const connect = cb => {
			const reconnect = () => {
				setTimeout(() => connect(cb), 1000);
			};

			socket = net.connect({ host, port }, () => {
				this.logger.info(`Connected to ${nodeID}!`);
				this.connections[nodeID] = socket;
				cb(null, socket);
			});

			socket.on("data", msg => {
				this.logger.info("Incoming client data:");
				this.logger.info(msg.toString());

				const wrapPacket = JSON.parse(msg);

				this.messageHandler(wrapPacket.cmd, wrapPacket.packet);
			});

			socket.on("end", () => {
				this.logger.info("Socket disconnected!");
				reconnect();
			});

			socket.on("error", err => {
				if (err.code == "ECONNREFUSED" || err.code == "ECONNRESET") {
					this.logger.info("Socket not available!");
				} else {
					this.logger.warn("Socket client socket error!", err);
				}
				reconnect();
			});

			socket.unref();
		};

		return new Promise((resolve, reject) => {
			connect((err, socket) => {
				if (err)
					return reject(err);
				resolve(socket);
			});
		});
	}

	onClientConnected(socket) {
		const address = socket.address().address;
		this.logger.info(address);
		this.logger.info(`TCP client '${address}' is connected.`);

		socket.on("data", msg => {
			this.logger.info(`TCP client '${address}' data received.`);
			this.logger.info(msg.toString());

			const wrapPacket = JSON.parse(msg);

			if (!this.connections[wrapPacket.nodeID])
				this.connections[wrapPacket.nodeID] = socket;

			this.messageHandler(wrapPacket.cmd, wrapPacket.packet);
		});

		socket.on("error", err => {
			if (err.code !== "ECONNRESET")
				this.logger.warn(`TCP client '${address}' error!`, err);
		});

		socket.on("close", hadError => {
			this.logger.info(`TCP client '${address}' is disconnected! Had error:`, hadError);
		});
	}

	/**
	 * Disconnect from the server
	 *
	 * @memberOf TcpTransporter
	 */
	disconnect() {
		this.connected = false;
		if (this.server)
			this.server.close();

		if (this.udpServer)
			this.udpServer.close();
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
			if (packet.type == P.PACKET_DISCOVER) {
				const wrapPacket = {
					ver: 1,
					nodeID: this.broker.nodeID,
					cmd: packet.type,
					port: this.port,
					packet: data
				};
				this.udpServer.send(JSON.stringify(wrapPacket), this.opts.udpPort, "255.255.255.255", (err, bytes) => {
					if (err) {
						this.logger.warn("Discover packet broadcast error.", err);
						return reject(err);
					}
					this.logger.info(`${packet.type} packet sent. Size: ${bytes}`);
					resolve();
				});
			} else {
				const wrapPacket = {
					ver: 1,
					nodeID: this.broker.nodeID,
					cmd: packet.type,
					packet: data
				};

				const target = packet.target;
				if (target) {
					const socket = this.connections[target];

					if (socket) {
						socket.write(JSON.stringify(wrapPacket), () => {
							this.logger.info(`${packet.type} packet sent to ${target}.`);
							resolve();
						});
					} else {
						this.logger.error("No live socket to ${target}!");
						resolve();
					}
				} else {
					if (Object.keys(this.connections) == 0)
						return resolve();

					const data = JSON.stringify(wrapPacket);
					// TCP broadcast
					Promise.all(Object.keys(this.connections).map(nodeID => {
						const socket = this.connections[nodeID];
						socket.write(data, () => {
							this.logger.info(`${packet.type} packet sent to ${target}.`);
							return Promise.resolve();
						});
					})).then(resolve);
				}

			}
		});
	}

}

module.exports = TcpTransporter;
