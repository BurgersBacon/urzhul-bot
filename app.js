const config = require('./config');

// MongoDB configuration
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://" + config.mongoDB.username + ":" + config.mongoDB.pass + "@burgersbacon-lvg3y.mongodb.net/urzhul-bot";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// calling bot and database modules
const botActions = require('./scripts/bot-actions');
const databaseActions = require('./scripts/database-actions');

// connection to database and executing the bot
client.connect(err => {
  if (err) {
    console.log(err);
  } else {
    console.log("connection succedded!");
    const db = client.db("urzhul-bot");

    // initializes both bots so they are going to listen the tweets
    botActions.listenBurgrbot(db);
    botActions.listenUrzhul(db);

    // db.collection("pendingPosts").find({id: 'elqdg0'}).limit(1).toArray().then(posts => {
    //   if (posts.length > 0) {
    //     let post = posts[0];
    //     getFormatAndPost(post, db);
    //   }
    // });

    setInterval(db => {
      runPosting(db);
    }, 7260000, db);
  }

});

// run commands every two hours
const runPosting = (db) => {
  console.log("mmm ok, imma post something");
  databaseActions.getUpvotedPosts(db, botActions);
  databaseActions.fetchOnePendingPost(db, botActions);
};
