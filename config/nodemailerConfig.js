const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'gemnetsolutions1@gmail.com',
        pass: 'rioy lwvy gkzb vaoy'
    }
});

module.exports = transporter;
