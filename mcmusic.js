const Discord = require('discord.js');
const bot = new Discord.Client();
const ytdl = require('ytdl-core');
const YouTube = require('simple-youtube-api');
const fs = require('fs');
const mysql = require('mysql');
const youtube = new YouTube(process.env.YT_API_KEY);
const queue = new Map();
const log = require('./config/logger.js')

const con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

con.connect(err => {
    if (err) throw err;
    console.log('데이터베이스 연결 완료!');
});

bot.on('ready', () => {
    console.log(`┌────────────────────────────┐`);
    console.log(`│ 봇 ${bot.user.username}이 작동 시작합니다!│`);
    console.log(`└────────────────────────────┘`);
});

bot.on('message', async message => {
    if (message.author.bot) {
        return;
    }

    let prefixSet = JSON.parse(fs.readFileSync('./jsons/prefixSet.json', 'utf-8'));

    if (!prefixSet[message.guild.id]) {
        prefixSet[message.guild.id] = {
            prefixSet: '!'
        };
    }

    let prefix = prefixSet[message.guild.id].prefixSet;

    if (message.content.startsWith(prefix + "mhelp")) { // 음악 봇 명령어 도움말
        let embed = new Discord.MessageEmbed()
            .setTitle("**명령어 도움말**")
            .setColor("#FFE4E4")
            .setAuthor("MCBOT", bot.user.displayAvatarURL())
            .setThumbnail(bot.user.displayAvatarURL())
            .setDescription('모든 명령어는 ' + prefix + ' 를 붙여 사용합니다.\n모든 음악과 검색 결과는 YouTube를 기준으로 사용됩니다!')
            .addField("play", "```입력하신 곡(링크)의 재생을 시작합니다!\n사용법 : " + prefix + "play <곡|URL>```")
            .addField("search", "```음악을 검색합니다!\n사용법 : " + prefix + "search <곡>```")
            .addField("list", "```현재 재생중인 목록을 표시합니다!\n사용법 : " + prefix + "list```")
            .addField("np", "```현재 재생중인 곡을 표시합니다.\n사용법 : " + prefix + "np```")
            .addField("volume", "```음악의 볼륨을 설정 합니다!(0 ~ 10)\n사용법 : " + prefix + "volume\n기본값 : 5```")
        if (message.member.hasPermission("ADMINISTRATOR")) {
            embed
                .addField("stop", "```모든 곡을 중단시켜요!\n관리자 권한이 필요해요!\n사용법 : " + prefix + "stop```")
        }
        embed
            .setFooter(`Request by ${message.author.tag} • 문의 : MCHDF#9999\nYouTube API & ytdl`);
        message.fetch(message.id).then(m => {
            m.react("🎵");
        });
        return message.author.send(embed);
    }

    let args = message.content.substring(prefix.length).split(' ');
    let serverQueue = queue.get(message.guild.id);
    let searchString = args.slice(1).join(' ');
    let url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';

    // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    if (message.content.startsWith(`${prefix}search`)) { // 검색 명령어
        if (!args[1]) {
            return message.channel.send(':mag_right: **검색할 곡의 제목을 입력해주세요!**')
                .catch(console.error);
        }
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.channel.send(":loud_sound: **음악을 재생하기 위해선, 음성 채널에 접속 하셔야해요!**");
        }
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) {
            return message.channel.send(":no_entry_sign: 저에게 음성 채널에 접근할 수 있는 권한이 없어요!");
        }
        if (!permissions.has('SPEAK')) {
            return message.channel.send(':no_entry_sign: 저에게 말할 수 있는 권한이 없는것 같아요!');
        }

        try {
            var video = await youtube.getVideoByID(url);
        } catch {
            try {
                var videos = await youtube.searchVideos(searchString, 5);
                var index = 0;
                if (!videos.map) {
                    let embed = new Discord.MessageEmbed()
                        .setTitle(`:mag_right: \`${searchString}\` **검색 결과**`)
                        .setDescription('검색하신 음악을 찾을 수 없어요....');
                    return message.channel.send(embed);
                }
                let embed = new Discord.MessageEmbed()
                    .setTitle(`:mag_right: \`${searchString}\` **검색 결과**`)
                    .setDescription(`${videos.map(video2 => `\`${++index}\` **${video2.title}**`).join('\n')}\n\n:stopwatch: 재생할 곡의 번호를 15초 안에 전송해주세요!`)
                message.channel.send(embed).then(m => m.delete({ timeout: 15000 }));
                // message.channel.send(`:mag_right: \`${searchString}\` **검색 결과**\n${videos.map(video2 => `\`${++index}\` **${video2.title}**`).join('\n')}\n:stopwatch: 재생할 곡의 번호를 전송해주세요!`);
                try {
                    var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                        max: 1,
                        time: 15000,
                        errors: ['time']
                    })
                } catch {
                    return message.channel.send(':stopwatch: **시간 초과!**').then(m => m.delete({ timeout: 3000 }));
                }
                const videoIndex = parseInt(responce.first().content);
                var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
            } catch {
                return message.channel.send(`:bulb: \`${searchString}\`을(를) 찾을 수 없어요...`);
            }
        }

        const song = {
            id: video.id,
            title: video.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            length: video.durationSeconds,
            addUser: message.author.username
        };

        if (!serverQueue) {
            const queueConst = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 3,
                playing: true,
                skipVote: []
            }
            queue.set(message.guild.id, queueConst);

            queueConst.songs.push(song);

            try {
                var connection = await voiceChannel.join();
                queueConst.connection = connection;
                play(message.guild, queueConst.songs[0]);
                message.channel.send(`:arrow_forward: \`\`${mmss(song.length)}\`\` **${song.title}** 의 재생을 시작합니다!`)
                log.info(`${message.author.username} has Play Music '${mmss(song.length)} - ${song.title}' on ${message.guild.name}`);
            } catch (error) {
                log.error(`${message.guild.name} ERROR : ${error}`);
                queue.delete(message.guild.id);
                return message.channel.send(`:no_entry_sign: 음성 채널에 입장하는데 문제가 생겼어요! 오류 내용을 개발자에게 알려주세요!\n오류 내용 \`${error}\``);
            }

        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`:notepad_spiral: \`\`${mmss(song.length)}\`\` **${song.title}** 이(가) 재생목록에 추가되었습니다!`);
        }
        return undefined;
        // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(`${prefix}play`)) { //바로 플레이 명령어
        if (!args[1]) {
            return message.channel.send(':mag_right: **재생할 곡의 이름을 입력해주세요!**')
                .catch(console.error);
        }
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.channel.send(":loud_sound: **음악을 재생하기 위해선, 음성 채널에 접속 하셔야해요!**");
        }
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) {
            return message.channel.send(":no_entry_sign: 저에게 음성 채널에 접근할 수 있는 권한이 없어요!");
        }
        if (!permissions.has('SPEAK')) {
            return message.channel.send(':no_entry_sign: 저에게 말할 수 있는 권한이 없는것 같아요!');
        }

        try {
            var video = await youtube.getVideoByID(url);
        } catch {
            try {
                var videos = await youtube.searchVideos(searchString, 1);
                var video = await youtube.getVideoByID(videos[0].id)
            } catch (error) {
                return message.channel.send(`:bulb: \`${searchString}\`을(를) 찾을 수 없어요...`);
            }
        }

        const song = {
            id: video.id,
            title: video.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            length: video.durationSeconds,
            addUser: message.author.username
        };

        if (!serverQueue) {
            const queueConst = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 3,
                playing: true,
                skipVote: []
            }
            queue.set(message.guild.id, queueConst);

            queueConst.songs.push(song);

            try {
                var connection = await voiceChannel.join();
                queueConst.connection = connection;
                play(message.guild, queueConst.songs[0]);
                message.channel.send(`:arrow_forward: \`\`${mmss(song.length)}\`\` **${song.title}** 의 재생을 시작합니다!`)
                log.info(`${message.author.username} has Play Music '${mmss(song.length)} - ${song.title}' on ${message.guild.name}`)
            } catch (error) {
                log.error(`${message.guild.name} ERROR : ${error}`)
                queue.delete(message.guild.id);
                return message.channel.send(`:no_entry_sign: 음성 채널에 입장하는데 문제가 생겼어요! 오류 내용을 개발자에게 알려주세요!\n오류 내용 \`${error}\``);
            }

        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`:notepad_spiral: \`\`${mmss(song.length)}\`\` **${song.title}** 이(가) 재생목록에 추가되었습니다!`);
        }
        return undefined;
        // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(`${prefix}stop`)) { //재생 중단 명령어
        if (!message.member.hasPermission(["ADMINISTRATOR"])) {
            return message.reply(":x: 음악을 중단할 권한이 없어요!").then(m => m.delete({ timeout: 3000 }));
        }
        if (!serverQueue) {
            return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
        }
        if (!message.member.voice.channel) {
            return message.channel.send(':no_entry_sign: 음악을 멈추기 위해서 음악이 재생되고있는 채널에 접속해주세요!');
        }
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        return message.channel.send(':stop_button: **모든 음악을 중지합니다!**');
        // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(`${prefix}forceskip`)) { // 곡 포스 스킵 명령어
        if (!message.member.hasPermission(["ADMINISTRATOR"])) {
            return message.reply(":x: 음악을 강제 스킵할 권한이 없어요!").then(m => m.delete({ timeout: 3000 }));
        }
        if (!serverQueue) {
            return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
        }

        serverQueue.connection.dispatcher.end();
        return message.channel.send(`:track_next: **재생중인 음악을 건너뛰었어요!**`);
        // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(`${prefix}skip`)) { // 곡 스킵 명령어
        if (!serverQueue) {
            return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
        }
        if (!message.member.voice.channel) {
            return message.channel.send(':no_entry_sign: 음악을 건너뛰기 위해서 음악이 재생되고있는 채널에 접속해주세요!');
        }

        let usersC = message.member.voice.channel.members.size;
        let required = Math.ceil(usersC / 2);

        if (serverQueue.skipVote.includes(message.member.id)) {
            return message.channel.send(':bookmark_tabs: 이미 투표하셨어요!');
        }

        serverQueue.skipVote.push(message.member.id);
        message.channel.send(`:white_check_mark: 투표 완료! \`${serverQueue.skipVote.length}/${required}\``);

        if (serverQueue.skipVote.length >= required) {
            serverQueue.connection.dispatcher.end();
            serverQueue.skipVote = [];
            return message.channel.send(`:track_next: **재생중인 음악을 건너뛰었어요!**`);
        }
        // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(`${prefix}list`)) { // 곡 리스트 명령어
        if (!serverQueue) {
            return message.channel.send(':bulb: 재생목록에 제가 부를 노래가 없는것 같아요...');
        }
        let index = 0;
        let embed = new Discord.MessageEmbed()
            .setTitle(`:notepad_spiral: __**재생목록**__`)
            .setDescription(`${serverQueue.songs.map(song => `**${++index}** \`\`${mmss(song.length)}\`\` ${song.title} **${song.addUser}**`).join('\n')}`)
        message.channel.send(embed);
        return undefined;
        // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(prefix + 'np')) { // 현재 재생중인 곡 표시 명령어
        if (!serverQueue) {
            return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
        }
        message.channel.send(`:arrow_forward: **재생 중**\n${serverQueue.songs[0].title} \`${mmss(serverQueue.songs[0].length)}\` **${serverQueue.songs[0].addUser}**`);
        return undefined;
        // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    } else if (message.content.startsWith(prefix + "volume")) { // 볼륨 조절 명령어
        if (!serverQueue) {
            return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
        }
        if (!message.member.voice.channel) {
            return message.channel.send(':no_entry_sign: 볼륨을 조절하기 위해서 음악이 재생되고있는 채널에 접속해주세요!');
        }
        if (!args[1]) {
            const volume = serverQueue.volume;
            const volumeLevel = "⬜".repeat(volume) + "⬛".repeat(10 - volume);
            let embed = new Discord.MessageEmbed()
                .setTitle('**Volume**')
                .setDescription(`🔈 ${volumeLevel} 🔊`)
            return message.channel.send(embed);
        }
        if (parseInt(args[1]) >= 11) {
            return message.channel.send('설정 가능한 볼륨은 \`0 ~ 10\` 까지입니다!');
        } else {
            serverQueue.volume = args[1];
            serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 10);
            const volume = serverQueue.volume;
            const volumeLevel = "⬜".repeat(volume) + "⬛".repeat(10 - volume);
            let embed = new Discord.MessageEmbed()
                .setTitle('**Volume**')
                .setDescription(`🔈 ${volumeLevel} 🔊`)
            return message.channel.send(embed);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    if (message.content.startsWith(prefix + 'mreload')) {
        if (message.author.id != '468781931182555136') {
            return;
        } else {
            message.channel.send('리로딩...');
            process.exit();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    if (message.content.startsWith(prefix + 'prefix')) {
        if (!message.author.id === '468781931182555136') {
            if (!message.member.hasPermission("ADMINISTRATOR")) {
                return;
            }
        }
        if (args[1] === '초기화') {
            let prefixSet = JSON.parse(fs.readFileSync('./jsons/prefixSet.json', 'utf-8'));

            prefixSet[message.guild.id] = {
                prefixSet: '!'
            };
            fs.writeFile('./jsons/prefixSet.json', JSON.stringify(prefixSet), (err) => {
                if (err) {
                    console.log(err);
                } else {
                    return;
                }
            });
        } else {
            if (!args[1]) {
                return;
            }
            let prefixSet = JSON.parse(fs.readFileSync('./jsons/prefixSet.json', 'utf-8'));

            prefixSet[message.guild.id] = {
                prefixSet: args[1]
            };

            fs.writeFile('./jsons/prefixSet.json', JSON.stringify(prefixSet), (err) => {
                if (err) {
                    console.log(err);
                } else {
                    return;
                }
            });
        }
    }
});
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on('finish', () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => {
            console.log(error)
        })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 10);
}

function mmss(i) {
    var hour = Math.floor(i / 3600);
    var min = Math.floor((i - (hour * 3600)) / 60);
    var sec = i - (hour * 3600) - (min * 60);
    if (hour === 0) {
        hour = '';
    } else {
        hour = `${hour}:`
    }
    if (min === 0) {
        min = '00:';
    } else {
        min = `${min}:`
    }
    return `${hour}${min}${(sec < 10) ? "0" + sec : sec}`;
}

bot.login(process.env.MCBOT_TOKEN);