"use strict";

const ServiceBroker = require("../src/service-broker");
const { MoleculerError } = require("../src/errors");
const _ = require("lodash");

const broker1 = new ServiceBroker({
	nodeID: "node1",
	logger: true,
	logLevel: "info",
	transporter: "NATS",
	metrics: true
});

broker1.createService({
	name: "service1",
	dependencies: ["service2"],
	actions: {
		first(ctx) {
			//return "Hello from first!";
			return ctx.call("service2.second").delay(10);
		}
	},
	events: {
		"metrics.*"(payload, sender, event) {
			this.logger.info(event, payload);
		}

	}
});

broker1.createService(require("moleculer-console-tracer"));

// ----------------------------------------------------------------------

const broker2 = new ServiceBroker({
	nodeID: "node2",
	logger: true,
	logLevel: "info",
	transporter: "NATS",
	metrics: true
});

broker2.createService({
	name: "service2",
	actions: {

		async second(ctx) {
			const span1 = ctx.startSpan("prepare");
			await this.Promise.delay(_.random(5, 30));
			// Do something...
			span1.finish();

			const span2 = ctx.startSpan("batch");
			await this.Promise.delay(_.random(5, 30));
			//return "Hello from second!";
			const res = await this.Promise.all([
				ctx.call("service3.third"),
				ctx.call("service3.third"),
				ctx.call("service3.third"),
				ctx.call("service3.third")
			]);
			await this.Promise.delay(_.random(5, 30));
			span2.finish();

			await this.Promise.delay(_.random(5, 10));

			return res;
		}
	}
});

broker2.createService({
	name: "service3",
	actions: {
		async third(ctx) {
			await this.Promise.delay(_.random(5, 30));
			const span = ctx.startSpan("check random");
			if (ctx.meta.crash && _.random(100) > 80)
				throw new MoleculerError("Random error!", 510);

			await this.Promise.delay(_.random(5, 30));
			span.finish();

			await this.Promise.delay(_.random(25, 75));

			return "Hello from third!";
		}
	}
});

// ----------------------------------------------------------------------

Promise.all([broker1.start(), broker2.start()])
	.then(() => broker1.repl())
	.then(() => broker1.call("service1.first", null, { meta: { crash: true }}))
	.catch(err => broker1.logger.error(err));
