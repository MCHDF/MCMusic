const Discord = require('discord.js');
const bot = new Discord.Client();
const ytdl = require('ytdl-core');
const YouTube = require('simple-youtube-api');
const fs = require('fs');
const { Video } = require('simple-youtube-api');
const prefix = '!';
bot.commands = new Discord.Collection();

const youtube = new YouTube(process.env.YT_API_KEY);

const queue = new Map();

fs.readdir("./command/", (err, files) => {
  if (err) console.log(err);

  let jsfile = files.filter(f => f.split(".").pop() === "js")
  if (jsfile.length <= 0) {
    console.log("명령어를 찾지 못했어요...");
    return;
  }

  jsfile.forEach((f, i) => {
    let props = require(`./command/${f}`);
    console.log(`[ ${f} ] load Complete`);
    bot.commands.set(props.help.name, props);
  });
});

bot.on('ready', () => {
  console.log(`${bot.user.username}의 음악 봇이 작동 중입니다!`);
});

bot.on('message', async message => {


  let args = message.content.substring(prefix.length).split(' ');
  let serverQueue = queue.get(message.guild.id);
  let searchString = args.slice(1).join(' ');
  let url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
  let messageArray = message.content.split(" ");
  let cmd = messageArray[0];

  if (message.author.bot) {
    return;
  }

  if (message.content.startsWith(`${prefix}search`)) { // 검색 명령어
    if (!args[0]) {
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
        message.channel.send(`:mag_right: \`${searchString}\` **검색 결과**\n${videos.map(video2 => `\`${++index}\` **${video2.title}**`).join('\n')}`);
        try {
          var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
            max: 1,
            time: 30000,
            errors: ['time']
          })
        } catch {
          message.channel.send(':stopwatch: **시간 초과!**').then(m => m.delete({ timeout: 3000 }));
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
        volume: 5,
        playing: true
      }
      queue.set(message.guild.id, queueConst);

      queueConst.songs.push(song);

      try {
        var connection = await voiceChannel.join();
        queueConst.connection = connection;
        play(message.guild, queueConst.songs[0]);
        message.channel.send(`:arrow_forward: **${song.title}**의 재생을 시작합니다!`)
      } catch (error) {
        console.log(`:no_entry_sign: 음성 채널에 입장하는데 문제가 생겼어요! 오류 내용을 개발자에게 알려주세요!\n오류 내용 \`${error}\``);
        queue.delete(message.guild.id);
        return message.channel.send(`:no_entry_sign: 음성 채널에 입장하는데 문제가 생겼어요! 오류 내용을 개발자에게 알려주세요!\n오류 내용 \`${error}\``);
      }

    } else {
      serverQueue.songs.push(song);
      return message.channel.send(`:notepad_spiral: \`${song.title}\`이(가) 재생목록에 추가되었습니다!`);
    }
    return undefined;

  } else if (message.content.startsWith(`${prefix}play`)) { //바로 플레이 명령어
    if (!args[0]) {
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
        volume: 5,
        playing: true
      }
      queue.set(message.guild.id, queueConst);

      queueConst.songs.push(song);

      try {
        var connection = await voiceChannel.join();
        queueConst.connection = connection;
        play(message.guild, queueConst.songs[0]);
        message.channel.send(`:arrow_forward: \`${song.title}\`의 재생을 시작합니다!`)
      } catch (error) {
        console.log(`:no_entry_sign: 음성 채널에 입장하는데 문제가 생겼어요! 오류 내용을 개발자에게 알려주세요!\n오류 내용 \`${error}\``);
        queue.delete(message.guild.id);
        return message.channel.send(`:no_entry_sign: 음성 채널에 입장하는데 문제가 생겼어요! 오류 내용을 개발자에게 알려주세요!\n오류 내용 \`${error}\``);
      }

    } else {
      serverQueue.songs.push(song);
      return message.channel.send(`:notepad_spiral: \`${song.title}\`이(가) 재생목록에 추가되었습니다!`);
    }
    return undefined;

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
    message.channel.send(':stop_button: **모든 음악을 중지합니다!**');
    return undefined;
  } else if (message.content.startsWith(`${prefix}skip`)) { // 곡 스킵 명령어
    if (!serverQueue) {
      return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
    }
    if (!message.member.voice.channel) {
      return message.channel.send(':no_entry_sign: 음악을 건너뛰기 위해서 음악이 재생되고있는 채널에 접속해주세요!');
    }
    serverQueue.connection.dispatcher.end();
    return message.channel.send(`:track_next: **재생중인 음악을 건너뛰었어요!**`);

  } else if (message.content.startsWith(`${prefix}list`)) { // 곡 리스트 명령어
    if (!serverQueue) {
      return message.channel.send(':bulb: 재생목록에 제가 부를 노래가 없는것 같아요...');
    }
    let index = 0;
    message.channel.send(`:notepad_spiral: __**재생목록**__\n${serverQueue.songs.map(song => `**${++index}** \`\`${mmss(song.length)}\`\` ${song.title} **${song.addUser}** `).join('\n')}`, '\n');
    return undefined;
  } else if (message.content.startsWith(prefix + 'np')) { // 현재 재생중인 곡 표시 명령어
    if (!serverQueue) {
      return message.channel.send(':mute: 저는 지금 어떠한 노래도 부르고 있지않아요...');
    }
    message.channel.send(`:arrow_forward: **재생 중**\n${serverQueue.songs[0].title} \`${mmss(serverQueue.songs[0].length)}\` **${serverQueue.songs[0].addUser}**`);
    return undefined;
  }
  if (!message.content.startsWith(prefix)) return;
  let commandfile = bot.commands.get(cmd.slice(prefix.length)) || bot.commands.get(cmd.slice(prefix.length));
  if (commandfile) {
    commandfile.run(bot, message, args);
  }
});

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
  dispatcher.setVolume(1);
}

function mmss(i) {
  var hour = Math.floor(i / 3600);
  var min = Math.floor((i - (hour * 3600)) / 60);
  var sec = i - (hour * 3600) - (min * 60);
  return `${min}:${(sec < 10) ? "0" + sec : sec}`;
}

bot.login(process.env.MCBOT_TOKEN);