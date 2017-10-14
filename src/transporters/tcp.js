/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

const net 			= require("net");

const Promise		= require("bluebird");
const Transporter 	= require("./base");

const P 			= require("../packets");
const C				= require("./tcp/constants");

const Message		= require("./tcp/message");
const UdpServer		= require("./tcp/udp-server");
const TcpServer		= require("./tcp/tcp-server");

/**
 * Transporter for TCP+UDP communication
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
			udpBroadcastAddress: "255.255.255.255",

			tcpPort: null, // random port
			timeout: 10 * 1000,
		}, this.opts);

		this.connections = {};
	}

	/**
	 * Connect to the server
	 *
	 * @memberOf TcpTransporter
	 */
	connect() {
		return Promise.resolve()
			.then(() => this.startTcpServer())
			.then(() => this.startUdpServer())
			.then(() => {
				this.logger.info("Transporter connected.");
				this.connected = true;
				return this.onConnected();
			});
	}

	startTcpServer() {
		this.tcpServer = new TcpServer(this, this.opts);
		this.tcpServer.on("connect", this.onTcpClientConnected.bind(this));

		return this.tcpServer.listen();
	}

	startUdpServer() {
		this.udpServer = new UdpServer(this, this.opts);

		this.udpServer.on("message", (message, rinfo) => {

			const nodeID = message.getFrameData(C.MSG_FRAME_NODEID).toString();
			if (nodeID && nodeID != this.nodeID) {
				let socket = this.connections[nodeID];

				if (!socket) {
					const port = parseInt(message.getFrameData(C.MSG_FRAME_PORT).toString(), 10);
					TcpServer.connect(rinfo.address, port)
						.then(socket => {
							socket.nodeID = nodeID;
							this.connections[nodeID] = socket;

							this.onTcpClientConnected(socket);

							// Send DISCOVER to this node
							const packet = new P.PacketDiscover(this.transit, nodeID);
							this.publish(packet);
						})
						.catch(err => {
							this.logger.warn(`Can't connect to '${nodeID}' on ${rinfo.address}:${port}`, err);
						});
				}
			}
		});

		this.udpServer.on("message error", (err, msg, rinfo) => {
			this.logger.warn("Invalid UDP packet received!", msg.toString(), rinfo);
		});

		return this.udpServer.bind();
	}

	/**
	 * New TCP socket client is received via TcpServer.
	 * It happens if we broadcast a DISCOVER packet via UDP
	 * and other nodes catch it and connect to our TCP server.
	 * At this point we don't know the socket nodeID. We should
	 * wait for the FIRST DISCOVER packet and expand the NodeID from it.
	 *
	 * @param {Socket} socket
	 * @memberof TcpTransporter
	 */
	onTcpClientConnected(socket) {
		socket.setNoDelay();

		const address = socket.address().address;
		//this.logger.info(address);
		this.logger.info(`TCP client '${address}' is connected.`);

		socket.on("data", msg => {
			//this.logger.info(`TCP client '${address}' data received.`);
			//this.logger.info(msg.toString());

			try {
				const message = Message.fromBuffer(msg);
				const nodeID = message.getFrameData(C.MSG_FRAME_NODEID).toString();
				if (!nodeID)
					throw new Error("Missing nodeID!");

				socket.nodeID = nodeID;
				if (!this.connections[nodeID])
					this.connections[nodeID] = socket;

				const packetType = message.getFrameData(C.MSG_FRAME_PACKETTYPE);
				const packetData = message.getFrameData(C.MSG_FRAME_PACKETDATA);
				if (!packetType || !packetData)
					throw new Error("Missing frames!");

				this.messageHandler(packetType.toString(), packetData);

			} catch(err) {
				this.logger.warn("Invalid TCP message received.", msg.toString(), err);
			}
		});

		socket.on("error", err => {
			this.logger.warn(`TCP client '${address}' error!`, err);
			this.removeSocket(socket);
		});

		socket.on("close", hadError => {
			this.logger.info(`TCP client '${address}' is disconnected! Had error:`, hadError);
			this.removeSocket(socket);
		});
	}

	/**
	 * Close TCP & UDP servers and destroy sockets.
	 *
	 * @memberOf TcpTransporter
	 */
	disconnect() {
		Object.keys(this.connections).forEach(nodeID => {
			const socket = this.connections[nodeID];
			if (!socket.destroyed)
				socket.destroy();
		});

		this.connected = false;
		if (this.TcpServer)
			this.TcpServer.close();

		if (this.udpServer)
			this.udpServer.close();
	}

	/**
	 * Remove a socket from connections
	 *
	 * @param {any} socket
	 * @memberof TcpTransporter
	 */
	removeSocket(socket) {
		if (!socket.destroyed)
			socket.destroy();

		if (socket.nodeID)
			delete this.connections[socket.nodeID];
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
		if (packet.type == P.PACKET_DISCOVER && !packet.target)
			return Promise.resolve();

		const data = packet.serialize();

		return new Promise((resolve, reject) => {

			const message = new Message();
			message.addFrame(C.MSG_FRAME_NODEID, this.nodeID);
			message.addFrame(C.MSG_FRAME_PACKETTYPE, packet.type);
			message.addFrame(C.MSG_FRAME_PACKETDATA, data);
			const payload = message.toBuffer();

			const target = packet.target;
			if (target) {
				const socket = this.connections[target];
				if (socket) {

					socket.write(payload, () => {
						//this.logger.info(`${packet.type} packet sent to ${target}.`);
						resolve();
					});
				} else {
					this.logger.warn(`No live socket to ${target}!`);
					resolve();
				}
			} else {
				if (Object.keys(this.connections) == 0)
					return resolve();

				// TCP broadcast
				Promise.all(Object.keys(this.connections).map(nodeID => {
					const socket = this.connections[nodeID];
					socket.write(payload, () => {
						//this.logger.info(`${packet.type} packet sent to ${target}.`);
						return Promise.resolve();
					});
				})).then(resolve);
			}

		});
	}

}

module.exports = TcpTransporter;
