const express = require('express');
const server = express();
server.use(express.static('webroot'));
server.listen(8080);