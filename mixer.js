const fs = require('fs');

class MixerNode {
	constructor(mixer, TON, i, address) {
		this.i = i;
		this.mixer = mixer;

		this.TON = TON;
		this.status = false;

		this.empty = true;
		this.inited = false;
		this.index = i;

		this.todo = [];

		this.seqno = null;

		setLogger('[node #' + i + ']', this);

		this.address = address;
		this.realBalance = 0;
		this.upd();

		this.reserved = false;
		this.reservedUntil = 0;
		this.reservedDest = null;
		this.reservedFingerprint = null;
	}

	balance() {
		let balance = this.realBalance;
		for (let t of this.todo) {
			balance -= t.amount;
		}
		return balance;
	}

	async upd() {
		try {
			let state = await this.TON.accountState(this.address);
			this.status = true;
			this.empty = (!state.success && state.error == 'account state is empty');
			this.inited = !(state.success && state.account && state.account.account && state.account.account.storage.account_storage.state == 'account_uninit');
			if (!this.empty && this.inited && fs.existsSync(MixerNode.bocsDir + this.address + '.boc')) {
				log("deleting init boc external message");
				fs.unlinkSync(MixerNode.bocsDir + this.address + '.boc');
			}

			let wasBalance = this.realBalance;
			this.realBalance = Math.floor((state.success && state.meta ? state.meta.balance : 0) * 1000000000);
			if (wasBalance != this.realBalance) {
				for (let i = 0; i < this.todo.length; ++i) {
					if (this.todo[i].completed) {
						this.todo.splice(i, 1);
						i--;
					}
				}
			}
			if (this.reserved && this.reservedUntil < Date.now())
				this.reserved = false;
			if (wasBalance < this.realBalance && this.reserved) {
				let diff = this.realBalance - wasBalance;
				this.log('received ' + $yellow + GramString(diff) + $reset + ' => executing transaction...');
				diff *= 0.95; // taking 5% of transaction;

				let othernodes = this.mixer.nodes.filter(n => n!=null&&n.balance()>0&&n.i!=this.i);

				let max = othernodes.map(n => n.balance()).reduce((a,b)=>a+b);
				diff = min(diff, max);

				let x = Math.floor(diff);
				othernodes.sort((a, b) => a.balance()>b.balance()?-1:a.balance()<b.balance()?1:0);
				this.log('other nodes:', othernodes.map(n => '#'+n.i).join(', '));
				while (x > 0 && othernodes.length > 0) {
					let i = 0;
					let amount = Math.floor(min(x, Math.max(0, othernodes[i].balance()-MixerNode.minStake)));
					let timeoffset = 1000 * 10;//1000 * 60 + Math.random() * (1000 * 60 * 30);
					this.log('asked ' + $bright + 'node #' + othernodes[i].i + $reset + ' to send ' + $yellow + GramString(amount) + $reset + ' after ' + (~~(timeoffset/100))/10 + 's');
					this.mixer.pushTodo(othernodes[i].i, {
						completed: false,
						amount: amount,
						address: this.reservedDest,
						time: Date.now() + timeoffset
					});

					othernodes.splice(i, 1);
					x -= amount;
				}
				this.reserved = false;
			}

			if (!this.empty && !this.inited) {
				// external message should be sent
				this.sendinit();
			}


			if (!this.empty && this.inited)
				this.seqno = parseInt(state.account.account.storage.account_storage.state.account_active._null.data.just.value['raw@^Cell'].slice(18,18+8), 16);
			
			logRender();

			this.updTodo();
			setTimeout(this.upd.bind(this), 2500);
		} catch (e) {
			this.err(e);
		}
	}

	updTodo() {
		for (let i = 0; i < this.todo.length; ++i) {
			if (this.todo[i].time < Date.now() && !this.todo[i].completed && !this.todo[i].processing) {
				(function (T) {
					T.processing = true;
					this.sendgrams(T.amount, T.address)
						.then(s => {
							if (s) {
								T.completed = true;
								T.processing = false;
								this.mixer.removeTodo(this.i, T);
								logRender();
							}
						});
				}).bind(this)(this.todo[i]);
			}
		}
	}

	async sendinit() {
		this.debug('sendinit()');
		try {
			let res = await this.TON.sendfile(MixerNode.bocsDir + this.address + '.boc');
			if (res.result != 'Ok') {
				this.warn('failed to send init external message:', res);
			} else 
				this.log('init message sent successfully');
		} catch (e) {
			this.warn('failed to send init external message:', e);
		}
	}
	async sendgrams(amount, address) {
		this.debug('sendgrams(' + amount + ',', '"'+address+'")');
		if (amount > max(0, this.realBalance-MixerNode.minStake)) {
			amount = max(0, this.realBalance-MixerNode.minStake);
			this.warn('i don\'t have that money, amount will be:', GramString(amount));
		}
		if (amount <= 0)
			return;
		try {
			let acc = await this.TON.accountState(address), bounce = true;
			if (!acc.success && acc.error == 'account state is empty')
				bounce = false;
			let boc = await this.TON.fiftRun('send.fif', [bounce ? '-1' : '0', this.address, MixerNode.keysDir+this.address+'.pk', address, this.seqno, (Math.floor(amount)).toString()]);
			let res = await this.TON.sendfile(boc);
			if (res.result != 'Ok') {
				this.warn('failed to transfer grams:', res);
			} else
				this.log('transfered ' + $green + 'successfully' + $reset + ' ' + $yellow+GramString(amount)+$reset + ' to ' + $white + address + $reset);
			this.seqno++;
			return true;
		} catch (e) {
			this.warn('failed to transfer grams:', e);
		}
	}
	async sendall(address) {
		this.debug('sendall("'+address+'")');
		this.sendgrams(max(0, this.realBalance-MixerNode.minStake), address);
	}
}
MixerNode.orderExpiration = 1000 * 60 * 4;
MixerNode.minStake = Gram(0.15);
MixerNode._dir = function (name, dirname) {
	MixerNode[name+'Dir'] = dirname;
	if (!fs.existsSync(dirname))
		fs.mkdirSync(dirname);
}
MixerNode._dir('keys', './pk/');
MixerNode._dir('bocs', './bocs/');
MixerNode.new = async function (mixer, TON, i, wc) {
	try {
		let address = (await TON.fiftRun('new.fif', [wc, MixerNode.keysDir, MixerNode.bocsDir])).toString();
		log('['+i+'] created wallet at ' + address);
		return new MixerNode(mixer, TON, i, address);
	} catch (e) {
		fatalerr('failed to create new wallet: ', e);
	}
}

