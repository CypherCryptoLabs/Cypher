### Cypher:
Cypher is a new Blockchain, that aims to provide a decentralized live messenger service. To make it attractive for people to run a "Node" to support the Cypher Network, there is a Cryptocurrency that will be based on the Cypher Blockchain called "Cypher".

### Contribute:
You can simply create a Pull request, I will take a look at your code, and either accept your PR, or give you feedback. Your Pull request should only contain Bug-fixes, or complete a feature/goal in the "TODO" list. All Pull requests that do not follow these 2 simple rules will NOT be accepted!

### Installation:
This tutorial uses the commands for GNU/Linux, if you are using anything different, the commands may not work as expected. I assume you have ```git``` installed on your system, if that's not the case, please do that now.

Download the Codebase:
```
git clone https://github.com/michelbarnich/cypher.git
```

Next you need Node.js and NPM. The instructions on how to install these 2 components depends on the OS that you are using.
Finally, you can install all dependencies:
```
cd cypher/src
npm install --save
```

After installing all dependencies, you should remove the ```private.pem``` file that is used for testing, and the ```blockchain.json``` that is only used for testing as well. The node will automatically regenerate the ```private.pem```file at startup. You need to recreate the ```blockchain.json```file yourself. This functionality will be added to the ```test.js```script in the future.
```
cd ..
rm blockchain.json private.pem
```

If you wish, you can change the settings for the Node, by editing the ```config.json``` file. This is one of my config files for testing purposes:
```
{
    "host" : "192.168.178.39",
    "port" : 1234,
    "stableNode" : "192.168.178.40",
    "stableNodePort" : 1234
}
```

You will need to adjust the IP-Addresses, and in case its needed, you also need to change the ports, they can be whatevet you want, as long as its in the TCP Port range (0 - 65535), but I generally recommend something outside the "well-known" ports.

Now you can start the node with a simple command:
```
node src/main.js
```

### TODO:
- [x] All TCP traffic signed
- [x] Proper way of creating a fingerprint of the public key
- [x] Sync Blockchain with Network on startup
- [x] verify Blockchain that is received on Network Registration
- [x] P.o.S. Consensus Algorithm
- [ ] P.o.S. Penalties and Health System
- [x] Address Balance Cache that is automatically updated when a Block is appended/snycing with Network
- [ ] Only Nodes that have been registered longer than one Voting Slot can be selected as Validator
- [ ] automatically remove offline Nodes from Nodelist
- [x] check reachability of Node on registration
- [ ] Timeouts for all TCP traffic
- [x] Allow multiple transactions per Block per Wallet

### License: 
MIT License

Copyright (c) 2022 Michel Barnich

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
