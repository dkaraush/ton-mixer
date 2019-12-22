/*
	Hello.

	I have used toncenter.com as a connection to the TON.
	Thanks to @rulon (telegram user)!

	((
		Normally, this toncenter.com should be run locally with mixer node, because toncenter.com compromises all nodes of mixer.
	))

	For wallet creation and transactions I have used my own fift and func scripts. They are a bit the same that are from examples.

	If it is needed, this file could be rewritten to use native tonlibjson.
	However, I had only a half of the week for this project __(TON Web was a stupid idea)__ :D
	(I know, how many guys would say, that they had not enough time and 
	 they would move mountains if they would have more seconds.)

	Author: @dkaraush
	P.S.: Durov(s), hire me!
*/
const fs = require('fs');
const {spawn} = require('child_process');
const {log,debug,warn,err,fatalerr} = logger('[ton.js]');

module.exports = {
	time: function () {
		return _tonmethod('time', []);
	},
	accountState: function (address) {
		return _tonmethod('getaccount', [address]);
	},
	// sendfile(string filename) or
	// sendfile(Buffer buff)
	sendfile: function (file) {
		if (typeof file === 'string')
			file = fs.readFileSync(file); // todo: async
		return _tonmethod('sendboc', [file.toString('base64')]);
	},
	fiftRun: function (script, params) {
		return new Promise((resolve, reject) => {
			debug('fift -s ' + $magenta + script + $reset + ' ' + params.join(' '));
			let fift = spawn('fift', ['-s', script].concat(params));
			let chunks = [];
			fift.stderr.on('data', chunk => chunks.push(chunk));
			fift.stdout.on('data', chunk => chunks.push(chunk));
			fift.on('close', (exitcode) => {
				(exitcode == 0 ? resolve : reject)(
					exitcode == 0 ? 
						Buffer.concat(chunks) :
						Buffer.concat(chunks).toString()
				);
			});
		});
	}
};

// ==========
global.Gram = function (n) {
	if (typeof n === 'undefined')
		return 1000000000; // 1 Gram
	return Math.floor(n * 1000000000);
}
global.GramString = function (n) {
	return (Math.floor(n) / 1000000000) + ' GR$';
}


const https = require('https');
function _GET (methodname, data) {
	return new Promise((resolve, reject) => {
		let req = https.request({
			hostname: 'api.ton.sh',
			path: '/' + methodname + data ? '?' + keys(data).map(k => decodeURIComponent(k)+'='+decodeURIComponent(data[k])).join('&') : '',
			method: 'GET'
		}, (res) => {
			res.on('error', function (e) {
				warn('_GET() res error:', e);
				reject();
			});
			let chunks = [];
			res.on('data', chunk => chunks.push(chunk));
			res.on('end', () => {
				let r = Buffer.concat(chunks).toString();
				try { r = JSON.parse(r); } catch (e) {}
				resolve(r);
			});
		});
		req.on('error', function (e) {
			warn('_GET() req error:', e);
			reject();
		});
		res.end();
	})
}
function _POST (data) {
	return new Promise((resolve, reject) => {
		let req = https.request({
			hostname: 'toncenter.com',
			path: '/api/test/v1',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		}, (res) => {
			res.on('error', function (e) {
				warn('_POST() res error:', e);
				reject();
			});
			let chunks = [];
			res.on('data', chunk => chunks.push(chunk));
			res.on('end', () => {
				let r = Buffer.concat(chunks).toString();
				try { r = JSON.parse(r); } catch (e) {}
				resolve(r);
			})
		});
		req.on('error', function (e) {
			warn('_POST() req error:', e);
			reject();
		});
		if (typeof data === 'object')
			data = JSON.stringify(data);
		req.write(data);
		req.end();
	})
}

function _tonmethod(name, params) {
	//debug('_tonmethod ' + $magenta + $bright + name + ' ' + $reset + $magenta + params.join(' ') + $reset);
	return new Promise((resolve, reject) => {
		_POST({jsonrpc:'2.0',id:1,method:name,params})
			.then(data => {
				if (typeof data === 'object' && data.result)
					resolve(data.result);
				else reject(data);
			})
			.catch(reject);
	});
}