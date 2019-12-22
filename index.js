/*
	hello. it's me.
*/

require('./utils.js');
const fs = require('fs');

const configFilename = 'config.json';
let config = loadConfig(configFilename, {
	n: arg('-n'),
	log: arg(['-l', '--log', '--logs']),
	wc: arg('-wc', '--wc'),
	ssl: arg('--ssl')
}, {n: 2, wc: -1, log: 'mixer.log', nodes: [], ssl: false});
initLogger(config.log);

if (arg('--unload')) {
	let address = arg('--unload').toLowerCase();
	setTimeout(() => {
		log("Sending Grams from all nodes to " + $white + address + $reset);
		for (let node of mixer.nodes)
			node.sendall(address);
	}, 1500);
}

const TON = require('./ton.js');
const mixer = require('./mixer.js')(config, TON);
const API = require('./api.js');

let orders = {};
let ordersCount = {};
setTimeout(() => {
	log("orders count was cleared.");
	ordersCount = {};
}, 1000 * 60 * 60 * 12);
API(config, {
	// 'max': function (method) {
	// 	if (method != 'GET')
	// 		return null;
	// 	return mixer.max();
	// },
	'order': function (method, query, req) {
		if (!query.address || typeof query.address !== 'string' || 
			 !/^-{0,1}\d{1,}\:[a-fA-F0-9]{64}$/.test(query.address))
			return null;
		let fingerprint = makeFingerprint(req);
		if (ordersCount[fingerprint] > 25) {
			return {status: 'fail', reason: 'flood'};
		};

		if (orders[fingerprint] && orders[fingerprint].expired > Date.now()) {
			let res = mixer.updorder(fingerprint, query.address);
			if (!res)
				return {status: 'fail', reason: 'no available nodes'};
			orders[fingerprint] = res;
			if (!ordersCount[fingerprint])
				ordersCount[fingerprint] = 0;
			ordersCount[fingerprint]++;
			return Object.assign({status: 'ok'}, res);
		} else {
			let res = mixer.order(fingerprint, query.address);
			if (!res)
				return {status: 'fail', reason: 'no available nodes'};
			orders[fingerprint] = res;
			if (!ordersCount[fingerprint])
				ordersCount[fingerprint] = 0;
			ordersCount[fingerprint]++;
			return Object.assign({status: 'ok'}, res);
		}
	}
});
function makeFingerprint(req) {
	return hash(req.connection.remoteAddress);
}
function hash(str) {
	return require('crypto').createHash('sha512').update(str).digest("hex");
}