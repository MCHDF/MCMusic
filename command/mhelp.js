const { MessageEmbed } = require('discord.js');
const botconfig = require('../jsons/botconfig.json');
let prefix = botconfig.prefix;
module.exports = {
    run: async (bot, message, args) => {
        let embed = new MessageEmbed()
            .setTitle("**명령어 도움말**")
            .setColor("#FFE4E4")
            .setAuthor("MCBOT", "https://i.imgur.com/Togof5u.png")
            .setThumbnail("https://i.imgur.com/Togof5u.png")
            .setDescription('모든 명령어는 ' + prefix + ' 를 붙여 사용합니다.')
            .addField("play", "```입력하신 곡(링크)의 재생을 시작합니다!\n사용법 : " + prefix + "play <곡|URL>```")
            .addField("search", "```음악을 검색합니다!\n사용법 : " + prefix + "search <곡>```")
            .addField("list", "```현재 재생중인 목록을 표시합니다!\n사용법 : " + prefix + "list```")
            .addField("np", "```현재 재생중인 곡을 표시합니다.\n사용법 : " + prefix + "np```")
            .addField("stop", "```모든 곡을 중단시켜요!\n관리자 권한이 필요해요!\n사용법 : " + prefix + "stop```")
            .setFooter(`Request by ${message.author.tag} • 문의 : MCHDF#9999`);
        return message.channel.send(embed);
    }
}

module.exports.help = {
    name: "mhelp",
    aliases: ['h'],
    category: "",
    description: "Help for MCBOT what have commands"
}