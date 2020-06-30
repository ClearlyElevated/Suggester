const { dbQuery } = require("../utils/db");
const { editFeedMessage } = require("../utils/actions");
module.exports = async (Discord, client, messageReaction) => {
	const nodeEmoji = require("node-emoji");
	if (messageReaction.message.partial) messageReaction.message = await messageReaction.message.fetch();
	let db = await messageReaction.message.guild.db;

	let suggestion = await dbQuery("Suggestion", { id: messageReaction.message.guild.id, messageId: messageReaction.message.id });
	if (!suggestion) return;

	let emotes = [suggestion.emojis.up.match(/a?:?.+:(\d+)/) ? suggestion.emojis.up.match(/a?:?.+:(\d+)/)[1] : suggestion.emojis.up, suggestion.emojis.mid.match(/a?:?.+:(\d+)/) ? suggestion.emojis.mid.match(/a?:?.+:(\d+)/)[1] : suggestion.emojis.mid, suggestion.emojis.down.match(/a?:?.+:(\d+)/) ? suggestion.emojis.down.match(/a?:?.+:(\d+)/)[1] : suggestion.emojis.down];
	if (!emotes.includes(nodeEmoji.hasEmoji(messageReaction.emoji.name) ? messageReaction.emoji.name : messageReaction.emoji.id)) return;

	await editFeedMessage({ guild: db.config.locale }, suggestion, db, client);
};
