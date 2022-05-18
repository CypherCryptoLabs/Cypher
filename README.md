# Table of contents

- [Cypher](#cypher)
- [Contribute](#contribute)
- [Installation](#installation)
  - [Docker](#docker)
    - [Download the Node](#download-the-node)
    - [Change config.json](#change-configjson)
    - [Setting up the Docker container](#setting-up-the-docker-container)
  - [Manual Installation](#manual-installation)
    - [Download the Node](#download-the-node)
    - [Install NodeJS modules](#install-nodejs-modules)
    - [Create config.json](#create-configjson)
    - [Copy the Blockchain](#copy-the-blockchain)
    - [run the Node](#run-the-node)
- [TODO](#todo)
- [License](#license)
    
# Cypher
Cypher is an open-source Project, aiming to create a decentralized Live-Messenger. For this to work, there needs to be a Network of Computers, called "Nodes", that communicate with each other. To make it attractive for people to run a Node, there is a cryptocurrency called "Cypher". In one Cypher there are 1000 "milliCypher" or "mCypher". 1000 Cypher are refered to as one "KCypher" or "KiloCypher". Nodes can earn Cypher by contributing to the Network, and putting some amount of Cypher at risk. This process is called "staking".

The Cypher Project does not stop with providing this decentralized infrastructure and Live-Messenger. There are already more projects in the works, that will be released as a certain progress is reached.

# Contribute
Contributing to the Cypher Project should be as easy as possible, which is why we use GitHub Pull Requests.There are only 2 rules.

1. Your Pull Requests contains a bug-fix
2. Your Pull Requests completes one of the goals in the TODO list

If your Pull Request does not contain one of these, it will be rejected. If you want to suggest an improvement, you can open a new Issue.

# Installation
There are 2 ways of installing the Cypher Node. Either you choose the easy way (Docker) or the painful one (manual installation). For both methods I assume you are using GNU/Linux and have Git as well as Docker installed. If thats not the case, please do it now.

## Docker
This is the easy way of installing Cypher Node.

### Download the Node
First you need to download the Source Code. You do this by running the following command:
```
git clone https://github.com/michelbarnich/cypher
```

Change your directory to the Cypher Docker directory:
```
cd ./cypher/docker
```

### Change config.json
You need to adjust the config.json file. It is pretty simple. There are only 4 configurations to modify.
This is what the file looks originally:
```
{
    "host" : "192.168.178.22",
    "port" : 1234,
    "stableNode" : "192.168.178.40",
    "stableNodePort" : 1234
}
```

If you are familiar with the IP protocol, you will realize the IP-Addresses are local Addresses, which is a problem if you want to contribute to a global network. The "host" field needs to have your IP-Address as value. The "port" field can be anything you want as long as it is inside the TCP port range, and not already used by some other service. The "stableNode" and "stableNodePort" fields are the IP-Address and TCP port for a Node you trust. If you dont trust any specific Node, enter the values of the Node run by Cypher, you can find the information on [cyphercrypto.io](https://cyphercrypto.io/stable-node).

### Setting up the Docker container
After changing the config.json file, run the following command to build a Docker Image:
```
docker build -t cypher .
```

This might take some time, after a while, you should see a message similar to this one:
```
!!!COPY THE FOLLOWING KEY TO A SECURE LOCATION!!!
-----BEGIN EC PRIVATE KEY-----
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
-----END EC PRIVATE KEY-----
```

Copy the key to a secure place. All your rewards will be ONLY accessible with this key!
The last step is to run the Node. Type the following command:
```
docker run -d -p<your port>:<your port> cypher
```

Replace the \<your port\> with the port you set for the "port" field when you edited the config.json file.

Congratulations, your Node is now online!

## Manual Installation
Installing the Cypher Node this way is not necessarily harder, but a lot more can go wrong.

### Download the Node
First you need to download the Source Code. You do this by running the following command:
```
git clone https://github.com/michelbarnich/cypher
```

### Install NodeJS modules
In the next step, you need to download the Cypher Node dependencies. 
```
cd src # change directory to the source code of Cypher Node
npm install --save # install all dependencies
cd .. # change directory back to the Cypher Node root
```

### Create config.json
You need to create the config.json file. It is pretty simple. There are only 4 configurations to modify.
This is what the file looks originally (copied from the docker directory):
```
{
    "host" : "192.168.178.22",
    "port" : 1234,
    "stableNode" : "192.168.178.40",
    "stableNodePort" : 1234
}
```

If you are familiar with the IP protocol, you will realize the IP-Addresses are local Addresses, which is a problem if you want to contribute to a global network. The "host" field needs to have your IP-Address as value. The "port" field can be anything you want as long as it is inside the TCP port range, and not already used by some other service. The "stableNode" and "stableNodePort" fields are the IP-Address and TCP port for a Node you trust. If you dont trust any specific Node, enter the values of the Node run by Cypher, you can find the information on [cyphercrypto.io](https://cyphercrypto.io/stable-node).

### Copy the Blockchain
The easiest way to do that is to copy it from the docker directory.
```
cp docker/blockchain.json blockchain.json
```

Alternatively, if you find a source somewhere online with a copy of the Blockchain, and you trust that source, you could download it from there.

### run the Node
Finally you can run this command:
```
node src/main.js
```

It will create a file called "private.pem", copy it to a secure location, your funds will only be accessible with that file!
Congratulations, your Node is now online!

### TODO
- [x] All TCP traffic signed
- [x] Proper way of creating a fingerprint of the public key
- [x] Sync Blockchain with Network on startup
- [x] verify Blockchain that is received on Network Registration
- [x] P.o.S. Consensus Algorithm
- [ ] P.o.S. Penalties and Health System
- [x] Address Balance Cache that is automatically updated when a Block is appended/snycing with Network
- [x] Only Nodes that have been registered longer than one Voting Slot can be selected as Validator
- [x] automatically remove offline Nodes from Nodelist
- [x] check reachability of Node on registration
- [x] Timeouts for all TCP traffic
- [x] Allow multiple transactions per Block per Wallet

### License
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
