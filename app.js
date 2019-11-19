const config = require('./config');
const Twit = require('twit');
const snoowrap = require('snoowrap');
const Twitter = new Twit(config.mainTwitter);
const TwitterLinks = new Twit(config.sourceTwitter);
const Reddit = new snoowrap(config.reddit);
const http = require('http');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://" + config.mongoDB.username + ":" + config.mongoDB.pass + "@burgersbacon-lvg3y.mongodb.net/urzhul-bot"
const client = new MongoClient(uri, { useNewUrlParser: true });

// connection to database
client.connect(err => {
  console.log("connection succedded!")
  const db = client.db("urzhul-bot");

  // streams everytime the bot @burgrbot gets mentioned
  let stream = Twitter.stream('statuses/filter', { track: ['@burgrbot'] } )
  stream.on('tweet', function (tweet) {
    if (tweet.text.includes("!pending")) {
      countPendingPosts(db, {id_str: tweet.id_str, screen_name: tweet.user.screen_name})
    } else {
      let msg;
      msg = tweet.user.screen_name == "valcorn31" ? "miauuuuuu... i mean, woof, i mean beep beep boop im a bot" : "beep beep boop! im a dumb bot, i dont know what you're saying lmaoo"
      let params = {
        in_reply_to_status_id: tweet.id_str,
        status: `@${tweet.user.screen_name} ${msg}`
      }
      tweetBurgrbot(params)
    }
  });

  console.log("mmm ok, imma post something");
  getUpvotedPosts(db);
  countPendingPosts(db);
  fetchOnePendingPost(db);

  // every two hours do:
  setInterval(db => {
      console.log("mmm ok, imma post something");
      getUpvotedPosts(db);
      fetchOnePendingPost(db);
      countPendingPosts(db);
   }, 7260000, db)
});

// this function post the media to twitter
const fetchOnePendingPost = (db) => {
  // gets one of the pending posts
  db.collection("pendingPosts").find().sort({id: 1}).limit(1).toArray().then(posts => {
    console.log("beep boop what about this post? " + posts[0].url);
    let httpLink = posts[0].url.replace("https", "http");
    let httpLinkParts = httpLink.split(".");
    let fileFormat = httpLinkParts[httpLinkParts.length - 1];

    switch (fileFormat) {
      case "jpg":
      case "png":
        downloadMedia(httpLink, `images/${posts[0].id}${fileFormat}`, (urlMedia) => {
          uploadPhotoToTwitter(urlMedia, posts[0], db);
        });
        break;
      // case "vgif":
      //
      //   break;
      default:
        console.log(`i dont know that extention, post: ${posts[0].id}`);
    }
  });
}

// this function counts reamin posts and notifies if list ending soon
const countPendingPosts = (db, replying_to) => {
  // gets one of the pending posts
  db.collection("pendingPosts").count((err, count) => {
    let params;

    if (replying_to) {
      params = {
        in_reply_to_status_id: replying_to.id_str,
        status: `@${replying_to.screen_name} beep beep boop, pending posts: ${count}`
      }
      tweetBurgrbot(params);

    } else if (count < 12 && count % 2 == 1) {
      params = {
        status: count == 1 ? `@BurgersBacon no me quiero ir señor stark 😣😭` : `@BurgersBacon beep beep boop, bro im gonna die, i just have ${count} memes, feed me plox 🙏`
      }
      tweetBurgrbot(params);

    }
  });
}

// it searchs my upvoted posts on Reddit and saves some data to post them later
const getUpvotedPosts = (db) => {
  Reddit._get({uri: 'user/l33t_supa_h4x0r_/upvoted?limit=100'}).then(redditPosts => {
    let newPosts = [];
    // this part of the code searchs in the database and creates an array (pendingPosts)
    db.collection("pendingPosts").find().toArray().then(pendingPosts => {
      let savedItems = 0;
      redditPosts.forEach(redditPost => {

          // searchs the reddit post inside pendingPosts
          let found = pendingPosts.find(pendingPost => {
            return redditPost.id == pendingPost.id;
          });
          if (!found) {
            // searchs the redditPost inside postedPosts (to not post it again)
            db.collection("postedPosts").findOne({
              id: redditPost.id
            }).then(postedPost => {
              if (!postedPost) {
                db.collection("pendingPosts").insertOne({
                  id: redditPost.id,
                  url: redditPost.url,
                  permalink: redditPost.permalink,
                  author: redditPost.author.name
                })
                .then(() => {
                  savedItems ++;
                })
                .catch(err => {
                  if (err) console.log(err)
                });
              } else {
              }
            });
          }
        });
        console.log(`${savedItems} new items saved into database`)
    });
  });
}

// posts the tweet(?)
const tweetUrzhul = (params, redditPost, db) => {
  Twitter.post('statuses/update', params, function(err, data, response) {
    let paramsForReply = {
      in_reply_to_status_id: data.id_str,
      status: `.@${data.user.screen_name} st0len from: https://reddit.com${redditPost.permalink}, posted (probably st0len too) by: /u/${redditPost.author}, via Reddit beep beep boop im a bot`
    }
    tweetBurgrbot(paramsForReply, redditPost, db);
  })
}

const tweetBurgrbot = (paramsForReply, redditPost, db) => {
  TwitterLinks.post('statuses/update', paramsForReply, function(err, data, response) {
    if (redditPost) {
      db.collection('pendingPosts').deleteMany({
        id: redditPost.id
      }).then(() => {
        db.collection("postedPosts").insertOne({
          id: redditPost.id,
          url: redditPost.url,
          permalink: redditPost.permalink,
          author: redditPost.author
        }).then(() => {
          console.log(`beep beep boop, reddit post ${redditPost.id} posted on twitter!`)
        });
      });

    } else {
      console.log("replied to someone");
    }
  });
}

// donwloads the media to the server
const downloadMedia = (url, dest, cb) => {
  let file = fs.createWriteStream(dest);
  let request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb(dest));
    });
  });
}

// just read the name of the function
const uploadPhotoToTwitter = (urlImage, redditPost, db) => {
  let b64content = fs.readFileSync(urlImage, { encoding: 'base64' });
  Twitter.post('media/upload', { media_data: b64content }, function (err, data, response) {
    let mediaIdStr = data.media_id_string
    let meta_params = { media_id: mediaIdStr}
    Twitter.post('media/metadata/create', meta_params, function (err, data, response) {
      if (!err) {
        let params = { status: '', media_ids: [mediaIdStr] }
        tweetUrzhul(params, redditPost, db);
      }
    })
  });
}
