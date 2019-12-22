# TON Mixer
This is the second project of my (@dkaraush) submission.

Application and more detailed info: https://tonweb.site/-1:2bcc9840e7b9ec6b77fe3543b4eefbf3ba6c69fd98f362b3d3b2f4b752adb5e8

This project contains application, written in Node.JS, which manages mixer nodes and serves mixer service in TON.

# How does this work?
The idea is too simple. We have at least two nodes: one node will receive, another will send your Grams. When the difference between them is too high, we switch them. So, in Blockchain explorer there would be no connection between them and you can continue selling weapons, slaves and drugs.

In my implementation, there are more than two nodes and you will receive your Grams from few of them, if we don't have enough in one.

Also, I take 5% of your transaction. I also don't calculate fees of transactions, so probably it will also affect on the result.

# Application

You can try it at https://tonweb.site/-1:2bcc9840e7b9ec6b77fe3543b4eefbf3ba6c69fd98f362b3d3b2f4b752adb5e8


# How to deploy?

1. Install fift globally.
2. Clone repository, make `npm install` and `node index`

You can change number of nodes: `node index -n 10`
You can change workchain ID of new nodes: `node index -wc -1`
You can run light version (less update of TUI): `node index --light`
You can take all Grams from all nodes to one wallet by doing `node index --unload <address>`