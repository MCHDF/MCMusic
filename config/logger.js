const appRoot = require('app-root-path');
const winston = require('winston');
const winstonDaily = require('winston-daily-rotate-file');

const logDir = `./logs`;

const {
    combine,
    timestamp,
    printf
} = winston.format;

const logFormat = printf(({
    level,
    message,
    timestamp
}) => {
    return `[${timestamp}] [ ${level} ]: ${message}`;
})

const logger = winston.createLogger({
    format: combine(
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        logFormat
    ),
    transports: [
        new winstonDaily({
            level: 'info',
            datePattern: 'YYYY-MM-DD',
            dirname: logDir,
            filename: `Music_%DATE%.log`,
            maxFiles: 30,
            zippedArchive: false
        })
    ],
    exceptionHandlers: [
        new winstonDaily({
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            dirname: logDir,
            filename: `Music_ex_%DATE%.log`,
            maxFiles: 30,
            zippedArchive: false
        })
    ]
})

module.exports = logger;