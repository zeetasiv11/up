const { identifier } = require("../src/music/TrackResolver.js");
const isUrl = value => /^https?:\/\//i.test(value);
const isYouTubeInput = value => /(?:youtube\.com|youtu\.be|^ytsearch:|^ytmsearch:)/i.test(value);
module.exports = { normalizeMusicQuery: identifier, isUrl, isYouTubeInput };
