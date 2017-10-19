/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

module.exports = {
	MSG_FRAME_NAMESPACE:	1,
	MSG_FRAME_NODEID: 		2,
	MSG_FRAME_PORT: 		3,
	MSG_FRAME_PACKETTYPE: 	4,
	MSG_FRAME_PACKETDATA:	5,


	IGNORABLE_ERRORS: [
		"ECONNREFUSED",
		"ECONNRESET",
		"ETIMEDOUT",
		"EHOSTUNREACH",
		"ENETUNREACH",
		"ENETDOWN",
		"EPIPE",
		"ENOENT"
	]
};
