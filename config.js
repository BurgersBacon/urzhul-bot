module.exports = {
  mainTwitter: {
    consumer_key: process.env.MAIN_TW_CONSUMER_KEY,
    consumer_secret: process.env.MAIN_TW_SECRET_KEY,
    access_token: process.env.MAIN_TW_ACCESS_TOKEN,
    access_token_secret: process.env.MAIN_TW_ACCESS_TOKEN_SECRET
  },
  reddit: {
    userAgent: process.env.REDDIT_USERAGENT,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN
  },
  sourceTwitter: {
    consumer_key: process.env.SOURCE_TW_CONSUMER_KEY,
    consumer_secret: process.env.SOURCE_TW_SECRET_KEY,
    access_token: process.env.SOURCE_TW_ACCESS_TOKEN,
    access_token_secret: process.env.SOURCE_TW_ACCESS_TOKEN_SECRET
  },
  mongoDB: {
    username: process.env.MONGODB_USERNAME,
    pass: process.env.MONGODB_PASSWORD
  }
}
