const fs = require('fs');
const http = require('http');
const https = require('https');

module.exports = function (config, methods) {
	if (config.ssl) {
		https.createServer({
			cert: fs.readFileSync("cert.pem"),
			key: fs.readFileSync("key.pem")
		}, _api(methods)).listen(443);
		http.createServer(_redirect()).listen(80);
	} else {
		http.createServer(_api(methods)).listen(80);
	}
}

function _api(methods) {
	return function (req, res) {
		let url = req.url.slice(1);
		if (url.indexOf('?') >= 0)
			url = url.substring(0, url.indexOf('?'));
		let methodname = url.split('/')[0].trim().toLowerCase();
		if (typeof methods[methodname] === 'undefined') {
			res.statusCode = 400;
			res.end();
			return;
		}

		let query = parsequery(req.url);
		let result = methods[methodname](req.method, query, req);
		if (result == null || typeof result === 'undefined') {
			res.statusCode = 400;
			res.end();
			return;
		}
		if (result instanceof Promise) {
			result
				.then(res => {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(res));
				})
				.catch(e => {
					res.statusCode = 500;
					res.end(e + '');
				});
		} else {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(result));
		}
	}
}

function _redirect() {
	return function (req, res) {
		let host = req.headers.host;
		res.statusCode = 301;
		res.setHeader("Location", 'https://'+host.replace('http://','')+req.url);
		res.end();
	}
}

function parsequery(url) {
	let o = {};
	if (url.indexOf('?') < 0)
		return o;
	let q = url.substring(url.indexOf('?')+1);
	let params = q.split('&');
	for (let param of params) {
		if (param.indexOf('=') < 0) {
			o[decodeURIComponent(param)] = true;
		} else {
			o[decodeURIComponent(param.substring(0, param.indexOf('=')))] = decodeURIComponent(param.substring(param.indexOf('=')+1));
		}
	}
	return o;
}