const fs = require('fs');

// put math methods to global
Object.getOwnPropertyNames(Math).map(function(key){global[key]=Math[key]});

global.arr = function (obj) {
	return Array.prototype.slice.apply(obj);
}
global.keys = function (obj) {
	return Object.keys(obj);
}
global.arg = function (name) {
	let index = process.argv.indexOf(name);
	if (index > 0 && index < process.argv.length-1) {
		let v = process.argv[index+1].trim();
		if (v[0] == '-')
			return true;
		if (/^\d+(?:\.\d+){0,1}$/.test(v))
			v = parseFloat(v);
		return v;
	} else if (index == -1)
		return;
	else return true;
}
let configFilename;
global.loadConfig = function (filename, tochange, def) {
	configFilename = filename;
	try {
		let conf = JSON.parse(fs.readFileSync(filename).toString());
		let hasChanged = false;
		for (let key in def) {
			if (typeof conf[key] === 'undefined') {
				conf[key] = def[key];
				hasChanged = true;
			}
		}
		for (let key in tochange) {
			if (typeof tochange[key] !== 'undefined') {
				conf[key] = tochange[key]
				hasChanged = true;
			}
		}
		if (hasChanged)
			fs.writeFileSync(filename, JSON.stringify(conf, null, '\t'));
		return conf;
	} catch (e) {
		try {
			fs.writeFileSync(filename, JSON.stringify(def, null, '\t'));
			return def;
		} catch (e) {
			console.error(e);
			process.exit(1);
		}
	}
}
global.appendConfig = function (toadd) {
	try {
		let conf = JSON.parse(fs.readFileSync(configFilename).toString());
		let hasChanged = false;
		for (let key in toadd) {
			conf[key] = toadd[key];
		}
		fs.writeFileSync(configFilename, JSON.stringify(conf, null, '\t'));
	} catch (e) {
		warn('failed to append data to config');
	}
}

let logFile = null;
addANSI = (name, symbols) => global[name] = symbols;
addANSI('$reset',"\x1b[0m");
addANSI('$bright',"\x1b[1m");
addANSI('$dim',"\x1b[2m");
addANSI('$underscore',"\x1b[4m");
addANSI('$blink',"\x1b[5m");
addANSI('$reverse',"\x1b[7m");
addANSI('$hidden',"\x1b[8m");
addANSI('$black',"\x1b[30m");
addANSI('$red',"\x1b[31m");
addANSI('$green',"\x1b[32m");
addANSI('$yellow',"\x1b[33m");
addANSI('$blue',"\x1b[34m");
addANSI('$magenta',"\x1b[35m");
addANSI('$cyan',"\x1b[36m");
addANSI('$white',"\x1b[37m");
// bg:
addANSI('$Black',"\x1b[40m"); 
addANSI('$Red',"\x1b[41m");
addANSI('$Green',"\x1b[42m");
addANSI('$Yellow',"\x1b[43m");
addANSI('$Blue',"\x1b[44m");
addANSI('$Magenta',"\x1b[45m");
addANSI('$Cyan',"\x1b[46m");
addANSI('$White',"\x1b[47m");
stripAnsi = s => s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,'');


let logsBuffer = [];
function _str(o) {
	if (o == null)
		return 'null';
	if (o instanceof Error) {
		if (o.stack)
			return o.stack+'';
		return o+'';
	}
	if (typeof o === 'object')
		return JSON.stringify(o);
	return o + '';
}
function _logFunc(tag, prefix, fatal) {
	return function () {
		let args = arr(arguments);
		if (prefix !== null)
			args = [prefix].concat(args);
		let str = tag + ' ' + args.map(_str).join(' ');
		logsBuffer.push(str);
		if (logsBuffer.length > term.height)
			logsBuffer.splice(0, logsBuffer.length - term.height);
		logRender();
		if (logFile != null) {
			fs.appendFile(logFile, '['+_logDate()+'] '+stripAnsi(str) + '\n', function (err) {
				if (err) {
					console.warn(err);
					logFile = null;
				}
			})
		}
		if (fatal)
			process.exit(1);
	}
}
function _logDate() {
	let d = new Date();
	return _addZeros(d.getMonth()+1)+'.'+_addZeros(d.getDate())+'.'+_addZeros(d.getFullYear()-2000)+' '+
		   _addZeros(d.getHours())+':'+_addZeros(d.getMinutes())+':'+_addZeros(d.getSeconds())+'.'+_addZeros(d.getMilliseconds(),3);
}
const wrapAnsi = require('wrap-ansi');
const term = require('terminal-kit').terminal;
global.logRender = function () {
	term.clear();
	let nodesinfo = (typeof global.nodesInfo === 'function' ? global.nodesInfo() : '').split('\n');
	if (nodesinfo[nodesinfo.length-1].length == 0)
		nodesinfo.splice(nodesinfo.length-1, 1);

	term.moveTo(1,1);
	term.grey('╓'+'─'.repeat(term.width-2)+'╖\n');
	term.grey('║');
	term.bold(" Nodes:");
	term.grey(' '.repeat(term.width-9)+'║\n');

	nodesinfo.map(str => {
		term.grey('║ ');
		term(str);
		term.grey(' '.repeat(term.width-4-stripAnsi(str).length)+' ║\n');
	});
	term.grey('╟'+'─'.repeat(term.width-2)+'╢\n')

	let logs = wrapAnsi(logsBuffer.join('\n'),term.width-4,{hard:true,trim:false,wordWrap:false}).split('\n'),
		h = term.height-4-nodesinfo.length;
	for (let i = 0; i < h; i++) {
		term.grey('║ ');
		let j = logs.length-(h-i-1);
		if (j >= 0 && j < logs.length)
			term(logs[j] + ' '.repeat(max(0, term.width-4-stripAnsi(logs[j]).length)));
		else term(' '.repeat(term.width-4));
		term.grey(' ║\n');
	}
	//term.wrapColumn({x: 2, width: term.width-4});
	term.moveTo(1, term.height-1);
	term.grey('╙'+'─'.repeat(term.width-2)+'╜')
}
term.fullscreen();
term.on('resize', logRender);
logRender();

global._addZeros = function (s, n=2, separator='0', dir=true) {
	if (typeof s !== 'string')
		s = s+'';
	return dir?separator.repeat(max(0, n-s.length))+s:s+separator.repeat(max(0, n-s.length));
}
global.initLogger = function (filename) {
	logFile = filename;
	setLogger(null, global);
}
global.setLogger = function (prefix, o) {
	let funcs = logger(prefix);
	keys(funcs).map(k => o[k] = funcs[k]);
}
global.logger = function (prefix) {
	return {
		debug: 		_logFunc($blue+'debug'+$reset, prefix),
		log: 		_logFunc($cyan+'log  '+$reset, prefix),
		warn: 		_logFunc($yellow+'warn '+$reset, prefix),
		err: 		_logFunc($red+'err  '+$reset, prefix),
		fatalerr: 	_logFunc($red+$bright+'fatalerr'+$reset, prefix, 1)
	};
}