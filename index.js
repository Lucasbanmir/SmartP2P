if(!process.env.PORT)
	throw Error("Variável de ambiente PORT não informada");

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');

if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir);
}
		
const port = process.env.PORT;
const username = process.env.USERNAME;

const sha = require('sha256');
const timestamp = Date.now();
const randomNumber = Math.floor( (Math.random() * 10000) + 1000 )
const myKey = sha(port + "" + timestamp + "" + randomNumber);

const Peer = require("./Peer");
const peer = new Peer(port, username);

process.argv.slice(2).forEach( anotherPeerAddress => peer.connectTo(anotherPeerAddress) );

peer.onConnection = socket => {
	const message = `${username}:${port} entrou no chat!`;
	const signature = sha(message + myKey + Date.now());
	receivedMessageSignatures.push(signature);

	const firstPayload = {
		signature,
		message,
		isConnectionMessage: true
	}

	const logs = []

	socket.write(JSON.stringify(firstPayload))
};

process.stdin.on('data', data => {
	const message = data.toString().replace(/\n/g, "");
	const signature = sha(message + myKey + Date.now());
	receivedMessageSignatures.push(signature);

	if (message !== './download-logs') {
		peer.onMessage(`${username}:${port} => ${message}`);
	}

	peer.broadcast(JSON.stringify({ signature, message, username, port }));

	if (message === './download-logs') {
    const logFilePath = path.join(logsDir, `${username}-${port}.txt`);
    const logFileContent = peer.logs.join('\n');
    fs.writeFileSync(logFilePath, logFileContent);
    console.log(`Logs salvos em ${logFilePath}`);
  }
});

const receivedMessageSignatures = [];

peer.onData = (socket, data) => {
	const json = data.toString();
	const payload = JSON.parse(json);

	if(receivedMessageSignatures.includes(payload.signature))
		return;

	receivedMessageSignatures.push(payload.signature)

	if (payload.isConnectionMessage) {
		peer.onMessage(payload.message);
		console.log(payload.message);
	} else {
		peer.onMessage(`${payload.username}:${payload.port} => ${payload.message}`);
		console.log(`${payload.username}:${payload.port} => ${payload.message}`);
	}
		
	peer.broadcast(json);
};