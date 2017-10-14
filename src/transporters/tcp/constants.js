/*
 * moleculer
 * Copyright (c) 2017 Ice Services (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

module.exports = {
	MSG_FRAME_NODEID: 		1,
	MSG_FRAME_PORT: 		2,


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
