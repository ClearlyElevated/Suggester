const { colors } = require("../config.json");
const Discord = require("discord.js");
const { promises } = require("fs");
const { resolve } = require("path");
const { string } = require("./strings");

module.exports = {
	permLevelToRole: (locale, permLevel) => {
		switch (permLevel) {
		case -1:
			return string(locale, "NO_USERS_PERMISSION");
		case 0:
			return string(locale, "BOT_ADMIN_PERMISSION");
		case 1:
			return string(locale, "GLOBAL_STAFF_PERMISSION");
		case 2:
			return string(locale, "SERVER_ADMIN_PERMISSION");
		case 3:
			return string(locale, "SERVER_STAFF_PERMISSION");
		case 10:
			return string(locale, "ALL_USERS_PERMISSION");
		default:
			return string(locale, "UNKNOWN");
		}
	},
	/**
	 * Send a suggestion to the suggestion channel
	 * @param {Object} suggestion - The database record for the suggestion
	 * @param {Object} server - The server's database record
	 * @param {module:"discord.js".Client} client - Discord.js client
	 * @return {Promise<module:"discord.js".RichEmbed>}
	 */
	suggestionEmbed: async (locale, suggestion, server, client) => {
		let { fetchUser } = require("./misc.js");
		let suggester = await fetchUser(suggestion.suggester, client);
		let embed = new Discord.MessageEmbed();
		// User information
		embed.setAuthor(string(locale, "SUGGESTION_FROM_TITLE", { user: suggester.tag }), suggester.displayAvatarURL({format: "png", dynamic: true}))
			.setThumbnail(suggester.displayAvatarURL({format: "png", dynamic: true}));
		// Suggestion
		embed.setDescription(suggestion.suggestion)
			// Footer
			.setTimestamp(suggestion.submitted)
			.setFooter(string(locale, "SUGGESTION_FOOTER", { id: suggestion.suggestionId }));
		// Side Color
		switch (suggestion.displayStatus) {
		case "implemented": {
			embed.setColor(colors.green)
				.addField(string(locale, "INFO_PUBLIC_STATUS_HEADER"), string(locale, "STATUS_IMPLEMENTED"));
			break;
		}
		case "working": {
			embed.addField(string(locale, "INFO_PUBLIC_STATUS_HEADER"), string(locale, "STATUS_PROGRESS"))
				.setColor(colors.orange);
			break;
		}
		case "no": {
			embed.addField(string(locale, "INFO_PUBLIC_STATUS_HEADER"), string(locale, "STATUS_NO"))
				.setColor(colors.gray);
			break;
		}
		default: {
			embed.setColor(colors.default);
		}
		}
		// Comments
		if (suggestion.comments) {
			for (const comment of suggestion.comments) {
				if (!comment.deleted || comment.deleted !== true) {
					let user = await fetchUser(comment.author, client);
					let title;
					!user || user.id === "0" ? title = `${string(locale, "COMMENT_TITLE_ANONYMOUS")} (ID ${suggestion.suggestionId}_${comment.id})${comment.created ? " • " + comment.created.toUTCString() : ""}` : title = `${string(locale, "COMMENT_TITLE", { user: user.tag, id: `${suggestion.suggestionId}_${comment.id}` })} ${comment.created ? " • " + comment.created.toUTCString(locale, ) : ""}`;
					embed.addField(title, comment.comment);
				}
			}
		}
		// Attachment
		if (suggestion.attachment) embed.setImage(suggestion.attachment);

		return embed;
	},
	dmEmbed: function(locale, qSuggestionDB, color, title, attachment, suggestions, reason) {
		let embed = new Discord.MessageEmbed()
			.setTitle(string(locale, title.string, {server: title.guild}))
			.setFooter(string(locale, "SUGGESTION_FOOTER", {id: qSuggestionDB.suggestionId.toString()}))
			.setDescription(`${qSuggestionDB.suggestion || string(locale, "NO_SUGGESTION_CONTENT")}${qSuggestionDB.status === "approved" && suggestions ? `\n[${string(locale, "SUGGESTION_FEED_LINK")}](https://discordapp.com/channels/${qSuggestionDB.id}/${suggestions}/${qSuggestionDB.messageId})` : ""}`)
			.setTimestamp(qSuggestionDB.submitted)
			.setColor(colors[color] || color);
		if (attachment) embed.setImage(qSuggestionDB.attachment);
		if (reason) embed.addField(reason.header, reason.reason);
		return embed;
	},
	reviewEmbed: function (locale, qSuggestionDB, user, color, change) {
		let embed = new Discord.MessageEmbed()
			.setTitle(string(locale, "SUGGESTION_REVIEW_EMBED_TITLE", { id: qSuggestionDB.suggestionId.toString() }))
			.setAuthor(string(locale, "USER_INFO_HEADER", { user: user.tag, id: user.id }), user.displayAvatarURL({format: "png", dynamic: true}))
			.setDescription(qSuggestionDB.suggestion)
			.setFooter(string(locale, "SUGGESTION_FOOTER", {id: qSuggestionDB.suggestionId.toString()}))
			.setTimestamp(qSuggestionDB.submitted)
			.setColor(colors[color] || color);

		if (change) embed.addField(string(locale, "SUGGESTION_CHANGE_REVIEW_EMBED"), change);
		if (qSuggestionDB.attachment) {
			embed.addField(string(locale, "WITH_ATTACHMENT_HEADER"), qSuggestionDB.attachment);
			embed.setImage(qSuggestionDB.attachment);
		}
		return embed;
	},
	logEmbed: function (locale, qSuggestionDB, user, title, color) {
		return (new Discord.MessageEmbed()
			.setAuthor(string(locale, title, { user: user.tag, id: qSuggestionDB.suggestionId.toString() }), user.displayAvatarURL({format: "png", dynamic: true}))
			.setFooter(string(locale, "LOG_SUGGESTION_SUBMITTED_FOOTER", { id: qSuggestionDB.suggestionId.toString(), user: user.id }))
			.setTimestamp()
			.setColor(colors[color] || color));
	},
	/**
	 * Fetch a user
	 * @param {string} id - The Discord ID of the user
	 * @param {module:"discord.js".Client} client - The bot client
	 * @returns {Collection}
	 */
	async fetchUser(id, client) {
		if (!id) return client.user.unknown;
		let foundId;
		let matches = id.match(/^<@!?(\d+)>$/);
		if (!matches) foundId = id;
		else foundId = matches[1];

		function fetchUnknownUser(uid) {
			return client.users.fetch(uid, true)
				.then(() => {
					return client.users.cache.get(uid);
				})
				.catch(() => {
					return client.user.unknown;
				});
		}

		return client.users.cache.get(foundId)
			|| fetchUnknownUser(foundId)
			|| null;
	},
	/**
	 * Like readdir but recursive 👀
	 * @param {string} dir
	 * @returns {Promise<string[]>} - Array of paths
	 */
	fileLoader: async function* (dir) {
		const { fileLoader } = require("./misc");
		const files = await promises.readdir(dir, { withFileTypes: true });
		for (let file of files) {
			const res = resolve(dir, file.name);
			if (file.isDirectory()) {
				yield* fileLoader(res);
			} else {
				yield res;
			}
		}
	}
};
