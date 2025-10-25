#!/usr/bin/env node
import dgram from 'dgram';

const port = Number(process.argv[2] ?? 9000);
const socket = dgram.createSocket('udp4');

socket.on('message', (msg, rinfo) => {
  console.log(`[OSC] ${rinfo.address}:${rinfo.port} -> ${msg.toString('hex')}`);
});

socket.bind(port, () => {
  console.log(`Escuchando mensajes OSC en puerto ${port}`);
});