let nodes = [];
global.nodesInfo = function () {
	let gstr = "";
	for (let i = 0, str; i < nodes.length; ++i) {
		str = "";
		if (nodes[i] != null && nodes[i].address)
			str += $white + nodes[i].address + $reset + ' ';
		if (nodes[i] != null && nodes[i].seqno)
			str += $magenta + '#' + _addZeros(nodes[i].seqno,2,' ',false) + $reset + ' ';
		if (typeof nodes[i] === 'undefined' || nodes[i] == null)
			str += $white + nodes[i] + $reset;
		else if (!nodes[i].status)
			str += $white + '(not loaded)' + $reset;
		else if (nodes[i].empty)
			str += $white + '(empty)' + $reset;
		else {
			str += (nodes[i].inited ? $yellow : $cyan) + $bright + GramString(nodes[i].realBalance) + $reset;
			if (nodes[i].balance() != nodes[i].realBalance)
				str += ' => ' + $yellow + $bright + GramString(nodes[i].balance()) + $reset;
		}
		if (nodes[i] != null && nodes[i].reserved)
			str += ' ' + $cyan + 'reserved' + $reset;
		gstr += "[#" + _addZeros(i,2,' ',false) + "] " + str + '\n';
	}
	return gstr;
}

module.exports = function (config, TON) {
	let mixer = {};
	for (let i = 0; i < config.n; ++i) {
		if (i >= config.nodes.length) {
			(async function (i) {
				nodes[i] = await MixerNode.new(mixer, TON, i, config.wc);
				appendConfig({nodes: nodes.map(n => n==null?null:n.address)});
			})(i);
			nodes[i] = null;
		} else {
			nodes[i] = new MixerNode(mixer, TON, i, config.nodes[i]);
			if (config.cache && config.cache.length > i && 
				typeof config.cache[i] !== 'undefined' &&
				config.cache[i] != null) {
				let C = config.cache[i];
				for (let c of C)
					nodes[i].todo.push(c);
			}
		}
	}
	logRender();
	
	mixer.nodes = nodes;
	mixer.pushTodo = (i, obj) => {
		nodes[i].todo.push(obj);
		let cache = config.cache || new Array(nodes.length);
		if (!Array.isArray(cache[i]))
			cache[i] = [];
		cache[i].push(Object.assign(obj,{processing:false}));
		appendConfig({cache});
	};
	mixer.removeTodo = (i, obj) => {
		let cache = config.cache || new Array(nodes.length);
		if (Array.isArray(cache[i])) {
			for (let j = 0; j < cache[i].length; ++j) {
				if (cache[i][j].time == obj.time &&
					cache[i][j].address == obj.address) {
					cache[i].splice(j, 1);
					j--;
				}
			}
			appendConfig({cache});
		}
	}
	mixer.max   = () => nodes.map(n => n==null?0:n.balance()).reduce((a,b)=>a+b);
	mixer.order = (fingerprint, address) => {
		let availableNodes = nodes.filter(n => n!=null&&!n.reserved);
		if (availableNodes.length == 0) {
			warn("no nodes are available for transaction :C");
			return false;
		}
		let nodei = nodes[Math.floor(Math.random() * (availableNodes.length-1))];
		log("choosed " + $bright + 'node #' + nodei.i + $reset + ' for transaction');

		nodei.reserved = true;
		nodei.reservedUntil = Date.now() + MixerNode.orderExpiration;
		nodei.reservedDest = address;
		nodei.reservedFingerprint = fingerprint;
		logRender();

		let max = nodes.filter(n => n!=null&&n.i!=nodei.i).map(a=>Math.max(0,a.balance()-MixerNode.minStake)).reduce((a,b)=>a+b);
		return {
			expireIn: MixerNode.orderExpiration,
			_expired: nodei.reservedUntil,
			address: nodei.address,
			max: max
		};
	};
	mixer.updorder = (fingerprint, newaddress) => {
		let fnodes = nodes.filter(n => n!=null&&n.reserved&&n.reservedFingerprint==fingerprint);
		if (fnodes.length == 0)
			return mixer.order(fingerprint, newaddress);
		fnodes[0].reservedDest = newaddress;
		fnodes[0].reservedUntil = Date.now() + MixerNode.orderExpiration;
		let max = nodes.filter(n => n!=null&&n.i!=fnodes[0].i).map(a=>Math.max(0,a.balance()-MixerNode.minStake)).reduce((a,b)=>a+b);
		return {
			expireIn: MixerNode.orderExpiration,
			_expired: fnodes[0].reservedUntil,
			address: fnodes[0].address,
			max: max
		};
	}
	return mixer;
}