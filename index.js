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

	socket.write(JSON.stringify(firstPayload))
};

process.stdin.on('data', data => {
	const message = data.toString().replace(/\n/g, "");
	const signature = sha(message + myKey + Date.now());
	receivedMessageSignatures.push(signature);

	if (message !== './log') {
		peer.onMessage(`${username}:${port} => ${message}`);
	}

	if (message === './log') {
    const logFilePath = path.join(logsDir, `${username}-${port}.txt`);
    const logFileContent = peer.logs.join('\n');
    fs.writeFileSync(logFilePath, logFileContent);
    console.log(`Logs salvos em ${logFilePath}`);
  } else if (message.split(' ')[0] === './send' && message.split(' ').length === 2) {
		const filePath = message.split(" ")[1];

		try {
			const fileData = fs.readFileSync(filePath);
	
			const fileName = filePath.split('/').pop();
	
			const filePayload = {
				username,
				port,
				command: 'send',
				fileName,
				fileBuffer: fileData,
				isSendCommand: true
			};
	
			const json = JSON.stringify(filePayload);
			peer.broadcast(json);

			const file = {
				fileName,
				fileBuffer: fileData.toString('base64')
			}
			receivedFiles.push(file);

			console.log(`Arquivo "${fileName}" enviado com sucesso.`);
		} catch (error) {
			console.error('Erro ao ler o arquivo:', error);
		}
	} else if (message.split(' ')[0] === './download' && message.split(' ').length === 2) {
		const fileName = message.split(" ")[1];

		const file = receivedFiles.find(file => {
			return file.fileName === fileName
		});

		if (file) {
			const filePath = path.join(__dirname, fileName);
			fs.writeFileSync(filePath, file.fileBuffer);
			console.log(`Arquivo "${fileName}" baixado com sucesso.`);
		}
	} else {
		peer.broadcast(JSON.stringify({ signature, message, username, port }));
	}
});

const receivedMessageSignatures = [ myKey ];
const receivedFiles = [];

peer.onData = (socket, data) => {
	const json = data.toString();
	const payload = JSON.parse(json);

	if(receivedMessageSignatures.includes(payload.signature))
		return;

	receivedMessageSignatures.push(payload.signature)

	if (payload.isConnectionMessage) {
		peer.onMessage(payload.message);
		console.log(payload.message);
	} else if (payload.isSendCommand) {
		if (payload.username !== username || payload.port !== port) {
      console.log(`${payload.username}:${payload.port} enviou o arquivo ${payload.fileName}`);

			const fileBuffer = Buffer.from(payload.fileBuffer, 'base64');

      const file = {
        fileName: payload.fileName,
        fileBuffer
      }
      receivedFiles.push(file);
    }
	} else {
		peer.onMessage(`${payload.username}:${payload.port} => ${payload.message}`);
		console.log(`${payload.username}:${payload.port} => ${payload.message}`);
	}
		
	peer.broadcast(json);
};