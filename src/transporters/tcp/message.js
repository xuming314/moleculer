/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

/**
 *
 *
 * @class Message
 */
class Message {

	/**
	 * Creates an instance of Message.
	 *
	 * @memberof Message
	 */
	constructor() {
		this.frames = [];
	}

	/**
	 *
	 *
	 * @returns
	 * @memberof Message
	 */
	frameCount() {
		return this.frames.length;
	}

	/**
	 *
	 *
	 * @static
	 * @param {any} buf
	 * @returns
	 * @memberof Message
	 */
	static fromBuffer(buf) {
		const message = new Message();

		if (buf.length >= 3 + 4) {
			if (buf[0] == 0x4d && buf[1] == 0x4f && buf[2] == 0x4c) {
				let offset = 3;
				const length = buf.readUInt32BE(offset);
				offset += 4;

				if (buf.length < 3 + 4 + length)
					throw new Error("Message is short");

				while (offset < 3 + 4 + length) {
					const frameType = buf.readUInt8(offset);
					offset++;

					const frameLength = buf.readUInt32BE(offset);
					offset += 4;

					const data = buf.slice(offset, offset + frameLength);
					offset += frameLength;

					message.addFrame(frameType, data);
				}

			} else
				throw new Error("Invalid message sign");
		} else
			throw new Error("Message has no header");

		return message;
	}

	/**
	 *
	 *
	 * @param {any} type
	 * @param {any} data
	 * @memberof Message
	 */
	addFrame(type, data) {
		this.frames.push([type, data.length, data]);
	}

	/**
	 *
	 *
	 * @param {any} type
	 * @returns
	 * @memberof Message
	 */
	getFrame(type) {
		return this.frames.find(frame => type == frame[0]);
	}

	/**
	 *
	 *
	 * @returns
	 * @memberof Message
	 */
	toBuffer() {
		let offset = 0;
		let length = this.frames.reduce((l, item) => l + 1 + 4 + item[1], 0);

		let buf = Buffer.allocUnsafe(3 + 4 + length);

		// Header
		offset = buf.write("MOL", offset, 3, "ascii");

		// Full message length
		offset = buf.writeUInt32BE(length, offset);

		// Frames
		this.frames.forEach(([type, len, data]) => {
			offset = buf.writeUInt8(type, offset);
			offset = buf.writeUInt32BE(len, offset);

			if (Buffer.isBuffer(data)) {
				offset += data.copy(buf, offset);
			} else {
				offset = buf.write(data, offset, len);
			}
		});

		return buf;
	}
}

module.exports = Message;
